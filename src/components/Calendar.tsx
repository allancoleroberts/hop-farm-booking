import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "~/lib/utils";

interface CalendarProps {
  unavailableDates: string[];
  selectedRange: { from: Date | null; to: Date | null };
  onSelect: (range: { from: Date | null; to: Date | null }) => void;
  minNights: number;
}

export function Calendar({ unavailableDates, selectedRange, onSelect, minNights }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectingTo, setSelectingTo] = useState(false);

  const unavailableSet = new Set(unavailableDates);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: (Date | null)[] = [];

    // Add empty slots for days before the first day (starting from Monday)
    const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const isDateUnavailable = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    return unavailableSet.has(dateStr);
  };

  const isDatePast = (date: Date) => {
    return date < today;
  };

  const isDateInRange = (date: Date) => {
    if (!selectedRange.from || !selectedRange.to) return false;
    return date >= selectedRange.from && date < selectedRange.to;
  };

  const isDateSelected = (date: Date) => {
    if (selectedRange.from && date.getTime() === selectedRange.from.getTime()) return true;
    if (selectedRange.to && date.getTime() === selectedRange.to.getTime()) return true;
    return false;
  };

  const handleDateClick = (date: Date) => {
    if (isDatePast(date) || isDateUnavailable(date)) return;

    if (!selectedRange.from || (selectedRange.from && selectedRange.to)) {
      // Start new selection
      onSelect({ from: date, to: null });
      setSelectingTo(true);
    } else if (selectingTo) {
      // Complete selection
      if (date <= selectedRange.from) {
        // If clicked date is before or same as start, restart
        onSelect({ from: date, to: null });
      } else {
        // Check if any dates in range are unavailable
        const checkDate = new Date(selectedRange.from);
        while (checkDate < date) {
          if (isDateUnavailable(checkDate)) {
            // Can't select this range
            return;
          }
          checkDate.setDate(checkDate.getDate() + 1);
        }
        onSelect({ from: selectedRange.from, to: date });
        setSelectingTo(false);
      }
    }
  };

  const days = getDaysInMonth(currentMonth);

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4 md:p-6">
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={prevMonth}
          className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
          disabled={currentMonth.getMonth() === today.getMonth() && currentMonth.getFullYear() === today.getFullYear()}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h3 className="font-medium">
          {currentMonth.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
        </h3>
        <button
          onClick={nextMonth}
          className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <div key={day} className="text-center text-xs text-stone-500 py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          if (!day) {
            return <div key={i} className="aspect-square" />;
          }

          const isPast = isDatePast(day);
          const isUnavailable = isDateUnavailable(day);
          const isSelected = isDateSelected(day);
          const isInRange = isDateInRange(day);
          const isCheckIn = selectedRange.from && day.getTime() === selectedRange.from.getTime();
          const isCheckOut = selectedRange.to && day.getTime() === selectedRange.to.getTime();

          return (
            <button
              key={i}
              onClick={() => handleDateClick(day)}
              disabled={isPast || isUnavailable}
              className={cn(
                "aspect-square rounded-lg flex items-center justify-center text-sm transition-all relative",
                isPast && "text-stone-300 cursor-not-allowed",
                isUnavailable && !isPast && "bg-stone-100 text-stone-400 cursor-not-allowed line-through",
                !isPast && !isUnavailable && !isSelected && !isInRange && "hover:bg-forest/10 text-stone-700",
                isInRange && "bg-forest/10",
                isSelected && "bg-forest text-white font-medium",
                isCheckIn && "rounded-r-none",
                isCheckOut && "rounded-l-none"
              )}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-stone-100 flex flex-wrap gap-4 text-xs text-stone-500">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-forest rounded" />
          <span>Selected</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-stone-100 rounded" />
          <span>Unavailable</span>
        </div>
      </div>

      {/* Selection Info */}
      {selectedRange.from && (
        <div className="mt-4 p-3 bg-forest/5 rounded-lg text-sm">
          <div className="flex justify-between">
            <span className="text-stone-600">Check-in</span>
            <span className="font-medium">
              {selectedRange.from.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
            </span>
          </div>
          {selectedRange.to && (
            <div className="flex justify-between mt-1">
              <span className="text-stone-600">Check-out</span>
              <span className="font-medium">
                {selectedRange.to.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
              </span>
            </div>
          )}
          {!selectedRange.to && (
            <p className="text-forest mt-2">Select your check-out date</p>
          )}
        </div>
      )}
    </div>
  );
}
