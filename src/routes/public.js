const express = require('express');
const dayjs = require('dayjs');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { db } = require('../db');
const { config } = require('../config');

const router = express.Router();

function requireCustomer(req, res, next) {
	if (!req.session.customer) {
		req.session.bookingRedirect = req.originalUrl || req.url;
		let loginUrl = '/customer/login?redirect=book';
		if (req.query.room_id) loginUrl += `&room_id=${req.query.room_id}`;
		return res.redirect(loginUrl);
	}
	next();
}

const storage = multer.diskStorage({
	destination(req, file, cb) {
		const dir = config.uploadDir;
		if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
		cb(null, dir);
	},
	filename(req, file, cb) {
		const ext = path.extname(file.originalname || '').toLowerCase();
		cb(null, `proof_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
	},
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
		const rooms = await db.listAvailableRooms();
		res.render('public/home', { title: 'Hotel', rooms });
	} catch (error) {
		next(error);
	}
});

router.get('/book', requireCustomer, async (req, res, next) => {
	try {
		const rooms = await db.listAvailableRooms();
		const customer = req.session.customer;
		const form = { name: customer?.name || '', email: '', phone: '' };

		if (customer) {
			const customerData = await db.getCustomerById(customer.id);
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

router.post('/book', requireCustomer, upload.single('payment_proof'), async (req, res, next) => {
	try {
		const { name, email, phone, room_id, check_in, check_out, payment_txn_id } = req.body;
		const rooms = await db.listAvailableRooms();

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

		const overlap = await db.countOverlappingReservations(Number(room_id), check_in, check_out);
		if (overlap > 0) {
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
			const customerData = await db.getCustomerById(customer.id);
			if (customerData) {
				customerName = customerData.name || name;
				customerEmail = customerData.email || email;
				customerPhone = customerData.phone || phone;
			}
		}

		const reservation = await db.createReservation({
			customer_id: customer?.id || null,
			customer_name: customerName,
			customer_email: customerEmail || null,
			customer_phone: customerPhone || null,
			room_id: Number(room_id),
			check_in,
			check_out,
			payment_method: 'upi_qr',
			payment_status: 'submitted',
			payment_txn_id: payment_txn_id.trim(),
			payment_proof_path: proofPath,
			booking_reference: buildBookingReference(),
			status: 'booked',
		});

		res.redirect(`/reservation/${reservation.id}`);
	} catch (error) {
		next(error);
	}
});

router.get('/reservation/:id', async (req, res, next) => {
	try {
		const reservation = await db.getReservationById(req.params.id);
		if (!reservation) return res.status(404).render('404', { title: 'Not Found' });
		res.render('public/reservation', { title: 'Reservation', reservation, dayjs });
	} catch (error) {
		next(error);
	}
});

router.post('/reservation/:id/cancel', async (req, res, next) => {
	try {
		const reservation = await db.getReservationRaw(req.params.id);
		if (reservation && reservation.status === 'booked') {
			await db.updateReservation(req.params.id, { status: 'cancelled' });
		}
		res.redirect(`/reservation/${req.params.id}`);
	} catch (error) {
		next(error);
	}
});

router.post('/reservation/:id/payment', upload.single('payment_proof'), async (req, res, next) => {
	try {
		const reservation = await db.getReservationRaw(req.params.id);
		if (!reservation) return res.redirect('/');
		const txn = (req.body.payment_txn_id || '').trim();
		const proofPath = req.file ? `/uploads/${path.basename(req.file.path)}` : null;
		await db.updateReservation(reservation.id, {
			payment_txn_id: txn || reservation.payment_txn_id,
			payment_proof_path: proofPath || reservation.payment_proof_path,
			payment_status: txn || proofPath ? 'submitted' : reservation.payment_status,
		});
		res.redirect(`/reservation/${reservation.id}`);
	} catch (error) {
		next(error);
	}
});

router.get('/payment/upi-qr', async (req, res, next) => {
	try {
		const amount = Number(req.query.amount || 0);
		const svg = await QRCode.toString(buildUpiLink(amount), { type: 'svg', margin: 1 });
		res.type('image/svg+xml').send(svg);
	} catch (error) {
		next(error);
	}
});

module.exports = router;
