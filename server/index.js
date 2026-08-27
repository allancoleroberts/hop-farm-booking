import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import sanitizeHtml from 'sanitize-html';
import Stripe from 'stripe';
import Database from 'better-sqlite3';
import { Resend } from 'resend';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, unlinkSync } from 'fs';
import crypto from 'crypto';

// Config
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';

// Resend setup
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://hopfarmbeach.com"],
      connectSrc: ["'self'", "https://api.stripe.com"],
      frameSrc: ["https://js.stripe.com", "https://hooks.stripe.com"],
    }
  }
}));
app.disable('x-powered-by');

// CORS - restrict to allowed origins
const allowedOrigins = [
  'https://book.hopfarmbeach.com',
  'https://hopfarmbeach.com',
  SITE_URL
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(compression());

// Stripe webhook needs raw body - must be before express.json()
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) return res.status(500).send('Stripe not configured');

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      // Fallback for development - just parse the body
      event = JSON.parse(req.body.toString());
      console.warn('STRIPE_WEBHOOK_SECRET not set - webhook signature not verified');
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log('Payment successful for session:', session.id);

    // Find and update the booking
    const booking = db.prepare('SELECT * FROM bookings WHERE stripe_session_id = ?').get(session.id);
    if (booking && booking.status === 'pending') {
      db.prepare("UPDATE bookings SET status = 'confirmed' WHERE id = ?").run(booking.id);
      console.log(`Booking ${booking.booking_ref} confirmed via webhook`);

      // Mark any matching leads as converted
      if (booking.guest_email) {
        db.prepare('UPDATE leads SET converted = 1 WHERE guest_email = ? AND converted = 0').run(booking.guest_email);
      }

      // Send confirmation email
      if (resend && booking.guest_email) {
        try {
          await resend.emails.send({
            from: 'Hop Farm Beach <info@hopfarmbeach.com>',
            to: booking.guest_email,
            cc: 'info@hopfarmbeach.com',
            subject: `${booking.product === SEA_TO_SKY ? 'Sea to Sky Confirmed' : 'Booking Confirmed'} - ${booking.booking_ref}`,
            html: confirmationHtml(booking)
          });
          console.log(`Confirmation email sent to ${booking.guest_email}`);
        } catch (emailErr) {
          console.error('Webhook email error:', emailErr);
        }
      }
    }
  }

  res.json({ received: true });
});

app.use(express.json());

// Trust proxy (for Railway)
app.set('trust proxy', 1);

// Rate limiting
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const checkoutLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Too many booking attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);

// Database setup - Railway volume is mounted at /data
const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT;
const dbPath = process.env.DATABASE_URL || (isProduction ? '/data/bookings.db' : './data/bookings.db');
const dbDir = dirname(dbPath);
if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });

console.log(`Database path: ${dbPath}`);

let db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_ref TEXT NOT NULL UNIQUE,
    guest_name TEXT NOT NULL,
    guest_email TEXT,
    guest_phone TEXT,
    check_in TEXT NOT NULL,
    check_out TEXT NOT NULL,
    nights INTEGER NOT NULL,
    guests INTEGER NOT NULL DEFAULT 2,
    total_amount REAL NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'SEK',
    stripe_session_id TEXT,
    source TEXT NOT NULL DEFAULT 'direct',
    country TEXT,
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
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guest_name TEXT,
    guest_email TEXT NOT NULL,
    guest_phone TEXT,
    check_in TEXT,
    check_out TEXT,
    guests INTEGER,
    converted INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  INSERT OR IGNORE INTO settings (key, value) VALUES ('nightly_rate', '3495');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('min_nights', '1');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('max_guests', '4');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('ical_url', '');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('sea_to_sky_price', '13900');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('sea_to_sky_dates', '2026-10-18,2026-10-19,2026-10-20,2026-10-21,2026-10-22,2026-10-23,2026-10-24,2026-11-22,2026-11-23,2026-11-24,2026-11-25,2026-11-26,2026-11-27,2026-11-28,2026-12-06,2026-12-07,2026-12-08,2026-12-09,2026-12-10,2026-12-11,2026-12-12');
`);

// Add columns if they don't exist (migration for existing db)
try {
  db.exec(`ALTER TABLE bookings ADD COLUMN source TEXT NOT NULL DEFAULT 'direct'`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE bookings ADD COLUMN country TEXT`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE bookings ADD COLUMN product TEXT NOT NULL DEFAULT 'cabin'`);
} catch (e) {}

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

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

function sanitize(str) {
  if (!str) return '';
  return sanitizeHtml(str, { allowedTags: [], allowedAttributes: {} }).trim();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isDateAvailable(checkIn, checkOut) {
  const blocked = db.prepare('SELECT date FROM blocked_dates').all().map(r => r.date);
  const bookings = db.prepare("SELECT check_in, check_out FROM bookings WHERE status = 'confirmed'").all();

  const unavailable = new Set(blocked);
  for (const b of bookings) {
    const [inY, inM, inD] = b.check_in.split('-').map(Number);
    const [outY, outM, outD] = b.check_out.split('-').map(Number);
    let d = new Date(inY, inM - 1, inD);
    const end = new Date(outY, outM - 1, outD);
    while (d < end) {
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      unavailable.add(dateStr);
      d.setDate(d.getDate() + 1);
    }
  }

  const [inY, inM, inD] = checkIn.split('-').map(Number);
  const [outY, outM, outD] = checkOut.split('-').map(Number);
  let d = new Date(inY, inM - 1, inD);
  const end = new Date(outY, outM - 1, outD);
  while (d < end) {
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (unavailable.has(dateStr)) return false;
    d.setDate(d.getDate() + 1);
  }
  return true;
}

// ---- Sea to Sky helpers -------------------------------------------------
// Night one is at Hop Farm Beach, night two is at Bergaliv. Only the Hop Farm
// Beach night occupies our calendar, so a booking is stored as a single night.
const SEA_TO_SKY = 'sea-to-sky';

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function seaToSkyDates() {
  return (getSetting('sea_to_sky_dates') || '')
    .split(',')
    .map(d => d.trim())
    .filter(Boolean);
}

function seaToSkyPrice() {
  return parseInt(getSetting('sea_to_sky_price') || '13900');
}

function longDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

function confirmationHtml(booking) {
  const isSTS = booking.product === SEA_TO_SKY;
  const first = booking.guest_name.split(' ')[0];

  const intro = isSTS
    ? 'Thank you for booking Sea to Sky. Two nights, two landscapes, and one long day in between. We are looking forward to having you.'
    : "Thank you for your booking. We're looking forward to hosting you at Hop Farm Beach.";

  const closing = isSTS
    ? 'Your Sea to Sky guide is on its way, along with directions for both nights and everything worth stopping for on the drive between us.'
    : "We'll be in touch shortly with check-in details and directions to the cabin.";

  const row = (label, value) =>
    `<tr><td style="padding-bottom: 12px;"><span style="color: #767460; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">${label}</span><br><span style="color: #32322B; font-size: 16px;">${value}</span></td></tr>`;

  const stayRows = isSTS
    ? row('Night one &middot; Hop Farm Beach', longDate(booking.check_in))
      + row('Night two &middot; Bergaliv', longDate(addDays(booking.check_in, 1)))
      + row('Home', longDate(addDays(booking.check_in, 2)))
    : row('Check-in', longDate(booking.check_in))
      + row('Check-out', longDate(booking.check_out));

  const details =
    `<tr><td style="padding-bottom: 12px;"><span style="color: #767460; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Booking Reference</span><br><span style="color: #32322B; font-size: 18px; font-weight: 600;">${booking.booking_ref}</span></td></tr>`
    + stayRows
    + row('Guests', booking.guests)
    + `<tr><td><span style="color: #767460; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Total Paid</span><br><span style="color: #32322B; font-size: 16px;">SEK ${booking.total_amount.toLocaleString()}</span></td></tr>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin: 0; padding: 0; background-color: #E1D9CA; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background-color: #E1D9CA; padding: 40px 20px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; max-width: 100%;"><tr><td style="background-color: #ffffff; padding: 30px; text-align: center;"><a href="https://www.hopfarmbeach.com" target="_blank"><img src="https://hopfarmbeach.com/wp-content/uploads/2026/01/hop-farm-beach-logo.png" alt="Hop Farm Beach" style="height: 50px; width: auto;" /></a></td></tr><tr><td style="padding: 20px 30px 40px;"><h2 style="color: #32322B; margin: 0 0 20px; font-size: 20px; font-weight: normal;">${isSTS ? 'Sea to Sky Confirmed' : 'Booking Confirmed'}</h2><p style="color: #32322B; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">Hi ${first},</p><p style="color: #32322B; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">${intro}</p><table width="100%" cellpadding="0" cellspacing="0" style="background-color: #E1D9CA; border-radius: 8px; margin-bottom: 25px;"><tr><td style="padding: 25px;"><table width="100%" cellpadding="0" cellspacing="0">${details}</table></td></tr></table><p style="color: #32322B; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">${closing}</p><p style="color: #767460; font-size: 14px; line-height: 1.6; margin: 0;">Questions? Just reply to this email or contact us at<br><a href="mailto:info@hopfarmbeach.com" style="color: #32322B;">info@hopfarmbeach.com</a> &middot; +46 707314500</p></td></tr><tr><td style="background-color: #32322B; padding: 30px; text-align: center;"><a href="https://www.hopfarmbeach.com" target="_blank"><img src="https://hopfarmbeach.com/wp-content/uploads/2026/01/Logo_HFB_Stamp_round_sand.png" alt="Hop Farm Beach" style="height: 70px; width: auto; margin-bottom: 15px;" /></a><p style="color: #B8A68A; margin: 0; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">Screens Off, Nature On</p></td></tr></table></td></tr></table></body></html>`;
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Public API Routes
app.get('/api/settings', (req, res) => {
  res.json({
    nightlyRate: parseInt(getSetting('nightly_rate') || '3495'),
    minNights: parseInt(getSetting('min_nights') || '1'),
    maxGuests: parseInt(getSetting('max_guests') || '4'),
    currency: 'SEK'
  });
});

app.get('/api/sea-to-sky', (req, res) => {
  const dates = seaToSkyDates().map(date => ({
    date,
    bergaliv: addDays(date, 1),
    checkOut: addDays(date, 2),
    available: isDateAvailable(date, addDays(date, 1))
  }));
  res.json({ price: seaToSkyPrice(), nights: 2, guests: 2, dates });
});

app.get('/api/unavailable', (req, res) => {
  const blocked = db.prepare('SELECT date FROM blocked_dates').all().map(r => r.date);
  const bookings = db.prepare("SELECT check_in, check_out FROM bookings WHERE status = 'confirmed'").all();

  const unavailable = new Set(blocked);
  for (const b of bookings) {
    const [inY, inM, inD] = b.check_in.split('-').map(Number);
    const [outY, outM, outD] = b.check_out.split('-').map(Number);
    let d = new Date(inY, inM - 1, inD);
    const end = new Date(outY, outM - 1, outD);
    while (d < end) {
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      unavailable.add(dateStr);
      d.setDate(d.getDate() + 1);
    }
  }
  res.json([...unavailable]);
});

// Capture a lead from the booking form (called on email blur)
app.post('/api/lead', apiLimiter, (req, res) => {
  try {
    const { guestName, guestEmail, guestPhone, checkIn, checkOut, guests } = req.body;
    const cleanEmail = sanitize(guestEmail);

    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      return res.json({ ok: false });
    }

    // Dedup: skip if same email captured in the last day
    const recent = db.prepare(`
      SELECT id FROM leads
      WHERE guest_email = ?
      AND datetime(created_at) > datetime('now', '-1 day')
    `).get(cleanEmail);

    if (recent) return res.json({ ok: true, deduped: true });

    db.prepare(`
      INSERT INTO leads (guest_name, guest_email, guest_phone, check_in, check_out, guests)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      sanitize(guestName) || null,
      cleanEmail,
      sanitize(guestPhone) || null,
      checkIn || null,
      checkOut || null,
      parseInt(guests) || null
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('Lead capture error:', err);
    res.json({ ok: false });
  }
});

app.post('/api/checkout', checkoutLimiter, async (req, res) => {
  if (!stripe) return res.status(500).json({ error: 'Payment system not configured' });

  const { guestName, guestEmail, guestPhone, checkIn, guests, product } = req.body;
  const isSeaToSky = product === SEA_TO_SKY;

  // Sea to Sky is a fixed two-night trip: night one here, night two at Bergaliv.
  // Only our night sits in the calendar, so check-out is always the next day.
  const checkOut = isSeaToSky ? (checkIn ? addDays(checkIn, 1) : null) : req.body.checkOut;

  const errors = [];
  const maxGuests = isSeaToSky ? 2 : parseInt(getSetting('max_guests') || '4');

  const cleanName = sanitize(guestName);
  const cleanEmail = sanitize(guestEmail);
  const cleanPhone = sanitize(guestPhone);

  if (!cleanName || cleanName.length < 2) errors.push('Valid name is required');
  if (!cleanEmail || !isValidEmail(cleanEmail)) errors.push('Valid email is required');
  if (!guests || guests < 1 || guests > maxGuests) errors.push(`Guest count must be between 1 and ${maxGuests}`);
  if (!checkIn || !checkOut) errors.push('Check-in and check-out dates are required');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);

  if (checkInDate < today) errors.push('Cannot book past dates');
  if (checkOutDate <= checkInDate) errors.push('Check-out must be after check-in');
  if (checkIn && checkOut && !isDateAvailable(checkIn, checkOut)) errors.push('Selected dates are not available');
  if (isSeaToSky && seaToSkyDates().indexOf(checkIn) === -1) errors.push('That date is not part of Sea to Sky');

  if (errors.length > 0) return res.status(400).json({ error: errors.join(', ') });

  const rate = parseInt(getSetting('nightly_rate') || '3495');
  const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
  const total = isSeaToSky ? seaToSkyPrice() : nights * rate;
  const ref = generateRef();

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: cleanEmail,
      line_items: [{
        price_data: {
          currency: 'sek',
          product_data: {
            name: isSeaToSky ? 'Sea to Sky - Hop Farm Beach & Bergaliv' : 'Hop Farm Beach - Cabin Stay',
            description: isSeaToSky
              ? `Two nights | ${checkIn} Hop Farm Beach, ${addDays(checkIn, 1)} Bergaliv`
              : `${nights} night${nights > 1 ? 's' : ''} | ${checkIn} to ${checkOut}`
          },
          unit_amount: total * 100
        },
        quantity: 1
      }],
      metadata: { booking_ref: ref },
      // The Stripe account is in the parent company's name, so say so before
      // somebody wonders who Way Up North are and abandons the payment.
      custom_text: {
        submit: {
          message: 'Hop Farm Beach is part of Way Up North AB, so that name appears here and on your bank statement.'
        }
      },
      success_url: `${SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}?cancelled=true`
    });

    db.prepare(`INSERT INTO bookings (booking_ref, guest_name, guest_email, guest_phone, check_in, check_out, nights, guests, total_amount, stripe_session_id, source, status, product)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'website', 'pending', ?)`).run(ref, cleanName, cleanEmail, cleanPhone || null, checkIn, checkOut, nights, guests, total, session.id, isSeaToSky ? SEA_TO_SKY : 'cabin');

    // Send admin notification about new booking attempt
    if (resend) {
      try {
        await resend.emails.send({
          from: 'Hop Farm Beach <info@hopfarmbeach.com>',
          to: 'info@hopfarmbeach.com',
          subject: `New Booking Attempt${isSeaToSky ? ' (Sea to Sky)' : ''} - ${ref}`,
          html: `<h2>New Booking Attempt${isSeaToSky ? ' - Sea to Sky' : ''}</h2>
            <p>Someone just started the checkout process:</p>
            <ul>
              <li><strong>Reference:</strong> ${ref}</li>
              <li><strong>Guest:</strong> ${cleanName}</li>
              <li><strong>Email:</strong> ${cleanEmail}</li>
              <li><strong>Phone:</strong> ${cleanPhone || 'Not provided'}</li>
              <li><strong>Dates:</strong> ${isSeaToSky ? `${checkIn} Hop Farm Beach, then ${addDays(checkIn, 1)} Bergaliv` : `${checkIn} to ${checkOut} (${nights} nights)`}</li>
              <li><strong>Guests:</strong> ${guests}</li>
              <li><strong>Total:</strong> SEK ${total.toLocaleString()}</li>
            </ul>
            <p>You'll receive another email when payment is confirmed.</p>
            <p><a href="https://book.hopfarmbeach.com/admin">View in Admin</a></p>`
        });
      } catch (emailErr) {
        console.error('Admin notification error:', emailErr);
      }
    }

    res.json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', err.message);
    res.status(500).json({ error: 'Unable to create checkout session' });
  }
});

app.get('/api/confirm', async (req, res) => {
  if (!stripe) return res.status(500).json({ error: 'Payment system not configured' });

  const { session_id } = req.query;
  if (!session_id) return res.status(400).json({ error: 'Session ID required' });

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status !== 'paid') return res.status(400).json({ error: 'Payment not completed' });

    const booking = db.prepare('SELECT * FROM bookings WHERE stripe_session_id = ?').get(session_id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    if (booking.status === 'pending') {
      db.prepare("UPDATE bookings SET status = 'confirmed' WHERE id = ?").run(booking.id);

      // Mark any matching leads as converted
      if (booking.guest_email) {
        db.prepare('UPDATE leads SET converted = 1 WHERE guest_email = ? AND converted = 0').run(booking.guest_email);
      }

      if (resend) {
        try {
          await resend.emails.send({
            from: 'Hop Farm Beach <info@hopfarmbeach.com>',
            to: booking.guest_email,
            cc: 'info@hopfarmbeach.com',
            subject: `${booking.product === SEA_TO_SKY ? 'Sea to Sky Confirmed' : 'Booking Confirmed'} - ${booking.booking_ref}`,
            html: confirmationHtml(booking)
          });
        } catch (emailErr) {
          console.error('Email send error:', emailErr);
        }
      }
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
    console.error('Confirm error:', err.message);
    res.status(500).json({ error: 'Unable to confirm booking' });
  }
});

// Admin routes
app.post('/api/admin/login', loginLimiter, (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, token });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

app.get('/api/admin/bookings', requireAuth, (req, res) => {
  const bookings = db.prepare('SELECT * FROM bookings ORDER BY created_at DESC').all();
  res.json(bookings);
});

// View captured leads
app.get('/api/admin/leads', requireAuth, (req, res) => {
  const leads = db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all();
  res.json(leads);
});

app.get('/api/admin/blocked', requireAuth, (req, res) => {
  const blocked = db.prepare('SELECT date FROM blocked_dates').all().map(r => r.date);
  res.json(blocked);
});

app.post('/api/admin/block', requireAuth, (req, res) => {
  const { date, block } = req.body;
  if (!date) return res.status(400).json({ error: 'Date required' });

  if (block) {
    db.prepare('INSERT OR IGNORE INTO blocked_dates (date) VALUES (?)').run(date);
  } else {
    db.prepare('DELETE FROM blocked_dates WHERE date = ?').run(date);
  }
  res.json({ success: true });
});

app.post('/api/admin/cancel', requireAuth, (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Booking ID required' });

  db.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?").run(id);
  res.json({ success: true });
});

// Remove a booking outright. Cancelling leaves the row in place, which is
// right for a real guest and wrong for a test that should never have existed.
app.delete('/api/admin/booking/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Booking ID required' });
  const row = db.prepare('SELECT booking_ref FROM bookings WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'No such booking' });
  db.prepare('DELETE FROM bookings WHERE id = ?').run(id);
  res.json({ success: true, ref: row.booking_ref });
});

// Manual booking creation (for Booking.com, Airbnb, etc.)
app.post('/api/admin/booking', requireAuth, (req, res) => {
  const { guestName, checkIn, checkOut, guests, source, notes, country, totalAmount } = req.body;

  if (!guestName || !checkIn || !checkOut) {
    return res.status(400).json({ error: 'Guest name, check-in, and check-out required' });
  }

  const cleanName = sanitize(guestName);
  const cleanSource = sanitize(source) || 'manual';
  const cleanCountry = sanitize(country) || null;
  const ref = generateRef();

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));

  try {
    db.prepare(`INSERT INTO bookings (booking_ref, guest_name, guest_email, check_in, check_out, nights, guests, total_amount, source, country, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')`).run(ref, cleanName, notes || '', checkIn, checkOut, nights, guests || 2, Math.round(Number(totalAmount) || 0), cleanSource, cleanCountry);

    res.json({ success: true, booking_ref: ref });
  } catch (err) {
    console.error('Manual booking error:', err);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// Edit booking
app.put('/api/admin/booking/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { guestName, checkIn, checkOut, guests, source, notes, country, totalAmount } = req.body;

  if (!guestName || !checkIn || !checkOut) {
    return res.status(400).json({ error: 'Guest name, check-in, and check-out required' });
  }

  const cleanName = sanitize(guestName);
  const cleanSource = sanitize(source) || 'manual';
  const cleanCountry = sanitize(country) || null;

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));

  try {
    db.prepare(`UPDATE bookings SET guest_name = ?, guest_email = ?, check_in = ?, check_out = ?, nights = ?, guests = ?, source = ?, country = ?, total_amount = ? WHERE id = ?`)
      .run(cleanName, notes || '', checkIn, checkOut, nights, guests || 2, cleanSource, cleanCountry, Math.round(Number(totalAmount) || 0), id);

    res.json({ success: true });
  } catch (err) {
    console.error('Edit booking error:', err);
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

// Get iCal URL
app.get('/api/admin/ical', requireAuth, (req, res) => {
  const url = getSetting('ical_url') || '';
  res.json({ url });
});

// Set iCal URL
app.post('/api/admin/ical', requireAuth, (req, res) => {
  const { url } = req.body;
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('ical_url', url || '');
  res.json({ success: true });
});

// Sync from Google Calendar iCal feed
app.post('/api/admin/sync', requireAuth, async (req, res) => {
  const icalUrl = getSetting('ical_url');
  if (!icalUrl) {
    return res.status(400).json({ error: 'No iCal URL configured' });
  }

  try {
    const response = await fetch(icalUrl);
    if (!response.ok) throw new Error('Failed to fetch calendar');

    const icalData = await response.text();
    const events = parseIcal(icalData);

    let synced = 0;
    for (const event of events) {
      // Check if this event is already in bookings (by date range and source)
      const existing = db.prepare(
        "SELECT id FROM bookings WHERE check_in = ? AND check_out = ? AND source = 'gcal'"
      ).get(event.checkIn, event.checkOut);

      if (!existing) {
        const ref = generateRef();
        const nights = Math.ceil((new Date(event.checkOut) - new Date(event.checkIn)) / (1000 * 60 * 60 * 24));

        db.prepare(`INSERT INTO bookings (booking_ref, guest_name, guest_email, check_in, check_out, nights, guests, total_amount, source, status)
          VALUES (?, ?, '', ?, ?, ?, 2, 0, 'gcal', 'confirmed')`).run(ref, event.summary || 'Calendar Block', event.checkIn, event.checkOut, nights);
        synced++;
      }
    }

    res.json({ success: true, synced, total: events.length });
  } catch (err) {
    console.error('Calendar sync error:', err);
    res.status(500).json({ error: 'Failed to sync calendar' });
  }
});

// Simple iCal parser
function parseIcal(data) {
  const events = [];
  const lines = data.split(/\r?\n/);
  let inEvent = false;
  let event = {};

  for (let line of lines) {
    // Handle line continuation
    if (line.startsWith(' ') || line.startsWith('\t')) {
      continue;
    }

    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      event = {};
    } else if (line === 'END:VEVENT') {
      if (event.checkIn && event.checkOut) {
        events.push(event);
      }
      inEvent = false;
    } else if (inEvent) {
      if (line.startsWith('DTSTART')) {
        const val = line.split(':')[1];
        if (val) {
          // Handle different date formats
          if (val.length === 8) {
            // YYYYMMDD format
            event.checkIn = `${val.slice(0,4)}-${val.slice(4,6)}-${val.slice(6,8)}`;
          } else if (val.includes('T')) {
            // YYYYMMDDTHHMMSS format
            const date = val.split('T')[0];
            event.checkIn = `${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}`;
          }
        }
      } else if (line.startsWith('DTEND')) {
        const val = line.split(':')[1];
        if (val) {
          if (val.length === 8) {
            event.checkOut = `${val.slice(0,4)}-${val.slice(4,6)}-${val.slice(6,8)}`;
          } else if (val.includes('T')) {
            const date = val.split('T')[0];
            event.checkOut = `${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}`;
          }
        }
      } else if (line.startsWith('SUMMARY')) {
        event.summary = line.split(':').slice(1).join(':');
      }
    }
  }

  return events;
}

app.post('/api/admin/settings', requireAuth, (req, res) => {
  const { key, value } = req.body;
  if (!key || value === undefined) return res.status(400).json({ error: 'Key and value required' });

  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  res.json({ success: true });
});

// Database backup endpoints
const backupDir = join(dbDir, 'backups');
if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });

// Create backup
app.post('/api/admin/backup', requireAuth, (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupPath = join(backupDir, `bookings-${timestamp}.db`);

    // Close and reopen DB to ensure all changes are written
    db.close();
    copyFileSync(dbPath, backupPath);

    // Reopen database
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');

    // Clean up old backups (keep last 10)
    const backups = readdirSync(backupDir)
      .filter(f => f.endsWith('.db'))
      .map(f => ({ name: f, path: join(backupDir, f), time: statSync(join(backupDir, f)).mtime }))
      .sort((a, b) => b.time - a.time);

    backups.slice(10).forEach(b => unlinkSync(b.path));

    console.log(`Backup created: ${backupPath}`);
    res.json({ success: true, backup: `bookings-${timestamp}.db`, total: backups.length });
  } catch (err) {
    console.error('Backup error:', err);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

// List backups
app.get('/api/admin/backups', requireAuth, (req, res) => {
  try {
    const backups = readdirSync(backupDir)
      .filter(f => f.endsWith('.db'))
      .map(f => {
        const stats = statSync(join(backupDir, f));
        return {
          name: f,
          size: stats.size,
          created: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.created) - new Date(a.created));

    res.json(backups);
  } catch (err) {
    console.error('List backups error:', err);
    res.json([]);
  }
});

// Download a specific backup file
app.get('/api/admin/backup/download/:filename', requireAuth, (req, res) => {
  const filename = req.params.filename;
  if (!filename.endsWith('.db') || filename.includes('..') || filename.includes('/')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  const filePath = join(backupDir, filename);
  if (!existsSync(filePath)) {
    return res.status(404).json({ error: 'Backup not found' });
  }
  res.download(filePath, filename);
});

// Restore from backup
app.post('/api/admin/restore', requireAuth, (req, res) => {
  const { backup } = req.body;
  if (!backup) return res.status(400).json({ error: 'Backup name required' });

  const backupPath = join(backupDir, backup);
  if (!existsSync(backupPath)) {
    return res.status(404).json({ error: 'Backup not found' });
  }

  try {
    // Close database
    db.close();

    // Restore backup
    copyFileSync(backupPath, dbPath);

    // Reopen database
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');

    console.log(`Database restored from: ${backup}`);
    res.json({ success: true, restored: backup });
  } catch (err) {
    console.error('Restore error:', err);
    res.status(500).json({ error: 'Failed to restore backup' });
  }
});

// Auto-backup on startup
setTimeout(() => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupPath = join(backupDir, `bookings-startup-${timestamp}.db`);
    copyFileSync(dbPath, backupPath);
    console.log(`Startup backup created: ${backupPath}`);
  } catch (err) {
    console.error('Startup backup error:', err);
  }
}, 5000); // Wait 5 seconds after startup

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../dist')));
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '../dist/index.html'));
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
