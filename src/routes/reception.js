const express = require('express');
const dayjs = require('dayjs');
const { db } = require('../db');

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
			db.listReservationsByCheckIn(today, 'booked'),
			db.listReservationsByCheckOut(today, 'checked_in'),
			db.listCheckedInReservations(),
			db.listPendingServiceRequests(),
		]);

		res.render('reception/dashboard', {
			title: 'Reception',
			arrivals,
			departures,
			checkedIn,
			serviceRequests,
			dayjs,
		});
	} catch (error) {
		next(error);
	}
});

router.post('/check-in/:id', async (req, res, next) => {
	try {
		const reservation = await db.getReservationRaw(req.params.id);
		if (!reservation || reservation.status !== 'booked') return res.redirect('/reception');
		await db.updateReservation(reservation.id, { status: 'checked_in' });
		res.redirect('/reception');
	} catch (error) {
		next(error);
	}
});

router.post('/check-out/:id', async (req, res, next) => {
	try {
		const reservation = await db.getReservationRaw(req.params.id);
		if (!reservation || reservation.status !== 'checked_in') return res.redirect('/reception');
		await db.updateReservation(reservation.id, {
			status: 'checked_out',
			payment_status: 'paid',
		});
		res.redirect('/reception');
	} catch (error) {
		next(error);
	}
});

router.post('/service-request/:id/complete', async (req, res, next) => {
	try {
		await db.completeServiceRequest(req.params.id);
		res.redirect('/reception');
	} catch (error) {
		next(error);
	}
});

module.exports = router;
