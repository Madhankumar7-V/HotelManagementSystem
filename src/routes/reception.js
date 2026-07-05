const express = require('express');
const dayjs = require('dayjs');
const { getDb } = require('../db');

function requireReception(req, res, next) {
	if (!req.session.user || !['receptionist', 'admin'].includes(req.session.user.role)) {
		return res.redirect('/auth/login');
	}
	next();
}

const router = express.Router();

router.use(requireReception);

router.get('/', (req, res) => {
	const db = getDb();
	const today = dayjs().format('YYYY-MM-DD');
    const arrivals = db
		.prepare(
            `SELECT r.*, rm.number as room_number, rm.type as room_type FROM reservations r 
		   JOIN rooms rm ON rm.id = r.room_id
		   WHERE r.check_in = ? AND r.status = 'booked'
		   ORDER BY time(r.created_at)`
		)
		.all(today);
	const departures = db
		.prepare(
            `SELECT r.*, rm.number as room_number, rm.type as room_type FROM reservations r 
		   JOIN rooms rm ON rm.id = r.room_id
		   WHERE r.check_out = ? AND r.status = 'checked_in'
		   ORDER BY time(r.created_at)`
		)
		.all(today);
	
	// Get all currently checked-in guests
	const checkedIn = db
		.prepare(
			`SELECT r.*, rm.number as room_number, rm.type as room_type FROM reservations r 
		   JOIN rooms rm ON rm.id = r.room_id
		   WHERE r.status = 'checked_in'
		   ORDER BY r.check_out`
		)
		.all();
	
	// Get pending service requests
	const serviceRequests = db
		.prepare(
			`SELECT sr.*, r.customer_name, r.customer_phone, rm.number as room_number 
			 FROM service_requests sr
			 JOIN reservations r ON sr.reservation_id = r.id
			 JOIN rooms rm ON r.room_id = rm.id
			 WHERE sr.status = 'pending'
			 ORDER BY sr.created_at DESC`
		)
		.all();
	
	res.render('reception/dashboard', { title: 'Reception', arrivals, departures, checkedIn, serviceRequests, dayjs });
});

router.post('/check-in/:id', (req, res) => {
	const db = getDb();
	const resv = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id);
	if (!resv || resv.status !== 'booked') return res.redirect('/reception');
	db.prepare("UPDATE reservations SET status = 'checked_in' WHERE id = ?").run(resv.id);
    // keep room reserved; do not free yet
	res.redirect('/reception');
});

router.post('/check-out/:id', (req, res) => {
	const db = getDb();
	const resv = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id);
	if (!resv || resv.status !== 'checked_in') return res.redirect('/reception');
    // on checkout, mark payment as paid and free the room
    db.prepare("UPDATE reservations SET status = 'checked_out', payment_status = 'paid' WHERE id = ?").run(resv.id);
    db.prepare("UPDATE rooms SET status='available' WHERE id = ?").run(resv.room_id);
	res.redirect('/reception');
});

// Handle service requests
router.post('/service-request/:id/complete', (req, res) => {
	const db = getDb();
	db.prepare("UPDATE service_requests SET status = 'completed' WHERE id = ?").run(req.params.id);
	res.redirect('/reception');
});

module.exports = router;


