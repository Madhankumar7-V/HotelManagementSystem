const path = require('path');
const os = require('os');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function env(name, fallback = '') {
	return process.env[name] || fallback;
}

function envFirst(names, fallback = '') {
	for (const name of names) {
		const value = process.env[name];
		if (value) return value;
	}
	return fallback;
}

const config = {
	port: Number(env('PORT', 3000)),
	nodeEnv: env('NODE_ENV', 'development'),
	sessionSecret: env('SESSION_SECRET', 'change-this-session-secret'),
	supabaseUrl: envFirst(['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL']),
	supabaseServiceRoleKey: envFirst([
		'SUPABASE_SERVICE_ROLE_KEY',
		'SUPABASE_SERVICE_KEY',
		'SUPABASE_KEY',
	]),
	hotelName: env('HOTEL_NAME', 'Madhan Hotel'),
	hotelTagline: env('HOTEL_TAGLINE', 'Premium comfort stays, thoughtfully hosted.'),
	hotelPhone: env('HOTEL_PHONE', '9384180232'),
	hotelEmail: env('HOTEL_EMAIL', 'damnnwhosthis@gmail.com'),
	hotelAddress: env('HOTEL_ADDRESS', 'Chennai, Tamil Nadu'),
	upiId: envFirst(['VITE_UPI_ID', 'UPI_ID'], 'hotel@upi'),
	upiPayeeName: envFirst(['VITE_UPI_NAME', 'UPI_PAYEE_NAME', 'UPI_NAME'], 'Madhan Hotel'),
	uploadDir: process.env.VERCEL
		? path.join(os.tmpdir(), 'hotel-uploads')
		: path.join(__dirname, '..', 'uploads'),
};

config.isProduction = config.nodeEnv === 'production' || Boolean(process.env.VERCEL);

module.exports = { config };
