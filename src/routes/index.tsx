import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/start";
import { useState, useEffect } from "react";
import { db } from "~/db";
import { bookings, blockedDates, settings } from "~/db/schema";
import { eq, and, gte, lte, or } from "drizzle-orm";
import { Calendar } from "~/components/Calendar";
import { BookingForm } from "~/components/BookingForm";
import { formatCurrency, calculateNights, getDatesInRange, generateBookingRef } from "~/lib/utils";
import { createCheckoutSession } from "~/lib/stripe";

// Server function to get unavailable dates
const getUnavailableDates = createServerFn({ method: "GET" }).handler(async () => {
  const blocked = await db.select().from(blockedDates);
  const confirmedBookings = await db
    .select()
    .from(bookings)
    .where(eq(bookings.status, "confirmed"));

  const unavailable = new Set<string>();

  // Add blocked dates
  for (const b of blocked) {
    unavailable.add(b.date);
  }

  // Add dates from confirmed bookings
  for (const booking of confirmedBookings) {
    const dates = getDatesInRange(new Date(booking.checkIn), new Date(booking.checkOut));
    dates.forEach((d) => unavailable.add(d));
  }

  return Array.from(unavailable);
});

// Server function to get settings
const getSettings = createServerFn({ method: "GET" }).handler(async () => {
  const allSettings = await db.select().from(settings);
  const settingsMap: Record<string, string> = {};
  for (const s of allSettings) {
    settingsMap[s.key] = s.value;
  }
  return {
    nightlyRate: parseInt(settingsMap.nightly_rate || "3495"),
    currency: settingsMap.currency || "SEK",
    minNights: parseInt(settingsMap.min_nights || "1"),
    maxGuests: parseInt(settingsMap.max_guests || "4"),
    checkinTime: settingsMap.checkin_time || "15:00",
    checkoutTime: settingsMap.checkout_time || "11:00",
  };
});

// Server function to create booking and checkout session
const createBooking = createServerFn({ method: "POST" })
  .validator((data: {
    guestName: string;
    guestEmail: string;
    guestPhone?: string;
    checkIn: string;
    checkOut: string;
    guests: number;
  }) => data)
  .handler(async ({ data }) => {
    const settingsData = await getSettings();
    const nights = calculateNights(data.checkIn, data.checkOut);
    const totalAmount = nights * settingsData.nightlyRate;
    const bookingRef = generateBookingRef();

    // Check availability again
    const unavailable = await getUnavailableDates();
    const requestedDates = getDatesInRange(new Date(data.checkIn), new Date(data.checkOut));
    const conflict = requestedDates.some((d) => unavailable.includes(d));

    if (conflict) {
      throw new Error("Selected dates are no longer available");
    }

    // Create checkout session
    const session = await createCheckoutSession({
      bookingRef,
      guestName: data.guestName,
      guestEmail: data.guestEmail,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      nights,
      totalAmount,
      currency: settingsData.currency,
    });

    // Save pending booking
    await db.insert(bookings).values({
      bookingRef,
      guestName: data.guestName,
      guestEmail: data.guestEmail,
      guestPhone: data.guestPhone || null,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      nights,
      guests: data.guests,
      totalAmount,
      currency: settingsData.currency,
      stripeSessionId: session.id,
      status: "pending",
    });

    return { checkoutUrl: session.url };
  });

export const Route = createFileRoute("/")({
  component: BookingPage,
  loader: async () => {
    const [unavailableDates, settings] = await Promise.all([
      getUnavailableDates(),
      getSettings(),
    ]);
    return { unavailableDates, settings };
  },
});

function BookingPage() {
  const { unavailableDates, settings } = Route.useLoaderData();
  const navigate = useNavigate();
  const [selectedRange, setSelectedRange] = useState<{ from: Date | null; to: Date | null }>({
    from: null,
    to: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nights = selectedRange.from && selectedRange.to
    ? calculateNights(
        selectedRange.from.toISOString().split("T")[0],
        selectedRange.to.toISOString().split("T")[0]
      )
    : 0;
  const totalAmount = nights * settings.nightlyRate;

  const handleSubmit = async (formData: {
    guestName: string;
    guestEmail: string;
    guestPhone?: string;
    guests: number;
  }) => {
    if (!selectedRange.from || !selectedRange.to) {
      setError("Please select your dates");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createBooking({
        data: {
          ...formData,
          checkIn: selectedRange.from.toISOString().split("T")[0],
          checkOut: selectedRange.to.toISOString().split("T")[0],
        },
      });

      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="py-8 px-4 text-center border-b border-stone-200">
        <h1 className="font-dreamers text-4xl md:text-5xl text-forest mb-2">
          Hop Farm Beach
        </h1>
        <p className="text-stone-600 font-roobert">
          Forest. Beach. No WiFi.
        </p>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-2 gap-12">
          {/* Left: Calendar */}
          <div>
            <h2 className="font-roobert text-xl font-medium mb-6">
              Select your dates
            </h2>
            <Calendar
              unavailableDates={unavailableDates}
              selectedRange={selectedRange}
              onSelect={setSelectedRange}
              minNights={settings.minNights}
            />
            
            {nights > 0 && (
              <div className="mt-6 p-4 bg-stone-100 rounded-lg">
                <div className="flex justify-between items-center text-stone-700 mb-2">
                  <span>{settings.nightlyRate.toLocaleString()} kr × {nights} night{nights > 1 ? "s" : ""}</span>
                  <span>{formatCurrency(totalAmount, settings.currency)}</span>
                </div>
                <div className="flex justify-between items-center font-medium text-lg border-t border-stone-300 pt-2 mt-2">
                  <span>Total</span>
                  <span>{formatCurrency(totalAmount, settings.currency)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Right: Booking Form */}
          <div>
            <h2 className="font-roobert text-xl font-medium mb-6">
              Your details
            </h2>
            <BookingForm
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
              disabled={nights === 0}
              maxGuests={settings.maxGuests}
            />
            
            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Info Section */}
        <section className="mt-16 pt-12 border-t border-stone-200">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <h3 className="font-medium mb-2">Check-in</h3>
              <p className="text-stone-600">{settings.checkinTime}</p>
            </div>
            <div>
              <h3 className="font-medium mb-2">Check-out</h3>
              <p className="text-stone-600">{settings.checkoutTime}</p>
            </div>
            <div>
              <h3 className="font-medium mb-2">Max Guests</h3>
              <p className="text-stone-600">{settings.maxGuests} people</p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-8 px-4 text-center text-stone-500 text-sm border-t border-stone-200">
        <p>Hop Farm Beach · Humlegårdsstrand, Söderhamn, Sweden</p>
        <p className="mt-2">
          <a href="https://hopfarmbeach.com" className="underline hover:text-stone-700">
            hopfarmbeach.com
          </a>
        </p>
      </footer>
    </div>
  );
}
