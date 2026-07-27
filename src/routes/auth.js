const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');

const router = express.Router();

router.get('/login', (req, res) => {
	res.render('auth/login', { title: 'Login' });
});

router.post('/login', async (req, res, next) => {
	const { username, password } = req.body;
	try {
		const user = await db.getStaffByUsername(username);
		if (!user || !bcrypt.compareSync(password, user.password_hash)) {
			return res.render('auth/login', { title: 'Login', error: 'Invalid credentials' });
		}
		req.session.user = { id: user.id, name: user.name, role: user.role };
		if (user.role === 'admin') return res.redirect('/admin');
		return res.redirect('/reception');
	} catch (error) {
		next(error);
	}
});

router.post('/logout', (req, res) => {
	req.session = null;
	res.redirect('/');
});

module.exports = router;
