-- Madhan Hotel · Supabase schema
-- Run once in: Supabase Dashboard → SQL Editor → New query → Run

DROP VIEW IF EXISTS v_kpis;
DROP TABLE IF EXISTS service_requests CASCADE;
DROP TABLE IF EXISTS assignments CASCADE;
DROP TABLE IF EXISTS reservations CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS staff CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;

CREATE TABLE rooms (
	id BIGSERIAL PRIMARY KEY,
	number TEXT UNIQUE NOT NULL,
	type TEXT NOT NULL,
	capacity INTEGER NOT NULL CHECK (capacity > 0),
	price_per_night INTEGER NOT NULL CHECK (price_per_night >= 0),
	status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'maintenance')),
	image_url TEXT,
	description TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE staff (
	id BIGSERIAL PRIMARY KEY,
	name TEXT NOT NULL,
	role TEXT NOT NULL CHECK (role IN ('admin', 'receptionist', 'housekeeper')),
	username TEXT UNIQUE NOT NULL,
	password_hash TEXT NOT NULL,
	active BOOLEAN NOT NULL DEFAULT TRUE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- username is always the 10-digit mobile number
CREATE TABLE customers (
	id BIGSERIAL PRIMARY KEY,
	username TEXT UNIQUE NOT NULL,
	password_hash TEXT NOT NULL,
	name TEXT NOT NULL,
	email TEXT UNIQUE NOT NULL,
	phone TEXT UNIQUE NOT NULL,
	aadhar TEXT UNIQUE NOT NULL,
	address TEXT,
	active BOOLEAN NOT NULL DEFAULT TRUE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE reservations (
	id BIGSERIAL PRIMARY KEY,
	customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
	customer_name TEXT NOT NULL,
	customer_email TEXT,
	customer_phone TEXT,
	room_id BIGINT NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
	check_in DATE NOT NULL,
	check_out DATE NOT NULL,
	status TEXT NOT NULL DEFAULT 'booked'
		CHECK (status IN ('booked', 'checked_in', 'checked_out', 'cancelled')),
	payment_method TEXT NOT NULL DEFAULT 'upi_qr',
	payment_status TEXT NOT NULL DEFAULT 'submitted'
		CHECK (payment_status IN ('due', 'submitted', 'confirmed', 'paid')),
	payment_txn_id TEXT,
	payment_proof_path TEXT,
	booking_reference TEXT UNIQUE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CHECK (check_out > check_in)
);

CREATE TABLE assignments (
	id BIGSERIAL PRIMARY KEY,
	staff_id BIGINT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
	room_id BIGINT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
	assignment_date DATE NOT NULL
);

CREATE TABLE service_requests (
	id BIGSERIAL PRIMARY KEY,
	reservation_id BIGINT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
	service_type TEXT NOT NULL CHECK (service_type IN ('room_service', 'housecleaning')),
	request_details TEXT,
	status TEXT NOT NULL DEFAULT 'pending'
		CHECK (status IN ('pending', 'in_progress', 'completed')),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	completed_at TIMESTAMPTZ
);

CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_reservations_room_dates ON reservations(room_id, check_in, check_out);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_customer ON reservations(customer_id);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_service_requests_status ON service_requests(status);

CREATE OR REPLACE VIEW v_kpis AS
SELECT
	r.check_in AS day,
	COUNT(*) FILTER (WHERE r.status IN ('booked', 'checked_in')) AS bookings,
	COUNT(*) FILTER (WHERE r.status = 'checked_in') AS occupied,
	COALESCE(
		SUM(CASE WHEN r.status IN ('booked', 'checked_in') THEN rm.price_per_night ELSE 0 END),
		0
	) AS revenue
FROM reservations r
JOIN rooms rm ON rm.id = r.room_id
GROUP BY r.check_in;

INSERT INTO rooms (number, type, capacity, price_per_night, status, image_url, description) VALUES
	(
		'101',
		'Standard',
		2,
		2400,
		'available',
		'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1400&q=80',
		'Cozy standard room with soft lighting, queen bed, and essential comforts for a restful stay.'
	),
	(
		'102',
		'Standard',
		2,
		2400,
		'available',
		'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1400&q=80',
		'Bright twin-ready standard room with clean finishes and a calm city-stay vibe.'
	),
	(
		'201',
		'Deluxe',
		3,
		4200,
		'available',
		'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1400&q=80',
		'Spacious deluxe room with premium bedding, work desk, and a more elevated guest experience.'
	),
	(
		'301',
		'Suite',
		4,
		6800,
		'available',
		'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1400&q=80',
		'Premium suite with lounge space, refined interiors, and room to unwind in style.'
	);

INSERT INTO staff (name, role, username, password_hash, active) VALUES
	('Administrator', 'admin', 'admin', '$2b$10$018R9JtZA.fn5KlBHoA8se/YWXlQkMLvXoHzmKV34fDs6KegkwGYG', TRUE),
	('Front Desk', 'receptionist', 'reception', '$2b$10$nnR3idVxLp./NmQL2R8GZupYINx7dQrl6NNq3fu0YjD0zUUhm1chy', TRUE);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;
