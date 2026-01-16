import nodemailer from "nodemailer";
import type { Booking } from "~/db/schema";
import { formatCurrency, formatDate } from "./utils";

const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

export async function sendBookingConfirmation(booking: Booking) {
  if (!transporter) {
    console.log("Email not configured - skipping confirmation email");
    console.log("Would send to:", booking.guestEmail);
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1c1917; }
        .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
        .header { text-align: center; margin-bottom: 40px; }
        .logo { font-family: cursive; font-size: 32px; color: #4a5c4a; }
        .details { background: #f5f5f4; padding: 24px; border-radius: 8px; margin: 24px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e7e5e4; }
        .detail-row:last-child { border-bottom: none; }
        .total { font-size: 20px; font-weight: bold; margin-top: 16px; }
        .footer { text-align: center; color: #78716c; font-size: 14px; margin-top: 40px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Hop Farm Beach</div>
          <p>Booking Confirmation</p>
        </div>
        
        <p>Hi ${booking.guestName},</p>
        
        <p>Your booking is confirmed. Here are your details:</p>
        
        <div class="details">
          <div class="detail-row">
            <span>Booking Reference</span>
            <strong>${booking.bookingRef}</strong>
          </div>
          <div class="detail-row">
            <span>Check-in</span>
            <span>${formatDate(booking.checkIn)} from 15:00</span>
          </div>
          <div class="detail-row">
            <span>Check-out</span>
            <span>${formatDate(booking.checkOut)} by 11:00</span>
          </div>
          <div class="detail-row">
            <span>Nights</span>
            <span>${booking.nights}</span>
          </div>
          <div class="detail-row">
            <span>Guests</span>
            <span>${booking.guests}</span>
          </div>
          <div class="detail-row total">
            <span>Total Paid</span>
            <span>${formatCurrency(booking.totalAmount, booking.currency)}</span>
          </div>
        </div>
        
        <h3>What to Expect</h3>
        <ul>
          <li>Address will be sent a few days before arrival</li>
          <li>Self check-in with key lockbox</li>
          <li>Electric sauna included</li>
          <li>Phones go in the wooden box</li>
        </ul>
        
        <p>Questions? Reply to this email or message us on Instagram @hopfarmbeach</p>
        
        <p>See you soon,<br>Cole & Therese</p>
        
        <div class="footer">
          <p>Hop Farm Beach | Humlegårdsstrand, Söderhamn, Sweden</p>
          <p><a href="https://hopfarmbeach.com">hopfarmbeach.com</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: process.env.FROM_EMAIL || "bookings@hopfarmbeach.com",
    to: booking.guestEmail,
    subject: `Booking Confirmed - ${booking.bookingRef} | Hop Farm Beach`,
    html,
  });

  // Send admin notification
  if (process.env.ADMIN_EMAIL) {
    await transporter.sendMail({
      from: process.env.FROM_EMAIL || "bookings@hopfarmbeach.com",
      to: process.env.ADMIN_EMAIL,
      subject: `New Booking: ${booking.bookingRef} - ${booking.guestName}`,
      html: `
        <h2>New Booking Received</h2>
        <p><strong>Reference:</strong> ${booking.bookingRef}</p>
        <p><strong>Guest:</strong> ${booking.guestName} (${booking.guestEmail})</p>
        <p><strong>Dates:</strong> ${formatDate(booking.checkIn)} - ${formatDate(booking.checkOut)}</p>
        <p><strong>Nights:</strong> ${booking.nights}</p>
        <p><strong>Guests:</strong> ${booking.guests}</p>
        <p><strong>Total:</strong> ${formatCurrency(booking.totalAmount, booking.currency)}</p>
      `,
    });
  }
}
