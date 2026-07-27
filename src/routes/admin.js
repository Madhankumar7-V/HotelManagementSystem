const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');

function requireAdmin(req, res, next) {
	if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/auth/login');
	next();
}

const router = express.Router();
router.use(requireAdmin);

router.get('/', async (req, res, next) => {
	try {
		const [kpis, rooms, staff, reservations, customers] = await Promise.all([
			db.listKpis(),
			db.listRooms(),
			db.listStaff(),
			db.listAdminReservations(),
			db.listCustomersWithBookingCounts(),
		]);

		res.render('admin/dashboard', {
			title: 'Admin Dashboard',
			kpis,
			rooms,
			staff,
			reservations,
			customers,
		});
	} catch (error) {
		next(error);
	}
});

router.post('/reservations/:id/confirm', async (req, res, next) => {
	try {
		const reservation = await db.getReservationRaw(req.params.id);
		if (reservation) {
			await db.updateReservation(reservation.id, { payment_status: 'confirmed' });
		}
		res.redirect('/admin');
	} catch (error) {
		next(error);
	}
});

router.post('/rooms', async (req, res, next) => {
	const { number, type, capacity, price_per_night, image_url, description } = req.body;
	try {
		await db.createRoom({
			number,
			type,
			capacity: Number(capacity),
			price_per_night: Number(price_per_night),
			image_url: image_url || null,
			description: description || null,
			status: 'available',
		});
		res.redirect('/admin');
	} catch (error) {
		next(error);
	}
});

router.post('/rooms/:id', async (req, res, next) => {
	const { status, price_per_night, image_url, description } = req.body;
	try {
		await db.updateRoom(req.params.id, {
			status,
			price_per_night: Number(price_per_night),
			image_url: image_url || null,
			description: description || null,
		});
		res.redirect('/admin');
	} catch (error) {
		next(error);
	}
});

router.post('/staff', async (req, res, next) => {
	const { name, role, username, password } = req.body;
	try {
		await db.createStaff({
			name,
			role,
			username,
			password_hash: bcrypt.hashSync(password || 'changeme123', 10),
			active: true,
		});
		res.redirect('/admin');
	} catch (error) {
		next(error);
	}
});

router.post('/staff/:id/toggle', async (req, res, next) => {
	try {
		const staffMember = await db.getStaffById(req.params.id);
		if (staffMember) {
			await db.updateStaff(staffMember.id, { active: !staffMember.active });
		}
		res.redirect('/admin');
	} catch (error) {
		next(error);
	}
});

module.exports = router;
