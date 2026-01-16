import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.warn("STRIPE_SECRET_KEY not set - payments will not work");
}

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: "2024-12-18.acacia" })
  : null;

export interface CreateCheckoutParams {
  bookingRef: string;
  guestName: string;
  guestEmail: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  totalAmount: number;
  currency: string;
}

export async function createCheckoutSession(params: CreateCheckoutParams) {
  if (!stripe) {
    throw new Error("Stripe not configured");
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    customer_email: params.guestEmail,
    line_items: [
      {
        price_data: {
          currency: params.currency.toLowerCase(),
          product_data: {
            name: "Hop Farm Beach - Cabin Stay",
            description: `${params.nights} night${params.nights > 1 ? "s" : ""} | ${params.checkIn} to ${params.checkOut}`,
            images: ["https://hopfarmbeach.com/wp-content/uploads/2025/02/Hop-Farm-Beach-exterior.jpg"],
          },
          unit_amount: Math.round(params.totalAmount * 100), // Stripe uses cents
        },
        quantity: 1,
      },
    ],
    metadata: {
      booking_ref: params.bookingRef,
      guest_name: params.guestName,
      check_in: params.checkIn,
      check_out: params.checkOut,
      nights: params.nights.toString(),
    },
    success_url: `${process.env.SITE_URL || "http://localhost:3000"}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.SITE_URL || "http://localhost:3000"}?cancelled=true`,
  });

  return session;
}

export async function retrieveSession(sessionId: string) {
  if (!stripe) {
    throw new Error("Stripe not configured");
  }
  return stripe.checkout.sessions.retrieve(sessionId);
}
