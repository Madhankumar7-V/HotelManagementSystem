const path = require('path');
const express = require('express');
const session = require('express-session');
const ejsLayouts = require('express-ejs-layouts');
const methodOverride = require('method-override');
const morgan = require('morgan');
const dayjs = require('dayjs');
const fs = require('fs');
const pgSession = require('connect-pg-simple')(session);

const { config } = require('./src/config');
const { getDb, initDb } = require('./src/db');

const app = express();

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));
app.use(ejsLayouts);
app.set('layout', 'layout');

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(morgan('dev'));
app.use(
	session({
		store: new pgSession({
			pool: getDb(),
			tableName: 'session',
			createTableIfMissing: true,
		}),
		secret: config.sessionSecret,
		resave: false,
		saveUninitialized: false,
		cookie: {
			maxAge: 1000 * 60 * 60 * 24 * 7,
			httpOnly: true,
			sameSite: 'lax',
			secure: config.isProduction,
		},
	})
);
app.use('/static', express.static(path.join(__dirname, 'src', 'public')));
const uploadsDir = config.uploadDir;
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Locals for views
app.use((req, res, next) => {
	res.locals.session = req.session;
	res.locals.now = () => dayjs();
	res.locals.appConfig = config;
	next();
});

// Routes
const publicRoutes = require('./src/routes/public');
const authRoutes = require('./src/routes/auth');
const customerRoutes = require('./src/routes/customer');
const receptionRoutes = require('./src/routes/reception');
const adminRoutes = require('./src/routes/admin');

app.use('/', publicRoutes);
app.use('/auth', authRoutes);
app.use('/customer', customerRoutes);
app.use('/reception', receptionRoutes);
app.use('/admin', adminRoutes);

// 404
app.use((req, res) => {
	res.status(404).render('404', { title: 'Not Found' });
});

app.use((err, req, res, next) => {
	console.error(err);
	if (res.headersSent) return next(err);
	return res.status(500).render('404', {
		title: 'Server Error',
	});
});

const initPromise = initDb();

app.use((req, res, next) => {
	initPromise.then(() => next()).catch(next);
});

if (require.main === module) {
	initPromise
		.then(() => {
			app.listen(config.port, () => {
				console.log(`Server running on http://localhost:${config.port}`);
			});
		})
		.catch((error) => {
			console.error('Failed to initialize database', error);
			process.exit(1);
		});
}

module.exports = app;
