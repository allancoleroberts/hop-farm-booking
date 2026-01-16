import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const bookings = sqliteTable("bookings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bookingRef: text("booking_ref").notNull().unique(),
  guestName: text("guest_name").notNull(),
  guestEmail: text("guest_email").notNull(),
  guestPhone: text("guest_phone"),
  checkIn: text("check_in").notNull(),
  checkOut: text("check_out").notNull(),
  nights: integer("nights").notNull(),
  guests: integer("guests").notNull().default(2),
  totalAmount: real("total_amount").notNull(),
  currency: text("currency").notNull().default("SEK"),
  stripeSessionId: text("stripe_session_id"),
  stripePaymentIntent: text("stripe_payment_intent"),
  status: text("status").notNull().default("pending"), // pending, confirmed, cancelled
  notes: text("notes"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const blockedDates = sqliteTable("blocked_dates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull().unique(),
  reason: text("reason"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
export type BlockedDate = typeof blockedDates.$inferSelect;
export type Setting = typeof settings.$inferSelect;
