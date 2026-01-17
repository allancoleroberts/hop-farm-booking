import express from 'express';
import cors from 'cors';
import compression from 'compression';
import Stripe from 'stripe';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(compression());
app.use(express.json());

// Database setup
const dbPath = process.env.DATABASE_URL || './data/bookings.db';
const dbDir = dirname(dbPath);
if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_ref TEXT NOT NULL UNIQUE,
    guest_name TEXT NOT NULL,
    guest_email TEXT NOT NULL,
    guest_phone TEXT,
    check_in TEXT NOT NULL,
    check_out TEXT NOT NULL,
    nights INTEGER NOT NULL,
    guests INTEGER NOT NULL DEFAULT 2,
    total_amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'SEK',
    stripe_session_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS blocked_dates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    reason TEXT
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  INSERT OR IGNORE INTO settings (key, value) VALUES ('nightly_rate', '3495');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('min_nights', '1');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('max_guests', '4');
`);

// Stripe setup
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY) 
  : null;

// Helper functions
function generateRef() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let ref = 'HFB-';
  for (let i = 0; i < 6; i++) ref += chars[Math.floor(Math.random() * chars.length)];
  return ref;
}

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

// API Routes
app.get('/api/settings', (req, res) => {
  res.json({
    nightlyRate: parseInt(getSetting('nightly_rate') || '3495'),
    minNights: parseInt(getSetting('min_nights') || '1'),
    maxGuests: parseInt(getSetting('max_guests') || '4'),
    currency: 'SEK'
  });
});

app.get('/api/unavailable', (req, res) => {
  const blocked = db.prepare('SELECT date FROM blocked_dates').all().map(r => r.date);
  const bookings = db.prepare("SELECT check_in, check_out FROM bookings WHERE status = 'confirmed'").all();
  
  const unavailable = new Set(blocked);
  for (const b of bookings) {
    let d = new Date(b.check_in);
    const end = new Date(b.check_out);
    while (d < end) {
      unavailable.add(d.toISOString().split('T')[0]);
      d.setDate(d.getDate() + 1);
    }
  }
  res.json([...unavailable]);
});

app.post('/api/checkout', async (req, res) => {
  if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });
  
  const { guestName, guestEmail, guestPhone, checkIn, checkOut, guests } = req.body;
  const rate = parseInt(getSetting('nightly_rate') || '3495');
  const nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
  const total = nights * rate;
  const ref = generateRef();

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: guestEmail,
      line_items: [{
        price_data: {
          currency: 'sek',
          product_data: {
            name: 'Hop Farm Beach - Cabin Stay',
            description: `${nights} night${nights > 1 ? 's' : ''} | ${checkIn} to ${checkOut}`
          },
          unit_amount: total * 100
        },
        quantity: 1
      }],
      metadata: { booking_ref: ref },
      success_url: `${process.env.SITE_URL || 'http://localhost:3000'}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SITE_URL || 'http://localhost:3000'}?cancelled=true`
    });

    db.prepare(`INSERT INTO bookings (booking_ref, guest_name, guest_email, guest_phone, check_in, check_out, nights, guests, total_amount, stripe_session_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`).run(ref, guestName, guestEmail, guestPhone || null, checkIn, checkOut, nights, guests, total, session.id);

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/confirm', async (req, res) => {
  if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });
  
  const { session_id } = req.query;
  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status !== 'paid') return res.status(400).json({ error: 'Not paid' });

    const booking = db.prepare('SELECT * FROM bookings WHERE stripe_session_id = ?').get(session_id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    if (booking.status === 'pending') {
      db.prepare("UPDATE bookings SET status = 'confirmed' WHERE id = ?").run(booking.id);
    }

    res.json({
      bookingRef: booking.booking_ref,
      guestName: booking.guest_name,
      guestEmail: booking.guest_email,
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      nights: booking.nights,
      guests: booking.guests,
      totalAmount: booking.total_amount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin routes
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === (process.env.ADMIN_PASSWORD || 'admin123')) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

app.get('/api/admin/bookings', (req, res) => {
  const bookings = db.prepare('SELECT * FROM bookings ORDER BY created_at DESC').all();
  res.json(bookings);
});

app.get('/api/admin/blocked', (req, res) => {
  const blocked = db.prepare('SELECT date FROM blocked_dates').all().map(r => r.date);
  res.json(blocked);
});

app.post('/api/admin/block', (req, res) => {
  const { date, block } = req.body;
  if (block) {
    db.prepare('INSERT OR IGNORE INTO blocked_dates (date) VALUES (?)').run(date);
  } else {
    db.prepare('DELETE FROM blocked_dates WHERE date = ?').run(date);
  }
  res.json({ success: true });
});

app.post('/api/admin/settings', (req, res) => {
  const { key, value } = req.body;
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  res.json({ success: true });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../dist')));
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '../dist/index.html'));
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
