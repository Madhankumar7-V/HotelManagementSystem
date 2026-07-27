const express = require('express');
const dayjs = require('dayjs');
const { many, one, query } = require('../db');

function requireReception(req, res, next) {
	if (!req.session.user || !['receptionist', 'admin'].includes(req.session.user.role)) {
		return res.redirect('/auth/login');
	}
	next();
}

const router = express.Router();

router.use(requireReception);

router.get('/', async (req, res, next) => {
	const today = dayjs().format('YYYY-MM-DD');
	try {
		const [arrivals, departures, checkedIn, serviceRequests] = await Promise.all([
			many(
				`SELECT r.*, rm.number AS room_number, rm.type AS room_type
				 FROM reservations r
				 JOIN rooms rm ON rm.id = r.room_id
				 WHERE r.check_in = $1 AND r.status = 'booked'
				 ORDER BY r.created_at`,
				[today]
			),
			many(
				`SELECT r.*, rm.number AS room_number, rm.type AS room_type
				 FROM reservations r
				 JOIN rooms rm ON rm.id = r.room_id
				 WHERE r.check_out = $1 AND r.status = 'checked_in'
				 ORDER BY r.created_at`,
				[today]
			),
			many(
				`SELECT r.*, rm.number AS room_number, rm.type AS room_type
				 FROM reservations r
				 JOIN rooms rm ON rm.id = r.room_id
				 WHERE r.status = 'checked_in'
				 ORDER BY r.check_out`
			),
			many(
				`SELECT sr.*, r.customer_name, r.customer_phone, rm.number AS room_number
				 FROM service_requests sr
				 JOIN reservations r ON sr.reservation_id = r.id
				 JOIN rooms rm ON r.room_id = rm.id
				 WHERE sr.status = 'pending'
				 ORDER BY sr.created_at DESC`
			),
		]);

		res.render('reception/dashboard', { title: 'Reception', arrivals, departures, checkedIn, serviceRequests, dayjs });
	} catch (error) {
		next(error);
	}
});

router.post('/check-in/:id', async (req, res, next) => {
	try {
		const reservation = await one('SELECT * FROM reservations WHERE id = $1', [req.params.id]);
		if (!reservation || reservation.status !== 'booked') return res.redirect('/reception');
		await query("UPDATE reservations SET status = 'checked_in' WHERE id = $1", [reservation.id]);
		res.redirect('/reception');
	} catch (error) {
		next(error);
	}
});

router.post('/check-out/:id', async (req, res, next) => {
	try {
		const reservation = await one('SELECT * FROM reservations WHERE id = $1', [req.params.id]);
		if (!reservation || reservation.status !== 'checked_in') return res.redirect('/reception');
		await query("UPDATE reservations SET status = 'checked_out', payment_status = 'paid' WHERE id = $1", [reservation.id]);
		res.redirect('/reception');
	} catch (error) {
		next(error);
	}
});

// Handle service requests
router.post('/service-request/:id/complete', async (req, res, next) => {
	try {
		await query("UPDATE service_requests SET status = 'completed', completed_at = NOW() WHERE id = $1", [req.params.id]);
		res.redirect('/reception');
	} catch (error) {
		next(error);
	}
});

module.exports = router;


