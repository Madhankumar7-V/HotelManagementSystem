# Noir Hotel – Hotel Management (Dark Theme)

A minimal hotel management system with a professional dark theme.

Features:
- Customer: browse rooms, book, view/cancel reservation
- Reception: arrivals/departures dashboard, check-in/out
- Admin: manage rooms and staff, view performance KPIs

## Tech Stack
- Node.js, Express
- EJS with express-ejs-layouts
- SQLite via better-sqlite3
- Sessions with express-session

## Getting Started

1. Install dependencies
```bash
npm install
```

2. Run the server
```bash
npm run dev
# or
npm start
```

3. Open `http://localhost:3000`

The database file will be created at `data/hotel.db` automatically with seed data:
- Admin: admin / admin123
- Receptionist: reception / reception123

## Scripts
- npm run dev – run with auto-reload
- npm start – run in production mode

## Project Structure
```
server.js
src/
  db.js
  routes/
    public.js
    auth.js
    reception.js
    admin.js
  views/
    layout.ejs
    404.ejs
    public/
      home.ejs
      book.ejs
      reservation.ejs
    auth/
      login.ejs
    reception/
      dashboard.ejs
    admin/
      dashboard.ejs
  public/
    css/
      base.css
```

## Notes
- This demo omits payments and advanced availability logic; adapt as needed.
- Change the session secret in `server.js` before deploying.
