import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { existsSync, mkdirSync } from "fs";
import { dirname } from "path";

const dbPath = process.env.DATABASE_URL || "./data/bookings.db";

// Ensure data directory exists
const dir = dirname(dbPath);
if (!existsSync(dir)) {
  mkdirSync(dir, { recursive: true });
}

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });

// Initialize tables
sqlite.exec(`
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
    stripe_payment_intent TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS blocked_dates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

// Insert default settings if not exist
const defaultSettings = [
  { key: "nightly_rate", value: "3495" },
  { key: "currency", value: "SEK" },
  { key: "min_nights", value: "1" },
  { key: "max_guests", value: "4" },
  { key: "checkin_time", value: "15:00" },
  { key: "checkout_time", value: "11:00" },
];

for (const setting of defaultSettings) {
  sqlite.exec(`
    INSERT OR IGNORE INTO settings (key, value, updated_at) 
    VALUES ('${setting.key}', '${setting.value}', datetime('now'))
  `);
}

export { sqlite };
