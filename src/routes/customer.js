const express = require('express');
const bcrypt = require('bcryptjs');
const dayjs = require('dayjs');
const { many, one, query } = require('../db');

const router = express.Router();

// Customer Registration
router.get('/register', (req, res) => {
	res.render('customer/register', { title: 'Customer Registration', error: null, form: {} });
});

router.post('/register', async (req, res, next) => {
	const { username, password, confirm_password, name, email, phone, aadhar, address } = req.body;
	
	// Validation
	if (!username || !password || !name || !email || !phone || !aadhar) {
		return res.render('customer/register', {
			title: 'Customer Registration',
			error: 'All mandatory fields are required',
			form: req.body
		});
	}

	if (password !== confirm_password) {
		return res.render('customer/register', {
			title: 'Customer Registration',
			error: 'Passwords do not match',
			form: req.body
		});
	}

	if (password.length < 6) {
		return res.render('customer/register', {
			title: 'Customer Registration',
			error: 'Password must be at least 6 characters',
			form: req.body
		});
	}

	// Validate Aadhar (12 digits)
	if (!/^\d{12}$/.test(aadhar)) {
		return res.render('customer/register', {
			title: 'Customer Registration',
			error: 'Aadhar number must be exactly 12 digits',
			form: req.body
		});
	}

	// Validate phone (10 digits)
	if (!/^\d{10}$/.test(phone)) {
		return res.render('customer/register', {
			title: 'Customer Registration',
			error: 'Phone number must be exactly 10 digits',
			form: req.body
		});
	}

	// Validate email
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		return res.render('customer/register', {
			title: 'Customer Registration',
			error: 'Invalid email format',
			form: req.body
		});
	}

	try {
		const existingUser = await one(
			'SELECT id FROM customers WHERE username = $1 OR email = $2 OR aadhar = $3',
			[username, email, aadhar]
		);
		if (existingUser) {
			return res.render('customer/register', {
				title: 'Customer Registration',
				error: 'Username, email, or Aadhar number already exists',
				form: req.body
			});
		}

		const passwordHash = bcrypt.hashSync(password, 10);
		await query(
			`INSERT INTO customers (username, password_hash, name, email, phone, aadhar, address)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			[username, passwordHash, name, email, phone, aadhar, address || null]
		);
		res.redirect('/customer/login?registered=1');
	} catch (err) {
		return res.render('customer/register', {
			title: 'Customer Registration',
			error: 'Registration failed. Username, email, or Aadhar may already exist.',
			form: req.body
		});
	}
});

// Customer Login
router.get('/login', (req, res) => {
	const registered = req.query.registered === '1';
	const redirect = req.query.redirect;
	res.render('customer/login', { title: 'Customer Login', error: null, registered, redirect });
});

router.post('/login', async (req, res, next) => {
	const { username, password } = req.body;
	try {
		const customer = await one(
			'SELECT * FROM customers WHERE username = $1 AND active = TRUE',
			[username]
		);
		if (!customer) {
			return res.render('customer/login', {
				title: 'Customer Login',
				error: 'Invalid username or password',
				registered: false,
				redirect: req.query.redirect,
			});
		}

		const ok = bcrypt.compareSync(password, customer.password_hash);
		if (!ok) {
			return res.render('customer/login', {
				title: 'Customer Login',
				error: 'Invalid username or password',
				registered: false,
				redirect: req.query.redirect,
			});
		}

		req.session.customer = { id: customer.id, name: customer.name, username: customer.username };

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

// Customer Dashboard - View Reservations
function requireCustomer(req, res, next) {
	if (!req.session.customer) {
		return res.redirect('/customer/login');
	}
	next();
}

router.get('/dashboard', requireCustomer, async (req, res, next) => {
	const customer = req.session.customer;
	try {
		const reservations = await many(
			`SELECT r.*, rm.number AS room_number, rm.type AS room_type, rm.price_per_night
			 FROM reservations r
			 JOIN rooms rm ON rm.id = r.room_id
			 WHERE r.customer_id = $1
			 ORDER BY r.created_at DESC`,
			[customer.id]
		);

		res.render('customer/dashboard', { title: 'My Reservations', reservations, customer, dayjs });
	} catch (error) {
		next(error);
	}
});

// Cancel Booking
router.post('/reservation/:id/cancel', requireCustomer, async (req, res, next) => {
	const customer = req.session.customer;
	try {
		const reservation = await one(
			'SELECT * FROM reservations WHERE id = $1 AND customer_id = $2',
			[req.params.id, customer.id]
		);
		if (!reservation) {
			return res.status(404).redirect('/customer/dashboard');
		}

		if (reservation.status === 'booked') {
			await query("UPDATE reservations SET status = 'cancelled' WHERE id = $1", [reservation.id]);
		}

		res.redirect('/customer/dashboard');
	} catch (error) {
		next(error);
	}
});

// Service Request
router.post('/service-request', requireCustomer, async (req, res, next) => {
	const { reservation_id, service_type, request_details } = req.body;
	const customer = req.session.customer;

	try {
		const reservation = await one(
			`SELECT * FROM reservations
			 WHERE id = $1 AND status = 'checked_in' AND customer_id = $2`,
			[reservation_id, customer.id]
		);

		if (reservation) {
			await query(
				'INSERT INTO service_requests (reservation_id, service_type, request_details) VALUES ($1, $2, $3)',
				[reservation_id, service_type, request_details || null]
			);
		}

		res.redirect('/customer/dashboard');
	} catch (error) {
		next(error);
	}
});

// Customer Logout
router.post('/logout', (req, res) => {
	req.session.customer = null;
	res.redirect('/');
});

module.exports = router;

