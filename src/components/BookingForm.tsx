import { useState } from "react";
import { User, Mail, Phone, Users } from "lucide-react";
import { cn } from "~/lib/utils";

interface BookingFormProps {
  onSubmit: (data: {
    guestName: string;
    guestEmail: string;
    guestPhone?: string;
    guests: number;
  }) => void;
  isSubmitting: boolean;
  disabled: boolean;
  maxGuests: number;
}

export function BookingForm({ onSubmit, isSubmitting, disabled, maxGuests }: BookingFormProps) {
  const [formData, setFormData] = useState({
    guestName: "",
    guestEmail: "",
    guestPhone: "",
    guests: 2,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.guestName.trim()) {
      newErrors.guestName = "Name is required";
    }

    if (!formData.guestEmail.trim()) {
      newErrors.guestEmail = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.guestEmail)) {
      newErrors.guestEmail = "Invalid email address";
    }

    if (formData.guests < 1 || formData.guests > maxGuests) {
      newErrors.guests = `Guests must be between 1 and ${maxGuests}`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-stone-700 mb-2">
          Full Name *
        </label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
          <input
            type="text"
            value={formData.guestName}
            onChange={(e) => setFormData({ ...formData, guestName: e.target.value })}
            placeholder="Your name"
            className={cn(
              "w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-forest/50 transition-colors",
              errors.guestName ? "border-red-300" : "border-stone-300"
            )}
          />
        </div>
        {errors.guestName && (
          <p className="mt-1 text-sm text-red-600">{errors.guestName}</p>
        )}
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-stone-700 mb-2">
          Email *
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
          <input
            type="email"
            value={formData.guestEmail}
            onChange={(e) => setFormData({ ...formData, guestEmail: e.target.value })}
            placeholder="your@email.com"
            className={cn(
              "w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-forest/50 transition-colors",
              errors.guestEmail ? "border-red-300" : "border-stone-300"
            )}
          />
        </div>
        {errors.guestEmail && (
          <p className="mt-1 text-sm text-red-600">{errors.guestEmail}</p>
        )}
      </div>

      {/* Phone (Optional) */}
      <div>
        <label className="block text-sm font-medium text-stone-700 mb-2">
          Phone <span className="text-stone-400">(optional)</span>
        </label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
          <input
            type="tel"
            value={formData.guestPhone}
            onChange={(e) => setFormData({ ...formData, guestPhone: e.target.value })}
            placeholder="+46 70 123 4567"
            className="w-full pl-10 pr-4 py-3 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest/50 transition-colors"
          />
        </div>
      </div>

      {/* Guests */}
      <div>
        <label className="block text-sm font-medium text-stone-700 mb-2">
          Number of Guests *
        </label>
        <div className="relative">
          <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
          <select
            value={formData.guests}
            onChange={(e) => setFormData({ ...formData, guests: parseInt(e.target.value) })}
            className={cn(
              "w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-forest/50 transition-colors appearance-none bg-white",
              errors.guests ? "border-red-300" : "border-stone-300"
            )}
          >
            {Array.from({ length: maxGuests }, (_, i) => i + 1).map((num) => (
              <option key={num} value={num}>
                {num} {num === 1 ? "guest" : "guests"}
              </option>
            ))}
          </select>
        </div>
        {errors.guests && (
          <p className="mt-1 text-sm text-red-600">{errors.guests}</p>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={disabled || isSubmitting}
        className={cn(
          "w-full py-4 rounded-lg font-medium text-white transition-all",
          disabled || isSubmitting
            ? "bg-stone-300 cursor-not-allowed"
            : "bg-forest hover:bg-forest-dark active:scale-[0.98]"
        )}
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Processing...
          </span>
        ) : disabled ? (
          "Select dates first"
        ) : (
          "Continue to Payment"
        )}
      </button>

      <p className="text-xs text-stone-500 text-center">
        You'll be redirected to Stripe for secure payment
      </p>
    </form>
  );
}
