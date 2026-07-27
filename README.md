# Madhan Hotel Booking Platform

Express + EJS hotel booking site backed by **Supabase**.

## Features

- Guest registration / persistent cookie sessions
- Room browsing and booking with UPI QR + transaction ID verification
- Admin payment confirmation and room/staff management
- Reception check-in / check-out and service requests
- Light / dark theme + mobile-friendly UI

## 1. Create tables in Supabase

1. Open **Supabase Dashboard → SQL Editor**
2. Paste and run the full file: [`supabase/schema.sql`](supabase/schema.sql)
3. Confirm tables exist: `rooms`, `staff`, `customers`, `reservations`, `service_requests`

Seed logins after schema run:

- Admin: `admin` / `admin123`
- Reception: `reception` / `reception123`

## 2. Vercel environment variables

| Variable | Where to get it |
|----------|-----------------|
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` key (secret) |
| `SESSION_SECRET` | Any long random string |
| `HOTEL_NAME` | Madhan Hotel |
| `HOTEL_TAGLINE` | Premium comfort stays, thoughtfully hosted. |
| `HOTEL_PHONE` | 9384180232 |
| `HOTEL_EMAIL` | damnnwhosthis@gmail.com |
| `HOTEL_ADDRESS` | Chennai, Tamil Nadu |
| `VITE_UPI_ID` | Your UPI ID |
| `VITE_UPI_NAME` | Madhan Hotel |

> Use the **service_role** key only on the server (Vercel env). Never expose it in frontend code.

## 3. Local run

```bash
npm install
cp .env.example .env
# fill SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
npm run dev
```

## 4. Deploy

Push to GitHub and deploy on Vercel. Ensure env vars are set for **Production**, then redeploy.

## Notes

- Old SQLite / direct Postgres pool backend has been removed
- Sessions use signed cookies (works on Vercel serverless)
- Payment proofs on Vercel use temporary `/tmp` storage; move to Supabase Storage later if needed
