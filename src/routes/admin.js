const express = require('express');
const { getDb } = require('../db');

function requireAdmin(req, res, next) {
	if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/auth/login');
	next();
}

const router = express.Router();
router.use(requireAdmin);

router.get('/', (req, res) => {
	const db = getDb();
	const kpis = db.prepare('SELECT * FROM v_kpis ORDER BY day DESC LIMIT 30').all();
	const rooms = db.prepare('SELECT * FROM rooms ORDER BY number').all();
	const staff = db.prepare('SELECT id,name,role,username,active FROM staff ORDER BY role,name').all();
	
	// Get reservations with customer details (if customer is registered)
	const reservations = db
		.prepare(
			`SELECT r.id, r.customer_name, r.customer_email, r.customer_phone, r.check_in, r.check_out, r.status, 
			        r.payment_status, r.payment_txn_id, r.payment_proof_path, r.created_at,
			        rm.number as room_number, rm.type as room_type,
			        c.id as customer_id, c.username as customer_username, c.aadhar as customer_aadhar, c.address as customer_address
			 FROM reservations r
			 JOIN rooms rm ON rm.id = r.room_id
			 LEFT JOIN customers c ON c.email = r.customer_email OR c.phone = r.customer_phone
			 ORDER BY r.created_at DESC
			 LIMIT 100`
		)
		.all();
	
	// Get all registered customers
	const customers = db
		.prepare(
			`SELECT c.*, 
			        COUNT(r.id) as total_bookings,
			        COUNT(CASE WHEN r.status IN ('booked', 'checked_in') THEN 1 END) as active_bookings
			 FROM customers c
			 LEFT JOIN reservations r ON (r.customer_email = c.email OR r.customer_phone = c.phone)
			 WHERE c.active = 1
			 GROUP BY c.id
			 ORDER BY c.created_at DESC`
		)
		.all();
	
	res.render('admin/dashboard', { title: 'Admin Dashboard', kpis, rooms, staff, reservations, customers });
});

// confirm payment for a reservation
router.post('/reservations/:id/confirm', (req, res) => {
	const db = getDb();
	const r = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id);
	if (r) {
		db.prepare("UPDATE reservations SET payment_status='confirmed' WHERE id = ?").run(r.id);
	}
	res.redirect('/admin');
});

// Rooms CRUD (minimal: create/update status/price)
router.post('/rooms', (req, res) => {
	const { number, type, capacity, price_per_night } = req.body;
	const db = getDb();
	try {
		db.prepare(
			`INSERT INTO rooms (number, type, capacity, price_per_night) VALUES (?,?,?,?)`
		).run(number, type, Number(capacity), Number(price_per_night));
	} catch (e) {
		// ignore for duplicate number; in real app, surface error
	}
	res.redirect('/admin');
});

router.post('/rooms/:id', (req, res) => {
	const { status, price_per_night } = req.body;
	const db = getDb();
	db.prepare(`UPDATE rooms SET status = ?, price_per_night = ? WHERE id = ?`).run(
		status,
		Number(price_per_night),
		Number(req.params.id)
	);
	res.redirect('/admin');
});

// Staff create and toggle active
router.post('/staff', (req, res) => {
	const { name, role, username, password } = req.body;
	const bcrypt = require('bcryptjs');
	const db = getDb();
	try {
		db.prepare(
			`INSERT INTO staff (name, role, username, password_hash) VALUES (?,?,?,?)`
		).run(name, role, username, bcrypt.hashSync(password || 'changeme123', 10));
	} catch (e) {}
	res.redirect('/admin');
});

router.post('/staff/:id/toggle', (req, res) => {
	const db = getDb();
	const s = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id);
	if (s) {
		db.prepare('UPDATE staff SET active = ? WHERE id = ?').run(s.active ? 0 : 1, s.id);
	}
	res.redirect('/admin');
});

module.exports = router;


