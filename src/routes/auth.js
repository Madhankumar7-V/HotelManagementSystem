const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../db');

const router = express.Router();

router.get('/login', (req, res) => {
	res.render('auth/login', { title: 'Login' });
});

router.post('/login', (req, res) => {
	const { username, password } = req.body;
	const db = getDb();
	const user = db.prepare('SELECT * FROM staff WHERE username = ? AND active = 1').get(username);
	if (!user) return res.render('auth/login', { title: 'Login', error: 'Invalid credentials' });
	const ok = bcrypt.compareSync(password, user.password_hash);
	if (!ok) return res.render('auth/login', { title: 'Login', error: 'Invalid credentials' });
	req.session.user = { id: user.id, name: user.name, role: user.role };
	if (user.role === 'admin') return res.redirect('/admin');
	return res.redirect('/reception');
});

router.post('/logout', (req, res) => {
	req.session.destroy(() => res.redirect('/'));
});

module.exports = router;


