import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/start";
import { db } from "~/db";
import { bookings } from "~/db/schema";
import { eq } from "drizzle-orm";
import { retrieveSession } from "~/lib/stripe";
import { sendBookingConfirmation } from "~/lib/email";
import { formatCurrency, formatDate } from "~/lib/utils";
import { CheckCircle } from "lucide-react";

const confirmBooking = createServerFn({ method: "GET" })
  .validator((sessionId: string) => sessionId)
  .handler(async ({ data: sessionId }) => {
    // Retrieve Stripe session
    const session = await retrieveSession(sessionId);
    
    if (!session || session.payment_status !== "paid") {
      throw new Error("Payment not completed");
    }

    // Find and update booking
    const [booking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.stripeSessionId, sessionId));

    if (!booking) {
      throw new Error("Booking not found");
    }

    // Update to confirmed if still pending
    if (booking.status === "pending") {
      await db
        .update(bookings)
        .set({
          status: "confirmed",
          stripePaymentIntent: session.payment_intent as string,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(bookings.id, booking.id));

      // Send confirmation email
      const updatedBooking = { ...booking, status: "confirmed" };
      await sendBookingConfirmation(updatedBooking);
    }

    return {
      bookingRef: booking.bookingRef,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      nights: booking.nights,
      guests: booking.guests,
      totalAmount: booking.totalAmount,
      currency: booking.currency,
    };
  });

export const Route = createFileRoute("/success")({
  component: SuccessPage,
  validateSearch: (search: Record<string, unknown>) => ({
    session_id: search.session_id as string | undefined,
  }),
  loaderDeps: ({ search }) => ({ sessionId: search.session_id }),
  loader: async ({ deps }) => {
    if (!deps.sessionId) {
      throw new Error("No session ID provided");
    }
    return confirmBooking({ data: deps.sessionId });
  },
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-2xl font-medium mb-4">Something went wrong</h1>
        <p className="text-stone-600 mb-6">{error.message}</p>
        <Link to="/" className="text-forest underline">
          Return to booking
        </Link>
      </div>
    </div>
  ),
});

function SuccessPage() {
  const booking = Route.useLoaderData();

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="py-8 px-4 text-center border-b border-stone-200">
        <h1 className="font-dreamers text-4xl md:text-5xl text-forest mb-2">
          Hop Farm Beach
        </h1>
      </header>

      <main className="max-w-xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-forest/10 rounded-full mb-4">
            <CheckCircle className="w-8 h-8 text-forest" />
          </div>
          <h2 className="text-2xl font-medium mb-2">Booking Confirmed</h2>
          <p className="text-stone-600">
            We've sent a confirmation to {booking.guestEmail}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
          <div className="p-6 border-b border-stone-100">
            <div className="text-sm text-stone-500 mb-1">Booking Reference</div>
            <div className="text-xl font-mono font-medium">{booking.bookingRef}</div>
          </div>

          <div className="p-6 space-y-4">
            <div className="flex justify-between">
              <span className="text-stone-600">Guest</span>
              <span className="font-medium">{booking.guestName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-600">Check-in</span>
              <span>{formatDate(booking.checkIn)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-600">Check-out</span>
              <span>{formatDate(booking.checkOut)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-600">Nights</span>
              <span>{booking.nights}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-600">Guests</span>
              <span>{booking.guests}</span>
            </div>
            <div className="flex justify-between pt-4 border-t border-stone-200">
              <span className="font-medium">Total Paid</span>
              <span className="font-medium">
                {formatCurrency(booking.totalAmount, booking.currency)}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-8 p-6 bg-stone-50 rounded-xl">
          <h3 className="font-medium mb-4">What happens next?</h3>
          <ul className="space-y-3 text-stone-600">
            <li className="flex gap-3">
              <span className="text-forest">•</span>
              <span>We'll send you the address a few days before arrival</span>
            </li>
            <li className="flex gap-3">
              <span className="text-forest">•</span>
              <span>Self check-in with key lockbox - code in your email</span>
            </li>
            <li className="flex gap-3">
              <span className="text-forest">•</span>
              <span>Questions? Email us at cole@hopfarmbeach.com</span>
            </li>
          </ul>
        </div>

        <div className="mt-8 text-center">
          <Link
            to="/"
            className="text-forest underline hover:text-forest-dark"
          >
            Back to Hop Farm Beach
          </Link>
        </div>
      </main>
    </div>
  );
}
