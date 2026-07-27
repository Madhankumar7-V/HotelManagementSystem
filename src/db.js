const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { config } = require('./config');

let pool;
let initPromise;

function getDb() {
	if (!config.databaseUrl) {
		throw new Error('DATABASE_URL is required. Add your Supabase Postgres connection string to .env.');
	}

	if (!pool) {
		pool = new Pool({
			connectionString: config.databaseUrl,
			ssl: config.isProduction ? { rejectUnauthorized: false } : false,
		});
	}

	return pool;
}

async function query(text, params = []) {
	const db = getDb();
	return db.query(text, params);
}

async function one(text, params = []) {
	const result = await query(text, params);
	return result.rows[0] || null;
}

async function many(text, params = []) {
	const result = await query(text, params);
	return result.rows;
}

async function value(text, params = []) {
	const row = await one(text, params);
	if (!row) return null;
	return Object.values(row)[0];
}

async function initDb() {
	if (initPromise) return initPromise;

	initPromise = (async () => {
		await query(`
			CREATE TABLE IF NOT EXISTS rooms (
				id BIGSERIAL PRIMARY KEY,
				number TEXT UNIQUE NOT NULL,
				type TEXT NOT NULL,
				capacity INTEGER NOT NULL,
				price_per_night INTEGER NOT NULL,
				status TEXT NOT NULL DEFAULT 'available'
			);

			CREATE TABLE IF NOT EXISTS staff (
				id BIGSERIAL PRIMARY KEY,
				name TEXT NOT NULL,
				role TEXT NOT NULL,
				username TEXT UNIQUE NOT NULL,
				password_hash TEXT NOT NULL,
				active BOOLEAN NOT NULL DEFAULT TRUE,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			);

			CREATE TABLE IF NOT EXISTS customers (
				id BIGSERIAL PRIMARY KEY,
				username TEXT UNIQUE NOT NULL,
				password_hash TEXT NOT NULL,
				name TEXT NOT NULL,
				email TEXT UNIQUE NOT NULL,
				phone TEXT NOT NULL,
				aadhar TEXT UNIQUE NOT NULL,
				address TEXT,
				active BOOLEAN NOT NULL DEFAULT TRUE,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			);

			CREATE TABLE IF NOT EXISTS reservations (
				id BIGSERIAL PRIMARY KEY,
				customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
				customer_name TEXT NOT NULL,
				customer_email TEXT,
				customer_phone TEXT,
				room_id BIGINT NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
				check_in DATE NOT NULL,
				check_out DATE NOT NULL,
				status TEXT NOT NULL DEFAULT 'booked',
				payment_method TEXT NOT NULL DEFAULT 'upi_qr',
				payment_status TEXT NOT NULL DEFAULT 'submitted',
				payment_txn_id TEXT,
				payment_proof_path TEXT,
				booking_reference TEXT UNIQUE,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			);

			CREATE TABLE IF NOT EXISTS assignments (
				id BIGSERIAL PRIMARY KEY,
				staff_id BIGINT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
				room_id BIGINT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
				assignment_date DATE NOT NULL
			);

			CREATE TABLE IF NOT EXISTS service_requests (
				id BIGSERIAL PRIMARY KEY,
				reservation_id BIGINT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
				service_type TEXT NOT NULL,
				request_details TEXT,
				status TEXT NOT NULL DEFAULT 'pending',
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				completed_at TIMESTAMPTZ
			);

			CREATE TABLE IF NOT EXISTS session (
				sid varchar NOT NULL PRIMARY KEY,
				sess json NOT NULL,
				expire timestamptz NOT NULL
			);

			CREATE INDEX IF NOT EXISTS idx_session_expire ON session (expire);
		`);

		await query(`
			CREATE OR REPLACE VIEW v_kpis AS
			SELECT
				r.check_in AS day,
				COUNT(*) FILTER (WHERE r.status IN ('booked', 'checked_in')) AS bookings,
				COUNT(*) FILTER (WHERE r.status = 'checked_in') AS occupied,
				COALESCE(SUM(CASE WHEN r.status IN ('booked', 'checked_in') THEN rm.price_per_night ELSE 0 END), 0) AS revenue
			FROM reservations r
			JOIN rooms rm ON rm.id = r.room_id
			GROUP BY r.check_in;
		`);

		const roomCount = Number(await value('SELECT COUNT(*) FROM rooms'));
		if (roomCount === 0) {
			await query(
				`INSERT INTO rooms (number, type, capacity, price_per_night)
				 VALUES
				 	('101', 'Standard', 2, 2400),
				 	('102', 'Standard', 2, 2400),
				 	('201', 'Deluxe', 3, 4200),
				 	('301', 'Suite', 4, 6800)`
			);
		}

		const staffCount = Number(await value('SELECT COUNT(*) FROM staff'));
		if (staffCount === 0) {
			await query(
				`INSERT INTO staff (name, role, username, password_hash)
				 VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)`,
				[
					'Administrator',
					'admin',
					'admin',
					bcrypt.hashSync('admin123', 10),
					'Front Desk',
					'receptionist',
					'reception',
					bcrypt.hashSync('reception123', 10),
				]
			);
		}
	})().catch((error) => {
		initPromise = null;
		throw error;
	});

	return initPromise;
}

module.exports = {
	getDb,
	initDb,
	query,
	one,
	many,
	value,
};


