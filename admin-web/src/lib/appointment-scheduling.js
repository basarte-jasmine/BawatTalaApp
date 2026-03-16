export const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const COUNSELOR_COLORS = ["#3B82F6", "#10B981", "#8B5CF6"];
export const CONCERN_STYLES = {
  "Academic Stress": "bg-sky-50 text-sky-700",
  "Anxiety / Stress": "bg-emerald-50 text-emerald-700",
  Relationships: "bg-purple-50 text-purple-700",
  "Family Issues": "bg-amber-50 text-amber-700",
  "Career Guidance": "bg-slate-100 text-slate-700",
  "Financial Concerns": "bg-lime-50 text-lime-700",
  "Burnout / Exhaustion": "bg-orange-50 text-orange-700",
  Bullying: "bg-rose-50 text-rose-700",
  Others: "bg-gray-100 text-gray-700",
};

export function getTodayIsoDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function getMonthTitle(date) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function getMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function buildCalendarCells(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const cells = [];
  for (let index = 0; index < firstDay; index += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= totalDays; day += 1) {
    const isoDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({ day, isoDate });
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

export function toFirstDayIso(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

export function formatDisplayDate(isoDate) {
  return new Date(`${isoDate}T12:00:00+08:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    weekday: "long",
    year: "numeric",
  });
}

export function buildAvailabilityMap(availability, counselorId) {
  const row = availability.find((item) => item.counselorId === counselorId);
  const map = new Map();
  for (const slot of row?.slots || []) {
    map.set(`${slot.dayOfWeek}:${slot.slotTime}`, Boolean(slot.isEnabled));
  }
  return map;
}

export function buildAvailabilityOverrideMap(availabilityOverrides, counselorId) {
  const map = new Map();
  for (const override of availabilityOverrides || []) {
    if (override.counselorId === counselorId) {
      map.set(`${override.overrideDate}:${override.slotTime}`, Boolean(override.isEnabled));
    }
  }
  return map;
}

export function getWeekDatesForIso(isoDate) {
  const anchor = new Date(`${isoDate}T12:00:00+08:00`);
  const dayOfWeek = anchor.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  return [1, 2, 3, 4, 5].map((weekdayIndex) => {
    const date = new Date(anchor);
    date.setUTCDate(anchor.getUTCDate() + mondayOffset + (weekdayIndex - 1));
    return {
      dayOfWeek: weekdayIndex,
      dayLabel: WEEKDAY_HEADERS[weekdayIndex],
      isoDate: new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(date),
    };
  });
}

export function getConcernClassName(concern) {
  return CONCERN_STYLES[concern] || CONCERN_STYLES.Others;
}

export function getStatusClassName(status) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "CANCELLED") return "bg-rose-100 text-rose-700";
  if (normalized === "COMPLETED") return "bg-slate-200 text-slate-700";
  return "bg-emerald-100 text-emerald-700";
}

export function isPastIsoDate(isoDate) {
  return isoDate < getTodayIsoDate();
}

export function getAvailableSlotsForDate({
  availability,
  counselorId,
  isoDate,
  monthAppointments,
  slotTimes,
  ignoreAppointmentId = "",
}) {
  if (!counselorId || !isoDate) return [];
  const availabilityMap = buildAvailabilityMap(availability, counselorId);
  const dayOfWeek = new Date(`${isoDate}T12:00:00+08:00`).getUTCDay();
  const bookedSlots = new Set(
    monthAppointments
      .filter(
        (item) =>
          item.counselorId === counselorId &&
          item.appointmentDate === isoDate &&
          item.id !== ignoreAppointmentId &&
          String(item.status || "").toUpperCase() === "CONFIRMED",
      )
      .map((item) => `${item.appointmentDate}:${item.slotTime}`),
  );

  return slotTimes.filter((slot) => {
    const enabled = availabilityMap.get(`${dayOfWeek}:${slot.value}`) === true;
    const booked = bookedSlots.has(`${isoDate}:${slot.value}`);
    return enabled && !booked && !isPastIsoDate(isoDate);
  });
}
