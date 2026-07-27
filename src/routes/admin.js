const express = require('express');
const bcrypt = require('bcryptjs');
const { many, one, query } = require('../db');

function requireAdmin(req, res, next) {
	if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/auth/login');
	next();
}

const router = express.Router();
router.use(requireAdmin);

router.get('/', async (req, res, next) => {
	try {
		const [kpis, rooms, staff, reservations, customers] = await Promise.all([
			many('SELECT * FROM v_kpis ORDER BY day DESC LIMIT 30'),
			many('SELECT * FROM rooms ORDER BY number'),
			many('SELECT id, name, role, username, active, created_at FROM staff ORDER BY role, name'),
			many(
				`SELECT r.id, r.customer_name, r.customer_email, r.customer_phone, r.check_in, r.check_out,
				        r.status, r.payment_status, r.payment_txn_id, r.payment_proof_path, r.created_at,
				        r.booking_reference, rm.number AS room_number, rm.type AS room_type,
				        c.id AS customer_id, c.username AS customer_username, c.aadhar AS customer_aadhar, c.address AS customer_address
				 FROM reservations r
				 JOIN rooms rm ON rm.id = r.room_id
				 LEFT JOIN customers c ON c.id = r.customer_id
				 ORDER BY r.created_at DESC
				 LIMIT 100`
			),
			many(
				`SELECT c.*,
				        COUNT(r.id)::int AS total_bookings,
				        COUNT(*) FILTER (WHERE r.status IN ('booked', 'checked_in'))::int AS active_bookings
				 FROM customers c
				 LEFT JOIN reservations r ON r.customer_id = c.id
				 WHERE c.active = TRUE
				 GROUP BY c.id
				 ORDER BY c.created_at DESC`
			),
		]);

		res.render('admin/dashboard', { title: 'Admin Dashboard', kpis, rooms, staff, reservations, customers });
	} catch (error) {
		next(error);
	}
});

// confirm payment for a reservation
router.post('/reservations/:id/confirm', async (req, res, next) => {
	try {
		const reservation = await one('SELECT * FROM reservations WHERE id = $1', [req.params.id]);
		if (reservation) {
			await query("UPDATE reservations SET payment_status = 'confirmed' WHERE id = $1", [reservation.id]);
		}
		res.redirect('/admin');
	} catch (error) {
		next(error);
	}
});

// Rooms CRUD (minimal: create/update status/price)
router.post('/rooms', async (req, res, next) => {
	const { number, type, capacity, price_per_night } = req.body;
	try {
		await query(
			`INSERT INTO rooms (number, type, capacity, price_per_night) VALUES ($1, $2, $3, $4)`,
			[number, type, Number(capacity), Number(price_per_night)]
		);
	} catch (e) {
		return next(e);
	}
	res.redirect('/admin');
});

router.post('/rooms/:id', async (req, res, next) => {
	const { status, price_per_night } = req.body;
	try {
		await query(
			`UPDATE rooms SET status = $1, price_per_night = $2 WHERE id = $3`,
			[status, Number(price_per_night), Number(req.params.id)]
		);
		res.redirect('/admin');
	} catch (error) {
		next(error);
	}
});

// Staff create and toggle active
router.post('/staff', async (req, res, next) => {
	const { name, role, username, password } = req.body;
	try {
		await query(
			`INSERT INTO staff (name, role, username, password_hash) VALUES ($1, $2, $3, $4)`,
			[name, role, username, bcrypt.hashSync(password || 'changeme123', 10)]
		);
		res.redirect('/admin');
	} catch (error) {
		next(error);
	}
});

router.post('/staff/:id/toggle', async (req, res, next) => {
	try {
		const staffMember = await one('SELECT * FROM staff WHERE id = $1', [req.params.id]);
		if (staffMember) {
			await query('UPDATE staff SET active = $1 WHERE id = $2', [!staffMember.active, staffMember.id]);
		}
		res.redirect('/admin');
	} catch (error) {
		next(error);
	}
});

module.exports = router;


