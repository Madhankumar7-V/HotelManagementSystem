const express = require('express');
const bcrypt = require('bcryptjs');
const { one } = require('../db');

const router = express.Router();

router.get('/login', (req, res) => {
	res.render('auth/login', { title: 'Login' });
});

router.post('/login', async (req, res, next) => {
	const { username, password } = req.body;
	try {
		const user = await one(
			'SELECT * FROM staff WHERE username = $1 AND active = TRUE',
			[username]
		);
		if (!user) return res.render('auth/login', { title: 'Login', error: 'Invalid credentials' });
		const ok = bcrypt.compareSync(password, user.password_hash);
		if (!ok) return res.render('auth/login', { title: 'Login', error: 'Invalid credentials' });
		req.session.user = { id: user.id, name: user.name, role: user.role };
		if (user.role === 'admin') return res.redirect('/admin');
		return res.redirect('/reception');
	} catch (error) {
		next(error);
	}
});

router.post('/logout', (req, res) => {
	req.session.destroy(() => res.redirect('/'));
});

module.exports = router;


