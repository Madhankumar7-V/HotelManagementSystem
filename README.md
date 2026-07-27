# Madhan Hotel Booking Platform

An Express + EJS hotel booking site upgraded for a more professional guest flow with:

- Supabase Postgres as the primary database
- Persistent login sessions stored in Postgres
- Light and dark theme switching
- Manual UPI QR payment submission with transaction ID verification
- Customer, reception, and admin dashboards

## Tech Stack

- Node.js and Express
- EJS with `express-ejs-layouts`
- Supabase Postgres via `pg`
- Session persistence with `express-session` and `connect-pg-simple`
- File uploads with `multer`

## Setup

1. Install dependencies

```bash
npm install
```

2. Copy `.env.example` to `.env` and fill in your real values

Required values:

- `DATABASE_URL`: your Supabase Postgres connection string
- `SESSION_SECRET`: a long random secret
- `VITE_UPI_ID` and `VITE_UPI_NAME` (preferred on Vercel)
- Hotel branding/contact fields

### Vercel environment variables

Add these in **Vercel → Project → Settings → Environment Variables**:

| Variable | Example |
|----------|---------|
| `DATABASE_URL` | Supabase Postgres connection string |
| `SESSION_SECRET` | long random string |
| `NODE_ENV` | `production` |
| `HOTEL_NAME` | Madhan Hotel |
| `HOTEL_TAGLINE` | Premium comfort stays, thoughtfully hosted. |
| `HOTEL_PHONE` | 9384180232 |
| `HOTEL_EMAIL` | damnnwhosthis@gmail.com |
| `HOTEL_ADDRESS` | Chennai, Tamil Nadu |
| `VITE_UPI_ID` | yourname@ybl |
| `VITE_UPI_NAME` | Madhan Hotel |

The app reads `VITE_UPI_ID` / `VITE_UPI_NAME` first, then falls back to `UPI_ID` / `UPI_PAYEE_NAME` for local development.

3. Start the app

```bash
npm run dev
# or
npm start
```

4. Open `http://localhost:3000`

On first boot, the app creates its schema and seeds default staff accounts:

- Admin: `admin / admin123`
- Receptionist: `reception / reception123`

## Booking and Payment Flow

- Guests must create an account before booking
- Sessions persist in Postgres so users do not need to log in repeatedly after server restarts
- Guests pay through the generated UPI QR / deep link
- Guests upload payment proof and submit a transaction ID
- Admin manually confirms payment and booking
- Final confirmation emails can be sent manually outside the app for now

## Deployment Notes

- Use a production Supabase connection string in `DATABASE_URL`
- Set `NODE_ENV=production` on Vercel (usually automatic)
- Set `VITE_UPI_ID` and `VITE_UPI_NAME` for UPI QR payments
- Replace default staff passwords immediately after first deployment
- On Vercel, payment proof uploads use temporary storage (`/tmp`); for persistent proofs, add Supabase Storage later
