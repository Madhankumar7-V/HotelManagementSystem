const express = require('express');
const dayjs = require('dayjs');
const { getDb } = require('../db');

const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Middleware to require customer login for booking
function requireCustomer(req, res, next) {
	if (!req.session.customer) {
		// Store the full URL including query parameters
		const fullUrl = req.originalUrl || req.url;
		req.session.bookingRedirect = fullUrl;
		// Build redirect URL with room_id if present
		let loginUrl = '/customer/login?redirect=book';
		if (req.query.room_id) {
			loginUrl += `&room_id=${req.query.room_id}`;
		}
		return res.redirect(loginUrl);
	}
	next();
}

const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        const dir = path.join(__dirname, '..', '..', 'uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: function(req, file, cb) {
        const ext = path.extname(file.originalname || '').toLowerCase();
        cb(null, 'proof_' + Date.now() + '_' + Math.random().toString(36).slice(2) + ext);
    }
});
const upload = multer({ storage });

router.get('/', (req, res) => {
	const db = getDb();
	const rooms = db.prepare('SELECT * FROM rooms ORDER BY number').all();
	res.render('public/home', { title: 'Hotel', rooms });
});

router.get('/book', requireCustomer, (req, res) => {
    const db = getDb();
    const rooms = db.prepare("SELECT id, number, type, capacity, price_per_night FROM rooms WHERE status = 'available' ORDER BY number").all();
    const customer = req.session.customer;
    // Pre-fill form with customer info if available
    const form = {
        name: customer?.name || '',
        email: '',
        phone: ''
    };
    // Get customer details from database
    if (customer) {
        const customerData = db.prepare('SELECT email, phone FROM customers WHERE id = ?').get(customer.id);
        if (customerData) {
            form.email = customerData.email || '';
            form.phone = customerData.phone || '';
        }
    }
    // Handle room_id from query string
    const query = req.query;
    res.render('public/book', { title: 'Book a Room', query, rooms, form, customer });
});

// Booking now requires upfront payment proof and transaction id
router.post('/book', requireCustomer, upload.single('payment_proof'), (req, res) => {
	const { name, email, phone, room_id, check_in, check_out, payment_txn_id } = req.body;
	const db = getDb();

	// Basic validation
	if (!name || !room_id || !check_in || !check_out || !payment_txn_id || !req.file) {
        const rooms = db.prepare("SELECT id, number, type, capacity, price_per_night FROM rooms WHERE status = 'available' ORDER BY number").all();
		return res.status(400).render('public/book', { title: 'Book a Room', error: 'All fields are required, including payment proof and transaction ID', form: req.body, rooms, query: {} });
	}
	if (new Date(check_in) >= new Date(check_out)) {
        const rooms = db.prepare("SELECT id, number, type, capacity, price_per_night FROM rooms WHERE status = 'available' ORDER BY number").all();
		return res.status(400).render('public/book', { title: 'Book a Room', error: 'Check-out must be after check-in', form: req.body, rooms, query: {} });
	}

	// availability: no overlapping reservation for same room with active status
	const overlap = db
		.prepare(
			`SELECT COUNT(*) as c FROM reservations 
		   WHERE room_id = ? AND status IN ('booked','checked_in')
		   AND NOT (date(check_out) <= date(?) OR date(check_in) >= date(?))`
		)
		.get(room_id, check_in, check_out).c;
    if (overlap > 0) {
        const rooms = db.prepare("SELECT id, number, type, capacity, price_per_night FROM rooms WHERE status = 'available' ORDER BY number").all();
		return res.render('public/book', {
			title: 'Book a Room',
			error: 'Selected room is not available for these dates',
			form: req.body,
			rooms,
			query: {},
		});
	}
	const proofPath = '/uploads/' + path.basename(req.file.path);
	
	// Get customer info if logged in
	const customer = req.session.customer;
	let customerName = name;
	let customerEmail = email;
	let customerPhone = phone;
	
	if (customer) {
		const customerData = db.prepare('SELECT name, email, phone FROM customers WHERE id = ?').get(customer.id);
		if (customerData) {
			customerName = customerData.name || name;
			customerEmail = customerData.email || email;
			customerPhone = customerData.phone || phone;
		}
	}
	
	const stmt = db.prepare(
		`INSERT INTO reservations (customer_name, customer_email, customer_phone, room_id, check_in, check_out, payment_method, payment_status, payment_txn_id, payment_proof_path) VALUES (?,?,?,?,?, ?, 'offline', 'submitted', ?, ?)`
	);
	const info = stmt.run(customerName, customerEmail, customerPhone, Number(room_id), check_in, check_out, payment_txn_id, proofPath);
    // mark room temporarily unavailable (reserved). We'll free it on cancel/checkout
    db.prepare("UPDATE rooms SET status = 'maintenance' WHERE id = ?").run(Number(room_id));
	res.redirect(`/reservation/${info.lastInsertRowid}`);
});

router.get('/reservation/:id', (req, res) => {
	const db = getDb();
	const reservation = db
		.prepare(
            `SELECT r.*, rm.number as room_number, rm.type as room_type, rm.price_per_night
		   FROM reservations r JOIN rooms rm ON rm.id = r.room_id WHERE r.id = ?`
		)
		.get(req.params.id);
	if (!reservation) return res.status(404).render('404', { title: 'Not Found' });
	res.render('public/reservation', { title: 'Reservation', reservation, dayjs });
});

router.post('/reservation/:id/cancel', (req, res) => {
	const db = getDb();
    const resv = db.prepare('SELECT * FROM reservations WHERE id=?').get(req.params.id);
    if (resv && resv.status === 'booked') {
        db.prepare(`UPDATE reservations SET status='cancelled' WHERE id=?`).run(req.params.id);
        db.prepare("UPDATE rooms SET status='available' WHERE id = ?").run(resv.room_id);
    }
	res.redirect(`/reservation/${req.params.id}`);
});

module.exports = router;

// Upload payment proof and transaction id
router.post('/reservation/:id/payment', upload.single('payment_proof'), (req, res) => {
    const db = getDb();
    const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id);
    if (!reservation) return res.redirect('/');
    const txn = (req.body.payment_txn_id || '').trim();
    const proofPath = req.file ? ('/uploads/' + path.basename(req.file.path)) : null;
    db.prepare('UPDATE reservations SET payment_txn_id = ?, payment_proof_path = ?, payment_status = ? WHERE id = ?')
      .run(txn || reservation.payment_txn_id, proofPath || reservation.payment_proof_path, txn || proofPath ? 'submitted' : reservation.payment_status, reservation.id);
    res.redirect('/reservation/' + reservation.id);
});


