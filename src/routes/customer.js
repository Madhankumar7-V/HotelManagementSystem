const express = require('express');
const bcrypt = require('bcryptjs');
const dayjs = require('dayjs');
const { db } = require('../db');

const router = express.Router();

function requireCustomer(req, res, next) {
	if (!req.session.customer) return res.redirect('/customer/login');
	next();
}

function normalizePhone(phone) {
	return String(phone || '').replace(/\D/g, '').slice(0, 10);
}

router.get('/register', (req, res) => {
	res.render('customer/register', { title: 'Customer Registration', error: null, form: {} });
});

router.post('/register', async (req, res) => {
	const { password, confirm_password, name, email, aadhar, address } = req.body;
	const phone = normalizePhone(req.body.phone);

	if (!password || !name || !email || !phone || !aadhar) {
		return res.render('customer/register', {
			title: 'Customer Registration',
			error: 'All mandatory fields are required',
			form: { ...req.body, phone },
		});
	}

	if (password !== confirm_password) {
		return res.render('customer/register', {
			title: 'Customer Registration',
			error: 'Passwords do not match',
			form: { ...req.body, phone },
		});
	}

	if (password.length < 6) {
		return res.render('customer/register', {
			title: 'Customer Registration',
			error: 'Password must be at least 6 characters',
			form: { ...req.body, phone },
		});
	}

	if (!/^\d{12}$/.test(aadhar)) {
		return res.render('customer/register', {
			title: 'Customer Registration',
			error: 'Aadhar number must be exactly 12 digits',
			form: { ...req.body, phone },
		});
	}

	if (!/^\d{10}$/.test(phone)) {
		return res.render('customer/register', {
			title: 'Customer Registration',
			error: 'Phone number must be exactly 10 digits',
			form: { ...req.body, phone },
		});
	}

	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		return res.render('customer/register', {
			title: 'Customer Registration',
			error: 'Invalid email format',
			form: { ...req.body, phone },
		});
	}

	try {
		const existingUser = await db.findExistingCustomer({ phone, email, aadhar });
		if (existingUser) {
			return res.render('customer/register', {
				title: 'Customer Registration',
				error: 'Mobile number, email, or Aadhar number already exists',
				form: { ...req.body, phone },
			});
		}

		await db.createCustomer({
			username: phone,
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
			error: 'Registration failed. Mobile number, email, or Aadhar may already exist.',
			form: { ...req.body, phone },
		});
	}
});

router.get('/login', (req, res) => {
	const registered = req.query.registered === '1';
	const redirect = req.query.redirect;
	res.render('customer/login', { title: 'Customer Login', error: null, registered, redirect });
});

router.post('/login', async (req, res, next) => {
	const phone = normalizePhone(req.body.phone || req.body.username);
	const { password } = req.body;
	try {
		const customer =
			(await db.getCustomerByPhone(phone)) || (await db.getCustomerByUsername(phone));

		if (!customer || !bcrypt.compareSync(password, customer.password_hash)) {
			return res.render('customer/login', {
				title: 'Customer Login',
				error: 'Invalid mobile number or password',
				registered: false,
				redirect: req.query.redirect,
			});
		}

		req.session.customer = {
			id: customer.id,
			name: customer.name,
			username: customer.username,
			phone: customer.phone,
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

router.get('/dashboard', requireCustomer, async (req, res, next) => {
	try {
		const customer = req.session.customer;
		const reservations = await db.listCustomerReservations(customer.id);
		res.render('customer/dashboard', { title: 'My Reservations', reservations, customer, dayjs });
	} catch (error) {
		next(error);
	}
});

router.get('/profile', requireCustomer, async (req, res, next) => {
	try {
		const profile = await db.getCustomerById(req.session.customer.id);
		if (!profile) return res.redirect('/customer/login');
		res.render('customer/profile', {
			title: 'My Details',
			profile,
			error: null,
			success: req.query.updated === '1',
		});
	} catch (error) {
		next(error);
	}
});

router.post('/profile', requireCustomer, async (req, res, next) => {
	try {
		const current = await db.getCustomerById(req.session.customer.id);
		if (!current) return res.redirect('/customer/login');

		const { name, email, aadhar, address, password, confirm_password } = req.body;
		const phone = normalizePhone(req.body.phone);

		if (!name || !email || !phone || !aadhar) {
			return res.render('customer/profile', {
				title: 'My Details',
				profile: { ...current, ...req.body, phone },
				error: 'Name, email, phone, and Aadhar are required',
				success: false,
			});
		}

		if (!/^\d{10}$/.test(phone)) {
			return res.render('customer/profile', {
				title: 'My Details',
				profile: { ...current, ...req.body, phone },
				error: 'Phone number must be exactly 10 digits',
				success: false,
			});
		}

		if (!/^\d{12}$/.test(aadhar)) {
			return res.render('customer/profile', {
				title: 'My Details',
				profile: { ...current, ...req.body, phone },
				error: 'Aadhar number must be exactly 12 digits',
				success: false,
			});
		}

		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			return res.render('customer/profile', {
				title: 'My Details',
				profile: { ...current, ...req.body, phone },
				error: 'Invalid email format',
				success: false,
			});
		}

		if (password || confirm_password) {
			if (password.length < 6) {
				return res.render('customer/profile', {
					title: 'My Details',
					profile: { ...current, ...req.body, phone },
					error: 'New password must be at least 6 characters',
					success: false,
				});
			}
			if (password !== confirm_password) {
				return res.render('customer/profile', {
					title: 'My Details',
					profile: { ...current, ...req.body, phone },
					error: 'Passwords do not match',
					success: false,
				});
			}
		}

		const existing = await db.findExistingCustomer({
			phone,
			email,
			aadhar,
			excludeId: current.id,
		});
		if (existing) {
			return res.render('customer/profile', {
				title: 'My Details',
				profile: { ...current, ...req.body, phone },
				error: 'Mobile number, email, or Aadhar is already used by another account',
				success: false,
			});
		}

		const payload = {
			name,
			email,
			phone,
			username: phone,
			aadhar,
			address: address || null,
		};
		if (password) {
			payload.password_hash = bcrypt.hashSync(password, 10);
		}

		const updated = await db.updateCustomer(current.id, payload);
		req.session.customer = {
			id: updated.id,
			name: updated.name,
			username: updated.username,
			phone: updated.phone,
		};

		res.redirect('/customer/profile?updated=1');
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
