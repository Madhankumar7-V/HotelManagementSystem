const express = require('express');
const bcrypt = require('bcryptjs');
const dayjs = require('dayjs');
const { db } = require('../db');

const router = express.Router();

router.get('/register', (req, res) => {
	res.render('customer/register', { title: 'Customer Registration', error: null, form: {} });
});

router.post('/register', async (req, res) => {
	const { username, password, confirm_password, name, email, phone, aadhar, address } = req.body;

	if (!username || !password || !name || !email || !phone || !aadhar) {
		return res.render('customer/register', {
			title: 'Customer Registration',
			error: 'All mandatory fields are required',
			form: req.body,
		});
	}

	if (password !== confirm_password) {
		return res.render('customer/register', {
			title: 'Customer Registration',
			error: 'Passwords do not match',
			form: req.body,
		});
	}

	if (password.length < 6) {
		return res.render('customer/register', {
			title: 'Customer Registration',
			error: 'Password must be at least 6 characters',
			form: req.body,
		});
	}

	if (!/^\d{12}$/.test(aadhar)) {
		return res.render('customer/register', {
			title: 'Customer Registration',
			error: 'Aadhar number must be exactly 12 digits',
			form: req.body,
		});
	}

	if (!/^\d{10}$/.test(phone)) {
		return res.render('customer/register', {
			title: 'Customer Registration',
			error: 'Phone number must be exactly 10 digits',
			form: req.body,
		});
	}

	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		return res.render('customer/register', {
			title: 'Customer Registration',
			error: 'Invalid email format',
			form: req.body,
		});
	}

	try {
		const existingUser = await db.findExistingCustomer({ username, email, aadhar });
		if (existingUser) {
			return res.render('customer/register', {
				title: 'Customer Registration',
				error: 'Username, email, or Aadhar number already exists',
				form: req.body,
			});
		}

		await db.createCustomer({
			username,
			password_hash: bcrypt.hashSync(password, 10),
			name,
			email,
			phone,
			aadhar,
			address: address || null,
			active: true,
		});

		res.redirect('/customer/login?registered=1');
	} catch (err) {
		return res.render('customer/register', {
			title: 'Customer Registration',
			error: 'Registration failed. Username, email, or Aadhar may already exist.',
			form: req.body,
		});
	}
});

router.get('/login', (req, res) => {
	const registered = req.query.registered === '1';
	const redirect = req.query.redirect;
	res.render('customer/login', { title: 'Customer Login', error: null, registered, redirect });
});

router.post('/login', async (req, res, next) => {
	const { username, password } = req.body;
	try {
		const customer = await db.getCustomerByUsername(username);
		if (!customer || !bcrypt.compareSync(password, customer.password_hash)) {
			return res.render('customer/login', {
				title: 'Customer Login',
				error: 'Invalid username or password',
				registered: false,
				redirect: req.query.redirect,
			});
		}

		req.session.customer = {
			id: customer.id,
			name: customer.name,
			username: customer.username,
		};

		let redirect = '/';
		if (req.query.redirect === 'book' || req.query.redirect === '/book') {
			redirect = req.query.room_id ? `/book?room_id=${req.query.room_id}` : '/book';
		} else if (req.session.bookingRedirect) {
			redirect = req.session.bookingRedirect;
		}
		delete req.session.bookingRedirect;
		res.redirect(redirect);
	} catch (error) {
		next(error);
	}
});

function requireCustomer(req, res, next) {
	if (!req.session.customer) return res.redirect('/customer/login');
	next();
}

router.get('/dashboard', requireCustomer, async (req, res, next) => {
	try {
		const customer = req.session.customer;
		const reservations = await db.listCustomerReservations(customer.id);
		res.render('customer/dashboard', { title: 'My Reservations', reservations, customer, dayjs });
	} catch (error) {
		next(error);
	}
});

router.post('/reservation/:id/cancel', requireCustomer, async (req, res, next) => {
	try {
		const customer = req.session.customer;
		const reservation = await db.getReservationRaw(req.params.id);
		if (!reservation || Number(reservation.customer_id) !== Number(customer.id)) {
			return res.status(404).redirect('/customer/dashboard');
		}
		if (reservation.status === 'booked') {
			await db.updateReservation(reservation.id, { status: 'cancelled' });
		}
		res.redirect('/customer/dashboard');
	} catch (error) {
		next(error);
	}
});

router.post('/service-request', requireCustomer, async (req, res, next) => {
	try {
		const { reservation_id, service_type, request_details } = req.body;
		const customer = req.session.customer;
		const reservation = await db.getReservationRaw(reservation_id);

		if (
			reservation &&
			reservation.status === 'checked_in' &&
			Number(reservation.customer_id) === Number(customer.id)
		) {
			await db.createServiceRequest({
				reservation_id,
				service_type,
				request_details: request_details || null,
				status: 'pending',
			});
		}

		res.redirect('/customer/dashboard');
	} catch (error) {
		next(error);
	}
});

router.post('/logout', (req, res) => {
	req.session.customer = null;
	res.redirect('/');
});

module.exports = router;
