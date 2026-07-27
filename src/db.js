const { createClient } = require('@supabase/supabase-js');
const { config } = require('./config');

let supabase;

function getSupabase() {
	if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
		throw new Error(
			'Missing Supabase env vars. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.'
		);
	}

	if (!supabase) {
		supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
			auth: {
				persistSession: false,
				autoRefreshToken: false,
			},
		});
	}

	return supabase;
}

function assertOk(error, context = 'Supabase query') {
	if (error) {
		const err = new Error(`${context}: ${error.message}`);
		err.cause = error;
		throw err;
	}
}

function withRoom(reservation) {
	if (!reservation) return null;
	const room = reservation.rooms || {};
	const { rooms, ...rest } = reservation;
	return {
		...rest,
		room_number: room.number,
		room_type: room.type,
		price_per_night: room.price_per_night,
		room_image_url: room.image_url,
		room_description: room.description,
	};
}

const db = {
	getSupabase,

	async listAvailableRooms() {
		const { data, error } = await getSupabase()
			.from('rooms')
			.select('*')
			.eq('status', 'available')
			.order('number');
		assertOk(error, 'listAvailableRooms');
		return data || [];
	},

	async listRooms() {
		const { data, error } = await getSupabase().from('rooms').select('*').order('number');
		assertOk(error, 'listRooms');
		return data || [];
	},

	async getCustomerById(id) {
		const { data, error } = await getSupabase()
			.from('customers')
			.select('*')
			.eq('id', id)
			.maybeSingle();
		assertOk(error, 'getCustomerById');
		return data;
	},

	async getCustomerByUsername(username) {
		const { data, error } = await getSupabase()
			.from('customers')
			.select('*')
			.eq('username', username)
			.eq('active', true)
			.maybeSingle();
		assertOk(error, 'getCustomerByUsername');
		return data;
	},

	async getCustomerByPhone(phone) {
		const { data, error } = await getSupabase()
			.from('customers')
			.select('*')
			.eq('phone', phone)
			.eq('active', true)
			.maybeSingle();
		assertOk(error, 'getCustomerByPhone');
		return data;
	},

	async findExistingCustomer({ phone, email, aadhar, excludeId = null }) {
		const checks = await Promise.all([
			getSupabase().from('customers').select('id').eq('phone', phone).maybeSingle(),
			getSupabase().from('customers').select('id').eq('username', phone).maybeSingle(),
			getSupabase().from('customers').select('id').eq('email', email).maybeSingle(),
			getSupabase().from('customers').select('id').eq('aadhar', aadhar).maybeSingle(),
		]);

		for (const result of checks) {
			assertOk(result.error, 'findExistingCustomer');
			if (result.data && Number(result.data.id) !== Number(excludeId)) {
				return result.data;
			}
		}
		return null;
	},

	async updateCustomer(id, payload) {
		const { data, error } = await getSupabase()
			.from('customers')
			.update(payload)
			.eq('id', id)
			.select('*')
			.single();
		assertOk(error, 'updateCustomer');
		return data;
	},

	async createCustomer(payload) {
		const { data, error } = await getSupabase()
			.from('customers')
			.insert(payload)
			.select('id')
			.single();
		assertOk(error, 'createCustomer');
		return data;
	},

	async getStaffByUsername(username) {
		const { data, error } = await getSupabase()
			.from('staff')
			.select('*')
			.eq('username', username)
			.eq('active', true)
			.maybeSingle();
		assertOk(error, 'getStaffByUsername');
		return data;
	},

	async listStaff() {
		const { data, error } = await getSupabase()
			.from('staff')
			.select('id, name, role, username, active, created_at')
			.order('role')
			.order('name');
		assertOk(error, 'listStaff');
		return data || [];
	},

	async createStaff(payload) {
		const { error } = await getSupabase().from('staff').insert(payload);
		assertOk(error, 'createStaff');
	},

	async getStaffById(id) {
		const { data, error } = await getSupabase()
			.from('staff')
			.select('*')
			.eq('id', id)
			.maybeSingle();
		assertOk(error, 'getStaffById');
		return data;
	},

	async updateStaff(id, payload) {
		const { error } = await getSupabase().from('staff').update(payload).eq('id', id);
		assertOk(error, 'updateStaff');
	},

	async createRoom(payload) {
		const { error } = await getSupabase().from('rooms').insert(payload);
		assertOk(error, 'createRoom');
	},

	async updateRoom(id, payload) {
		const { error } = await getSupabase().from('rooms').update(payload).eq('id', id);
		assertOk(error, 'updateRoom');
	},

	async countOverlappingReservations(roomId, checkIn, checkOut) {
		const { data, error } = await getSupabase()
			.from('reservations')
			.select('id, check_in, check_out, status')
			.eq('room_id', roomId)
			.in('status', ['booked', 'checked_in']);
		assertOk(error, 'countOverlappingReservations');

		const start = new Date(checkIn);
		const end = new Date(checkOut);
		const overlaps = (data || []).filter((row) => {
			const rowStart = new Date(row.check_in);
			const rowEnd = new Date(row.check_out);
			return !(rowEnd <= start || rowStart >= end);
		});
		return overlaps.length;
	},

	async createReservation(payload) {
		const { data, error } = await getSupabase()
			.from('reservations')
			.insert(payload)
			.select('id')
			.single();
		assertOk(error, 'createReservation');
		return data;
	},

	async getReservationById(id) {
		const { data, error } = await getSupabase()
			.from('reservations')
			.select('*, rooms(number, type, price_per_night, image_url, description)')
			.eq('id', id)
			.maybeSingle();
		assertOk(error, 'getReservationById');
		return withRoom(data);
	},

	async getReservationRaw(id) {
		const { data, error } = await getSupabase()
			.from('reservations')
			.select('*')
			.eq('id', id)
			.maybeSingle();
		assertOk(error, 'getReservationRaw');
		return data;
	},

	async updateReservation(id, payload) {
		const { error } = await getSupabase().from('reservations').update(payload).eq('id', id);
		assertOk(error, 'updateReservation');
	},

	async listCustomerReservations(customerId) {
		const { data, error } = await getSupabase()
			.from('reservations')
			.select('*, rooms(number, type, price_per_night, image_url, description)')
			.eq('customer_id', customerId)
			.order('created_at', { ascending: false });
		assertOk(error, 'listCustomerReservations');
		return (data || []).map(withRoom);
	},

	async listAdminReservations() {
		const { data, error } = await getSupabase()
			.from('reservations')
			.select(
				`id, customer_name, customer_email, customer_phone, check_in, check_out,
				 status, payment_status, payment_txn_id, payment_proof_path, created_at,
				 booking_reference, customer_id,
				 rooms(number, type),
				 customers(id, username, aadhar, address)`
			)
			.order('created_at', { ascending: false })
			.limit(100);
		assertOk(error, 'listAdminReservations');

		return (data || []).map((row) => {
			const room = row.rooms || {};
			const customer = row.customers || {};
			const { rooms, customers, ...rest } = row;
			return {
				...rest,
				room_number: room.number,
				room_type: room.type,
				customer_username: customer.username,
				customer_aadhar: customer.aadhar,
				customer_address: customer.address,
			};
		});
	},

	async listCustomersWithBookingCounts() {
		const { data: customers, error } = await getSupabase()
			.from('customers')
			.select('*')
			.eq('active', true)
			.order('created_at', { ascending: false });
		assertOk(error, 'listCustomersWithBookingCounts');

		const list = customers || [];
		const enriched = await Promise.all(
			list.map(async (customer) => {
				const { data: reservations, error: resError } = await getSupabase()
					.from('reservations')
					.select('id, status')
					.eq('customer_id', customer.id);
				assertOk(resError, 'customer booking counts');
				const rows = reservations || [];
				return {
					...customer,
					total_bookings: rows.length,
					active_bookings: rows.filter((r) => ['booked', 'checked_in'].includes(r.status)).length,
				};
			})
		);
		return enriched;
	},

	async listKpis() {
		const { data, error } = await getSupabase()
			.from('v_kpis')
			.select('*')
			.order('day', { ascending: false })
			.limit(30);
		assertOk(error, 'listKpis');
		return data || [];
	},

	async listReservationsByCheckIn(date, status) {
		const { data, error } = await getSupabase()
			.from('reservations')
			.select('*, rooms(number, type, price_per_night, image_url, description)')
			.eq('check_in', date)
			.eq('status', status)
			.order('created_at');
		assertOk(error, 'listReservationsByCheckIn');
		return (data || []).map(withRoom);
	},

	async listReservationsByCheckOut(date, status) {
		const { data, error } = await getSupabase()
			.from('reservations')
			.select('*, rooms(number, type, price_per_night, image_url, description)')
			.eq('check_out', date)
			.eq('status', status)
			.order('created_at');
		assertOk(error, 'listReservationsByCheckOut');
		return (data || []).map(withRoom);
	},

	async listCheckedInReservations() {
		const { data, error } = await getSupabase()
			.from('reservations')
			.select('*, rooms(number, type, price_per_night, image_url, description)')
			.eq('status', 'checked_in')
			.order('check_out');
		assertOk(error, 'listCheckedInReservations');
		return (data || []).map(withRoom);
	},

	async listPendingServiceRequests() {
		const { data, error } = await getSupabase()
			.from('service_requests')
			.select('*')
			.eq('status', 'pending')
			.order('created_at', { ascending: false });
		assertOk(error, 'listPendingServiceRequests');

		const rows = data || [];
		return Promise.all(
			rows.map(async (row) => {
				const reservation = await db.getReservationById(row.reservation_id);
				return {
					...row,
					customer_name: reservation?.customer_name,
					customer_phone: reservation?.customer_phone,
					room_number: reservation?.room_number,
				};
			})
		);
	},

	async createServiceRequest(payload) {
		const { error } = await getSupabase().from('service_requests').insert(payload);
		assertOk(error, 'createServiceRequest');
	},

	async completeServiceRequest(id) {
		const { error } = await getSupabase()
			.from('service_requests')
			.update({ status: 'completed', completed_at: new Date().toISOString() })
			.eq('id', id);
		assertOk(error, 'completeServiceRequest');
	},
};

module.exports = { db, getSupabase };
