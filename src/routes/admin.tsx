import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/start";
import { useState } from "react";
import { db } from "~/db";
import { bookings, blockedDates, settings } from "~/db/schema";
import { eq, desc } from "drizzle-orm";
import { formatCurrency, formatDate } from "~/lib/utils";
import { Calendar, Lock, Unlock, Settings, List, X, Check } from "lucide-react";

// Server functions
const verifyAdmin = createServerFn({ method: "POST" })
  .validator((password: string) => password)
  .handler(async ({ data: password }) => {
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
    return password === adminPassword;
  });

const getAdminData = createServerFn({ method: "GET" }).handler(async () => {
  const [allBookings, allBlockedDates, allSettings] = await Promise.all([
    db.select().from(bookings).orderBy(desc(bookings.createdAt)),
    db.select().from(blockedDates),
    db.select().from(settings),
  ]);

  const settingsMap: Record<string, string> = {};
  for (const s of allSettings) {
    settingsMap[s.key] = s.value;
  }

  return {
    bookings: allBookings,
    blockedDates: allBlockedDates.map((b) => b.date),
    settings: {
      nightlyRate: settingsMap.nightly_rate || "3495",
      currency: settingsMap.currency || "SEK",
      minNights: settingsMap.min_nights || "1",
      maxGuests: settingsMap.max_guests || "4",
      checkinTime: settingsMap.checkin_time || "15:00",
      checkoutTime: settingsMap.checkout_time || "11:00",
    },
  };
});

const toggleBlockedDate = createServerFn({ method: "POST" })
  .validator((data: { date: string; block: boolean }) => data)
  .handler(async ({ data }) => {
    if (data.block) {
      await db.insert(blockedDates).values({ date: data.date }).onConflictDoNothing();
    } else {
      await db.delete(blockedDates).where(eq(blockedDates.date, data.date));
    }
    return { success: true };
  });

const updateSetting = createServerFn({ method: "POST" })
  .validator((data: { key: string; value: string }) => data)
  .handler(async ({ data }) => {
    await db
      .insert(settings)
      .values({ key: data.key, value: data.value, updatedAt: new Date().toISOString() })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: data.value, updatedAt: new Date().toISOString() },
      });
    return { success: true };
  });

const cancelBooking = createServerFn({ method: "POST" })
  .validator((bookingId: number) => bookingId)
  .handler(async ({ data: bookingId }) => {
    await db
      .update(bookings)
      .set({ status: "cancelled", updatedAt: new Date().toISOString() })
      .where(eq(bookings.id, bookingId));
    return { success: true };
  });

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [adminData, setAdminData] = useState<Awaited<ReturnType<typeof getAdminData>> | null>(null);
  const [activeTab, setActiveTab] = useState<"calendar" | "bookings" | "settings">("calendar");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const valid = await verifyAdmin({ data: password });
    if (valid) {
      setIsAuthenticated(true);
      setAuthError("");
      const data = await getAdminData();
      setAdminData(data);
    } else {
      setAuthError("Invalid password");
    }
  };

  const handleToggleDate = async (date: string) => {
    if (!adminData) return;
    setIsLoading(true);
    const isBlocked = adminData.blockedDates.includes(date);
    await toggleBlockedDate({ data: { date, block: !isBlocked } });
    const data = await getAdminData();
    setAdminData(data);
    setIsLoading(false);
  };

  const handleUpdateSetting = async (key: string, value: string) => {
    setIsLoading(true);
    await updateSetting({ data: { key, value } });
    const data = await getAdminData();
    setAdminData(data);
    setIsLoading(false);
  };

  const handleCancelBooking = async (bookingId: number) => {
    if (!confirm("Are you sure you want to cancel this booking?")) return;
    setIsLoading(true);
    await cancelBooking({ data: bookingId });
    const data = await getAdminData();
    setAdminData(data);
    setIsLoading(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-sm">
          <h1 className="font-dreamers text-3xl text-forest text-center mb-6">
            Hop Farm Beach
          </h1>
          <h2 className="text-xl font-medium text-center mb-6">Admin Login</h2>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-4 py-3 border border-stone-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-forest/50"
            />
            {authError && (
              <p className="text-red-600 text-sm mb-4">{authError}</p>
            )}
            <button
              type="submit"
              className="w-full bg-forest text-white py-3 rounded-lg font-medium hover:bg-forest-dark transition-colors"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!adminData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  // Generate calendar days
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: (Date | null)[] = [];

    // Add empty slots for days before the first day
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const days = getDaysInMonth(currentMonth);
  const bookedDates = new Set<string>();
  adminData.bookings
    .filter((b) => b.status === "confirmed")
    .forEach((b) => {
      const start = new Date(b.checkIn);
      const end = new Date(b.checkOut);
      while (start < end) {
        bookedDates.add(start.toISOString().split("T")[0]);
        start.setDate(start.getDate() + 1);
      }
    });

  return (
    <div className="min-h-screen bg-stone-100">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="font-dreamers text-2xl text-forest">Hop Farm Beach</h1>
          <span className="text-sm text-stone-500">Admin Panel</span>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-stone-200">
        <div className="max-w-6xl mx-auto flex">
          <button
            onClick={() => setActiveTab("calendar")}
            className={`flex items-center gap-2 px-6 py-4 border-b-2 transition-colors ${
              activeTab === "calendar"
                ? "border-forest text-forest"
                : "border-transparent text-stone-500 hover:text-stone-700"
            }`}
          >
            <Calendar className="w-4 h-4" />
            Calendar
          </button>
          <button
            onClick={() => setActiveTab("bookings")}
            className={`flex items-center gap-2 px-6 py-4 border-b-2 transition-colors ${
              activeTab === "bookings"
                ? "border-forest text-forest"
                : "border-transparent text-stone-500 hover:text-stone-700"
            }`}
          >
            <List className="w-4 h-4" />
            Bookings
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`flex items-center gap-2 px-6 py-4 border-b-2 transition-colors ${
              activeTab === "settings"
                ? "border-forest text-forest"
                : "border-transparent text-stone-500 hover:text-stone-700"
            }`}
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
        </div>
      </div>

      <main className="max-w-6xl mx-auto p-4">
        {/* Calendar Tab */}
        {activeTab === "calendar" && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-medium">
                {currentMonth.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                  className="px-3 py-1 border border-stone-300 rounded hover:bg-stone-50"
                >
                  ←
                </button>
                <button
                  onClick={() => setCurrentMonth(new Date())}
                  className="px-3 py-1 border border-stone-300 rounded hover:bg-stone-50"
                >
                  Today
                </button>
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                  className="px-3 py-1 border border-stone-300 rounded hover:bg-stone-50"
                >
                  →
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="text-center text-sm text-stone-500 py-2">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {days.map((day, i) => {
                if (!day) {
                  return <div key={i} className="aspect-square" />;
                }
                const dateStr = day.toISOString().split("T")[0];
                const isBlocked = adminData.blockedDates.includes(dateStr);
                const isBooked = bookedDates.has(dateStr);
                const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));

                return (
                  <button
                    key={i}
                    onClick={() => !isPast && !isBooked && handleToggleDate(dateStr)}
                    disabled={isPast || isBooked || isLoading}
                    className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-colors ${
                      isPast
                        ? "bg-stone-100 text-stone-400 cursor-not-allowed"
                        : isBooked
                        ? "bg-blue-100 text-blue-700 cursor-not-allowed"
                        : isBlocked
                        ? "bg-red-100 text-red-700 hover:bg-red-200"
                        : "bg-green-50 text-green-700 hover:bg-green-100"
                    }`}
                  >
                    <span>{day.getDate()}</span>
                    {isBooked && <span className="text-[10px]">Booked</span>}
                    {isBlocked && !isBooked && <span className="text-[10px]">Blocked</span>}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-50 border border-green-200 rounded" />
                <span>Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-100 border border-red-200 rounded" />
                <span>Blocked</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-100 border border-blue-200 rounded" />
                <span>Booked</span>
              </div>
            </div>
          </div>
        )}

        {/* Bookings Tab */}
        {activeTab === "bookings" && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-sm">Ref</th>
                    <th className="text-left px-4 py-3 font-medium text-sm">Guest</th>
                    <th className="text-left px-4 py-3 font-medium text-sm">Dates</th>
                    <th className="text-left px-4 py-3 font-medium text-sm">Amount</th>
                    <th className="text-left px-4 py-3 font-medium text-sm">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {adminData.bookings.map((booking) => (
                    <tr key={booking.id} className="border-b border-stone-100 hover:bg-stone-50">
                      <td className="px-4 py-3 font-mono text-sm">{booking.bookingRef}</td>
                      <td className="px-4 py-3">
                        <div>{booking.guestName}</div>
                        <div className="text-sm text-stone-500">{booking.guestEmail}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {formatDate(booking.checkIn)} - {formatDate(booking.checkOut)}
                        <div className="text-stone-500">{booking.nights} nights</div>
                      </td>
                      <td className="px-4 py-3">
                        {formatCurrency(booking.totalAmount, booking.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            booking.status === "confirmed"
                              ? "bg-green-100 text-green-700"
                              : booking.status === "pending"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {booking.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {booking.status === "confirmed" && (
                          <button
                            onClick={() => handleCancelBooking(booking.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {adminData.bookings.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-stone-500">
                        No bookings yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-medium mb-6">Settings</h2>
            <div className="space-y-6 max-w-md">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Nightly Rate (SEK)
                </label>
                <input
                  type="number"
                  defaultValue={adminData.settings.nightlyRate}
                  onBlur={(e) => handleUpdateSetting("nightly_rate", e.target.value)}
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Minimum Nights
                </label>
                <input
                  type="number"
                  min="1"
                  defaultValue={adminData.settings.minNights}
                  onBlur={(e) => handleUpdateSetting("min_nights", e.target.value)}
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Max Guests
                </label>
                <input
                  type="number"
                  min="1"
                  defaultValue={adminData.settings.maxGuests}
                  onBlur={(e) => handleUpdateSetting("max_guests", e.target.value)}
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Check-in Time
                </label>
                <input
                  type="time"
                  defaultValue={adminData.settings.checkinTime}
                  onBlur={(e) => handleUpdateSetting("checkin_time", e.target.value)}
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Check-out Time
                </label>
                <input
                  type="time"
                  defaultValue={adminData.settings.checkoutTime}
                  onBlur={(e) => handleUpdateSetting("checkout_time", e.target.value)}
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest/50"
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
