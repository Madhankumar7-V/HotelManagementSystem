const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../db');

const router = express.Router();

// Customer Registration
router.get('/register', (req, res) => {
	res.render('customer/register', { title: 'Customer Registration', error: null, form: {} });
});

router.post('/register', (req, res) => {
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

	const db = getDb();
	
	// Check if username already exists
	const existingUser = db.prepare('SELECT id FROM customers WHERE username = ? OR email = ? OR aadhar = ?').get(username, email, aadhar);
	if (existingUser) {
		return res.render('customer/register', {
			title: 'Customer Registration',
			error: 'Username, email, or Aadhar number already exists',
			form: req.body
		});
	}

	// Hash password and insert
	const passwordHash = bcrypt.hashSync(password, 10);
	try {
		const stmt = db.prepare(
			'INSERT INTO customers (username, password_hash, name, email, phone, aadhar, address) VALUES (?, ?, ?, ?, ?, ?, ?)'
		);
		stmt.run(username, passwordHash, name, email, phone, aadhar, address || null);
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

router.post('/login', (req, res) => {
	const { username, password } = req.body;
	const db = getDb();
	const customer = db.prepare('SELECT * FROM customers WHERE username = ? AND active = 1').get(username);
	
	if (!customer) {
		return res.render('customer/login', {
			title: 'Customer Login',
			error: 'Invalid username or password',
			registered: false
		});
	}
	
	const ok = bcrypt.compareSync(password, customer.password_hash);
	if (!ok) {
		return res.render('customer/login', {
			title: 'Customer Login',
			error: 'Invalid username or password',
			registered: false
		});
	}
	
	req.session.customer = { id: customer.id, name: customer.name, username: customer.username };
	
	// Redirect to booking page if they were trying to book
	let redirect = '/';
	if (req.query.redirect === 'book' || req.query.redirect === '/book') {
		// If room_id is provided, include it
		if (req.query.room_id) {
			redirect = `/book?room_id=${req.query.room_id}`;
		} else {
			redirect = '/book';
		}
	} else if (req.session.bookingRedirect) {
		redirect = req.session.bookingRedirect;
	}
	delete req.session.bookingRedirect;
	res.redirect(redirect);
});

// Customer Dashboard - View Reservations
function requireCustomer(req, res, next) {
	if (!req.session.customer) {
		return res.redirect('/customer/login');
	}
	next();
}

router.get('/dashboard', requireCustomer, (req, res) => {
	const db = getDb();
	const customer = req.session.customer;
	
	// Get customer's reservations
	const reservations = db
		.prepare(
			`SELECT r.*, rm.number as room_number, rm.type as room_type, rm.price_per_night
			 FROM reservations r
			 JOIN rooms rm ON rm.id = r.room_id
			 WHERE (r.customer_email = (SELECT email FROM customers WHERE id = ?) 
			        OR r.customer_phone = (SELECT phone FROM customers WHERE id = ?))
			 ORDER BY r.created_at DESC`
		)
		.all(customer.id, customer.id);
	
	res.render('customer/dashboard', { title: 'My Reservations', reservations, customer, dayjs: require('dayjs') });
});

// Cancel Booking
router.post('/reservation/:id/cancel', requireCustomer, (req, res) => {
	const db = getDb();
	const customer = req.session.customer;
	
	// Verify this reservation belongs to the customer
	const reservation = db
		.prepare(
			`SELECT r.* FROM reservations r
			 WHERE r.id = ? 
			 AND (r.customer_email = (SELECT email FROM customers WHERE id = ?) 
			      OR r.customer_phone = (SELECT phone FROM customers WHERE id = ?))`
		)
		.get(req.params.id, customer.id, customer.id);
	
	if (!reservation) {
		return res.status(404).redirect('/customer/dashboard');
	}
	
	if (reservation.status === 'booked') {
		db.prepare("UPDATE reservations SET status = 'cancelled' WHERE id = ?").run(reservation.id);
		db.prepare("UPDATE rooms SET status='available' WHERE id = ?").run(reservation.room_id);
	}
	
	res.redirect('/customer/dashboard');
});

// Service Request
router.post('/service-request', requireCustomer, (req, res) => {
	const { reservation_id, service_type, request_details } = req.body;
	const db = getDb();
	const customer = req.session.customer;
	
	// Verify reservation belongs to customer and is checked in
	const reservation = db
		.prepare(
			`SELECT r.* FROM reservations r
			 WHERE r.id = ? AND r.status = 'checked_in'
			 AND (r.customer_email = (SELECT email FROM customers WHERE id = ?) 
			      OR r.customer_phone = (SELECT phone FROM customers WHERE id = ?))`
		)
		.get(reservation_id, customer.id, customer.id);
	
	if (reservation) {
		db.prepare(
			'INSERT INTO service_requests (reservation_id, service_type, request_details) VALUES (?, ?, ?)'
		).run(reservation_id, service_type, request_details || null);
	}
	
	res.redirect('/customer/dashboard');
});

// Customer Logout
router.post('/logout', (req, res) => {
	req.session.customer = null;
	res.redirect('/');
});

module.exports = router;

