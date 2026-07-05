const path = require('path');
const express = require('express');
const session = require('express-session');
const ejsLayouts = require('express-ejs-layouts');
const methodOverride = require('method-override');
const morgan = require('morgan');
const dayjs = require('dayjs');
const fs = require('fs');

const { getDb } = require('./src/db');

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
		secret: 'replace-this-secret',
		resave: false,
		saveUninitialized: false,
		cookie: { maxAge: 1000 * 60 * 60 * 8 },
	})
);
app.use('/static', express.static(path.join(__dirname, 'src', 'public')));
// uploads (payment proofs)
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Locals for views
app.use((req, res, next) => {
	res.locals.session = req.session;
	res.locals.now = () => dayjs();
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

const PORT = process.env.PORT || 3000;

// Ensure DB initialized before start
getDb();

app.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});


