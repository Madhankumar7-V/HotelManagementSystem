const express = require('express');
const dayjs = require('dayjs');
const QRCode = require('qrcode');
const { many, one, query } = require('../db');
const { config } = require('../config');

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
	destination: function (req, file, cb) {
		const dir = config.uploadDir;
		if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
		cb(null, dir);
	},
    filename: function(req, file, cb) {
        const ext = path.extname(file.originalname || '').toLowerCase();
        cb(null, 'proof_' + Date.now() + '_' + Math.random().toString(36).slice(2) + ext);
    }
});
const upload = multer({ storage });

function buildUpiLink(amount = 0) {
	const params = new URLSearchParams({
		pa: config.upiId,
		pn: config.upiPayeeName,
		am: String(amount || 0),
		cu: 'INR',
		tn: 'Hotel room booking',
	});
	return `upi://pay?${params.toString()}`;
}

function buildBookingReference() {
	return `HTL-${Date.now().toString(36).toUpperCase()}`;
}

router.get('/', async (req, res, next) => {
	try {
		const rooms = await many(
			`SELECT * FROM rooms WHERE status = 'available' ORDER BY number`
		);
		res.render('public/home', { title: 'Hotel', rooms });
	} catch (error) {
		next(error);
	}
});

router.get('/book', requireCustomer, async (req, res, next) => {
	try {
		const rooms = await many(
			`SELECT id, number, type, capacity, price_per_night
			 FROM rooms
			 WHERE status = 'available'
			 ORDER BY number`
		);
		const customer = req.session.customer;
		const form = {
			name: customer?.name || '',
			email: '',
			phone: '',
		};

		if (customer) {
			const customerData = await one(
				'SELECT email, phone FROM customers WHERE id = $1',
				[customer.id]
			);
			if (customerData) {
				form.email = customerData.email || '';
				form.phone = customerData.phone || '';
			}
		}

		res.render('public/book', {
			title: 'Book a Room',
			query: req.query,
			rooms,
			form,
			customer,
		});
	} catch (error) {
		next(error);
	}
});

// Booking now requires upfront payment proof and transaction id
router.post('/book', requireCustomer, upload.single('payment_proof'), async (req, res, next) => {
	try {
		const { name, email, phone, room_id, check_in, check_out, payment_txn_id } = req.body;
		const rooms = await many(
			`SELECT id, number, type, capacity, price_per_night
			 FROM rooms
			 WHERE status = 'available'
			 ORDER BY number`
		);
		if (!name || !room_id || !check_in || !check_out || !payment_txn_id || !req.file) {
			return res.status(400).render('public/book', {
				title: 'Book a Room',
				error: 'All fields are required, including payment proof and transaction ID.',
				form: req.body,
				rooms,
				query: {},
			});
		}

		if (new Date(check_in) >= new Date(check_out)) {
			return res.status(400).render('public/book', {
				title: 'Book a Room',
				error: 'Check-out must be after check-in.',
				form: req.body,
				rooms,
				query: {},
			});
		}

		const overlap = await one(
			`SELECT COUNT(*)::int AS count
			 FROM reservations
			 WHERE room_id = $1
			   AND status IN ('booked', 'checked_in')
			   AND NOT (check_out <= $2::date OR check_in >= $3::date)`,
			[Number(room_id), check_in, check_out]
		);
		if (overlap && overlap.count > 0) {
			return res.status(400).render('public/book', {
				title: 'Book a Room',
				error: 'Selected room is not available for these dates.',
				form: req.body,
				rooms,
				query: {},
			});
		}

		const proofPath = `/uploads/${path.basename(req.file.path)}`;
		const customer = req.session.customer;
		let customerName = name;
		let customerEmail = email;
		let customerPhone = phone;

		if (customer) {
			const customerData = await one(
				'SELECT name, email, phone FROM customers WHERE id = $1',
				[customer.id]
			);
			if (customerData) {
				customerName = customerData.name || name;
				customerEmail = customerData.email || email;
				customerPhone = customerData.phone || phone;
			}
		}

		const reservation = await one(
			`INSERT INTO reservations
				(customer_id, customer_name, customer_email, customer_phone, room_id, check_in, check_out, payment_method, payment_status, payment_txn_id, payment_proof_path, booking_reference)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, 'upi_qr', 'submitted', $8, $9, $10)
			 RETURNING id`,
			[
				customer?.id || null,
				customerName,
				customerEmail || null,
				customerPhone || null,
				Number(room_id),
				check_in,
				check_out,
				payment_txn_id.trim(),
				proofPath,
				buildBookingReference(),
			]
		);

		res.redirect(`/reservation/${reservation.id}`);
	} catch (error) {
		next(error);
	}
});

router.get('/reservation/:id', async (req, res, next) => {
	try {
		const reservation = await one(
			`SELECT r.*, rm.number AS room_number, rm.type AS room_type, rm.price_per_night
			 FROM reservations r
			 JOIN rooms rm ON rm.id = r.room_id
			 WHERE r.id = $1`,
			[req.params.id]
		);
		if (!reservation) return res.status(404).render('404', { title: 'Not Found' });
		res.render('public/reservation', { title: 'Reservation', reservation, dayjs });
	} catch (error) {
		next(error);
	}
});

router.post('/reservation/:id/cancel', async (req, res, next) => {
	try {
		const reservation = await one('SELECT * FROM reservations WHERE id = $1', [req.params.id]);
		if (reservation && reservation.status === 'booked') {
			await query(`UPDATE reservations SET status = 'cancelled' WHERE id = $1`, [req.params.id]);
		}
		res.redirect(`/reservation/${req.params.id}`);
	} catch (error) {
		next(error);
	}
});

// Upload payment proof and transaction id
router.post('/reservation/:id/payment', upload.single('payment_proof'), async (req, res, next) => {
	try {
		const reservation = await one('SELECT * FROM reservations WHERE id = $1', [req.params.id]);
		if (!reservation) return res.redirect('/');
		const txn = (req.body.payment_txn_id || '').trim();
		const proofPath = req.file ? `/uploads/${path.basename(req.file.path)}` : null;
		await query(
			`UPDATE reservations
			 SET payment_txn_id = $1,
			     payment_proof_path = $2,
			     payment_status = $3
			 WHERE id = $4`,
			[
				txn || reservation.payment_txn_id,
				proofPath || reservation.payment_proof_path,
				txn || proofPath ? 'submitted' : reservation.payment_status,
				reservation.id,
			]
		);
		res.redirect(`/reservation/${reservation.id}`);
	} catch (error) {
		next(error);
	}
});

module.exports = router;

router.get('/payment/upi-qr', async (req, res, next) => {
	try {
		const amount = Number(req.query.amount || 0);
		const svg = await QRCode.toString(buildUpiLink(amount), { type: 'svg', margin: 1 });
		res.type('image/svg+xml').send(svg);
	} catch (error) {
		next(error);
	}
});


