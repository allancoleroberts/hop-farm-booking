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
import { existsSync, mkdirSync } from 'fs';
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

const db = new Database(dbPath);
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
  INSERT OR IGNORE INTO settings (key, value) VALUES ('nightly_rate', '3495');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('min_nights', '1');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('max_guests', '4');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('ical_url', '');
`);

// Add columns if they don't exist (migration for existing db)
try {
  db.exec(`ALTER TABLE bookings ADD COLUMN source TEXT NOT NULL DEFAULT 'direct'`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE bookings ADD COLUMN country TEXT`);
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

app.post('/api/checkout', checkoutLimiter, async (req, res) => {
  if (!stripe) return res.status(500).json({ error: 'Payment system not configured' });
  
  const { guestName, guestEmail, guestPhone, checkIn, checkOut, guests } = req.body;
  
  const errors = [];
  const maxGuests = parseInt(getSetting('max_guests') || '4');
  
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
  
  if (errors.length > 0) return res.status(400).json({ error: errors.join(', ') });
  
  const rate = parseInt(getSetting('nightly_rate') || '3495');
  const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
  const total = nights * rate;
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
            name: 'Hop Farm Beach - Cabin Stay',
            description: `${nights} night${nights > 1 ? 's' : ''} | ${checkIn} to ${checkOut}`
          },
          unit_amount: total * 100
        },
        quantity: 1
      }],
      metadata: { booking_ref: ref },
      success_url: `${SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}?cancelled=true`
    });

    db.prepare(`INSERT INTO bookings (booking_ref, guest_name, guest_email, guest_phone, check_in, check_out, nights, guests, total_amount, stripe_session_id, source, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'website', 'pending')`).run(ref, cleanName, cleanEmail, cleanPhone || null, checkIn, checkOut, nights, guests, total, session.id);

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
      
      if (resend) {
        try {
          await resend.emails.send({
            from: 'Hop Farm Beach <info@hopfarmbeach.com>',
            to: booking.guest_email,
            cc: 'info@hopfarmbeach.com',
            subject: `Booking Confirmed - ${booking.booking_ref}`,
            html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin: 0; padding: 0; background-color: #E1D9CA; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background-color: #E1D9CA; padding: 40px 20px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; max-width: 100%;"><tr><td style="background-color: #ffffff; padding: 30px; text-align: center;"><a href="https://www.hopfarmbeach.com" target="_blank"><img src="https://hopfarmbeach.com/wp-content/uploads/2026/01/hop-farm-beach-logo.png" alt="Hop Farm Beach" style="height: 50px; width: auto;" /></a></td></tr><tr><td style="padding: 20px 30px 40px;"><h2 style="color: #32322B; margin: 0 0 20px; font-size: 20px; font-weight: normal;">Booking Confirmed</h2><p style="color: #32322B; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">Hi ${booking.guest_name.split(' ')[0]},</p><p style="color: #32322B; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">Thank you for your booking. We're looking forward to hosting you at Hop Farm Beach.</p><table width="100%" cellpadding="0" cellspacing="0" style="background-color: #E1D9CA; border-radius: 8px; margin-bottom: 25px;"><tr><td style="padding: 25px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding-bottom: 12px;"><span style="color: #767460; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Booking Reference</span><br><span style="color: #32322B; font-size: 18px; font-weight: 600;">${booking.booking_ref}</span></td></tr><tr><td style="padding-bottom: 12px;"><span style="color: #767460; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Check-in</span><br><span style="color: #32322B; font-size: 16px;">${new Date(booking.check_in + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span></td></tr><tr><td style="padding-bottom: 12px;"><span style="color: #767460; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Check-out</span><br><span style="color: #32322B; font-size: 16px;">${new Date(booking.check_out + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span></td></tr><tr><td style="padding-bottom: 12px;"><span style="color: #767460; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Guests</span><br><span style="color: #32322B; font-size: 16px;">${booking.guests}</span></td></tr><tr><td><span style="color: #767460; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Total Paid</span><br><span style="color: #32322B; font-size: 16px;">SEK ${booking.total_amount.toLocaleString()}</span></td></tr></table></td></tr></table><p style="color: #32322B; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">We'll be in touch shortly with check-in details and directions to the cabin.</p><p style="color: #767460; font-size: 14px; line-height: 1.6; margin: 0;">Questions? Just reply to this email or contact us at<br><a href="mailto:info@hopfarmbeach.com" style="color: #32322B;">info@hopfarmbeach.com</a> · +46 707314500</p></td></tr><tr><td style="background-color: #32322B; padding: 30px; text-align: center;"><a href="https://www.hopfarmbeach.com" target="_blank"><img src="https://hopfarmbeach.com/wp-content/uploads/2026/01/Logo_HFB_Stamp_round_sand.png" alt="Hop Farm Beach" style="height: 70px; width: auto; margin-bottom: 15px;" /></a><p style="color: #B8A68A; margin: 0; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">Screens Off, Nature On</p></td></tr></table></td></tr></table></body></html>`
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

// Manual booking creation (for Booking.com, Airbnb, etc.)
app.post('/api/admin/booking', requireAuth, (req, res) => {
  const { guestName, checkIn, checkOut, guests, source, notes, country } = req.body;
  
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
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'confirmed')`).run(ref, cleanName, notes || '', checkIn, checkOut, nights, guests || 2, cleanSource, cleanCountry);
    
    res.json({ success: true, booking_ref: ref });
  } catch (err) {
    console.error('Manual booking error:', err);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// Edit booking
app.put('/api/admin/booking/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { guestName, checkIn, checkOut, guests, source, notes, country } = req.body;
  
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
    db.prepare(`UPDATE bookings SET guest_name = ?, guest_email = ?, check_in = ?, check_out = ?, nights = ?, guests = ?, source = ?, country = ? WHERE id = ?`)
      .run(cleanName, notes || '', checkIn, checkOut, nights, guests || 2, cleanSource, cleanCountry, id);
    
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

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../dist')));
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '../dist/index.html'));
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
