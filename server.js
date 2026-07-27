const path = require('path');
const express = require('express');
const cookieSession = require('cookie-session');
const ejsLayouts = require('express-ejs-layouts');
const methodOverride = require('method-override');
const morgan = require('morgan');
const dayjs = require('dayjs');
const fs = require('fs');

const { config } = require('./src/config');

const app = express();

if (config.isProduction) {
	app.set('trust proxy', 1);
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));
app.use(ejsLayouts);
app.set('layout', 'layout');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(morgan('dev'));

app.use(
	cookieSession({
		name: 'madhan_hotel_session',
		keys: [config.sessionSecret],
		maxAge: 1000 * 60 * 60 * 24 * 7,
		httpOnly: true,
		sameSite: 'lax',
		secure: config.isProduction,
	})
);

app.use('/static', express.static(path.join(__dirname, 'src', 'public')));
const uploadsDir = config.uploadDir;
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

app.use((req, res, next) => {
	res.locals.session = req.session;
	res.locals.now = () => dayjs();
	res.locals.appConfig = config;
	next();
});

app.use((req, res, next) => {
	if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
		return res.status(500).send(`
			<!DOCTYPE html>
			<html><head><meta charset="utf-8"><title>Config Error</title>
			<style>body{font-family:system-ui;padding:40px;max-width:720px;margin:auto;line-height:1.5}
			code{background:#f4f4f4;padding:2px 6px;border-radius:4px}</style></head>
			<body>
				<h1>Missing Supabase environment variables</h1>
				<p>Add these in <strong>Vercel → Project → Settings → Environment Variables</strong>, then redeploy:</p>
				<ul>
					<li><code>SUPABASE_URL</code></li>
					<li><code>SUPABASE_SERVICE_ROLE_KEY</code></li>
					<li><code>SESSION_SECRET</code></li>
					<li><code>VITE_UPI_ID</code> / <code>VITE_UPI_NAME</code></li>
				</ul>
				<p>Also run <code>supabase/schema.sql</code> once in the Supabase SQL Editor.</p>
			</body></html>
		`);
	}
	next();
});

app.use('/', require('./src/routes/public'));
app.use('/auth', require('./src/routes/auth'));
app.use('/customer', require('./src/routes/customer'));
app.use('/reception', require('./src/routes/reception'));
app.use('/admin', require('./src/routes/admin'));

app.use((req, res) => {
	res.status(404).render('404', { title: 'Not Found' });
});

app.use((err, req, res, next) => {
	console.error(err);
	if (res.headersSent) return next(err);
	return res.status(500).render('404', { title: 'Server Error' });
});

if (require.main === module) {
	app.listen(config.port, () => {
		console.log(`Server running on http://localhost:${config.port}`);
	});
}

module.exports = app;
