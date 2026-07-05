const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

let dbInstance;

function getDb() {
	if (dbInstance) return dbInstance;
	const dbPath = path.join(__dirname, '..', 'data', 'hotel.db');
	// ensure directory exists
	const dir = path.dirname(dbPath);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
	const db = new Database(dbPath);
	db.pragma('journal_mode = WAL');
	createSchema(db);
	dbInstance = db;
	return dbInstance;
}

function createSchema(db) {
	db.exec(`
	CREATE TABLE IF NOT EXISTS rooms (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		number TEXT UNIQUE NOT NULL,
		type TEXT NOT NULL,
		capacity INTEGER NOT NULL,
		price_per_night INTEGER NOT NULL,
		status TEXT NOT NULL DEFAULT 'available' -- available, maintenance
	);

	CREATE TABLE IF NOT EXISTS reservations (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		customer_name TEXT NOT NULL,
		customer_email TEXT,
		customer_phone TEXT,
		room_id INTEGER NOT NULL,
		check_in DATE NOT NULL,
		check_out DATE NOT NULL,
		status TEXT NOT NULL DEFAULT 'booked', -- booked, checked_in, checked_out, cancelled
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(room_id) REFERENCES rooms(id)
	);

	CREATE TABLE IF NOT EXISTS staff (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		role TEXT NOT NULL, -- receptionist, admin, housekeeper
		username TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL,
		active INTEGER NOT NULL DEFAULT 1
	);

	CREATE TABLE IF NOT EXISTS customers (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL,
		name TEXT NOT NULL,
		email TEXT UNIQUE NOT NULL,
		phone TEXT NOT NULL,
		aadhar TEXT UNIQUE NOT NULL,
		address TEXT,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		active INTEGER NOT NULL DEFAULT 1
	);

	CREATE TABLE IF NOT EXISTS assignments (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		staff_id INTEGER NOT NULL,
		room_id INTEGER NOT NULL,
		assignment_date DATE NOT NULL,
		FOREIGN KEY(staff_id) REFERENCES staff(id),
		FOREIGN KEY(room_id) REFERENCES rooms(id)
	);

	CREATE TABLE IF NOT EXISTS service_requests (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		reservation_id INTEGER NOT NULL,
		service_type TEXT NOT NULL, -- 'room_service', 'housecleaning'
		request_details TEXT,
		status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed'
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		completed_at DATETIME,
		FOREIGN KEY(reservation_id) REFERENCES reservations(id)
	);

	CREATE VIEW IF NOT EXISTS v_kpis AS
	SELECT
		date(r.check_in) as day,
		COUNT(*) FILTER (WHERE r.status IN ('booked','checked_in')) as bookings,
		COUNT(*) FILTER (WHERE r.status = 'checked_in') as occupied,
		SUM(CASE WHEN r.status IN ('booked','checked_in') THEN rm.price_per_night ELSE 0 END) as revenue
	FROM reservations r
	JOIN rooms rm ON rm.id = r.room_id
	GROUP BY day;
	`);

	// Ensure new columns for payments exist on reservations
	const cols = db.prepare("PRAGMA table_info('reservations')").all();
	const colNames = new Set(cols.map(c => c.name));
	if (!colNames.has('customer_phone')) {
		db.exec("ALTER TABLE reservations ADD COLUMN customer_phone TEXT");
	}
	if (!colNames.has('payment_method')) {
		db.exec("ALTER TABLE reservations ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'pay_on_check_in'");
	}
	if (!colNames.has('payment_status')) {
		db.exec("ALTER TABLE reservations ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'due'");
	}
	if (!colNames.has('payment_txn_id')) {
		db.exec("ALTER TABLE reservations ADD COLUMN payment_txn_id TEXT");
	}
	if (!colNames.has('payment_proof_path')) {
		db.exec("ALTER TABLE reservations ADD COLUMN payment_proof_path TEXT");
	}

	// seed minimal data if empty
	const roomCount = db.prepare('SELECT COUNT(*) as c FROM rooms').get().c;
	if (roomCount === 0) {
		const insertRoom = db.prepare(
			`INSERT INTO rooms (number, type, capacity, price_per_night) VALUES (?,?,?,?)`
		);
		const rooms = [
			['101', 'Standard', 2, 80],
			['102', 'Standard', 2, 80],
			['201', 'Deluxe', 3, 120],
			['301', 'Suite', 4, 200]
		];
		const trx = db.transaction((items) => {
			for (const r of items) insertRoom.run(r);
		});
		trx(rooms);
	}

	const staffCount = db.prepare('SELECT COUNT(*) as c FROM staff').get().c;
	if (staffCount === 0) {
		const bcrypt = require('bcryptjs');
		const insertStaff = db.prepare(
			`INSERT INTO staff (name, role, username, password_hash) VALUES (?,?,?,?)`
		);
		const adminPass = bcrypt.hashSync('admin123', 10);
		const recepPass = bcrypt.hashSync('reception123', 10);
		insertStaff.run('Administrator', 'admin', 'admin', adminPass);
		insertStaff.run('Front Desk', 'receptionist', 'reception', recepPass);
	}
}

module.exports = { getDb };


