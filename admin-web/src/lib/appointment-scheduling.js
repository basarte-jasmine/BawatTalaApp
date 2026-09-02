export const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const COUNSELOR_COLORS = ["#3B82F6", "#10B981", "#8B5CF6"];
export const CONCERN_STYLES = {
  "Personal problems": "bg-sky-50 text-sky-700",
  "Mental health": "bg-emerald-50 text-emerald-700",
  "Academic problems": "bg-indigo-50 text-indigo-700",
  "Interpersonal relationships": "bg-purple-50 text-purple-700",
  "Peer relationship": "bg-purple-50 text-purple-700",
  "Family relationship": "bg-amber-50 text-amber-700",
  "Romantic relationship": "bg-pink-50 text-pink-700",
  "Career guidance": "bg-slate-100 text-slate-700",
  "Financial guidance": "bg-lime-50 text-lime-700",
  Anxiety: "bg-cyan-50 text-cyan-700",
  Stress: "bg-orange-50 text-orange-700",
  Bullying: "bg-rose-50 text-rose-700",
  Adjustment: "bg-teal-50 text-teal-700",
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

export function addDaysToIsoDate(isoDate, days) {
  const date = new Date(`${isoDate}T12:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  date.setUTCDate(date.getUTCDate() + days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getMinimumBookingIsoDate() {
  return addDaysToIsoDate(getTodayIsoDate(), 2);
}

export function getManilaYearMonthParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
  };
}

export function getManilaMonthDate(date = new Date()) {
  const { year, month } = getManilaYearMonthParts(date);
  return new Date(`${year}-${String(month).padStart(2, "0")}-01T12:00:00+08:00`);
}

export function addMonthsManila(date, delta) {
  const { year, month } = getManilaYearMonthParts(date);
  const shifted = month - 1 + delta;
  const nextYear = year + Math.floor(shifted / 12);
  const nextMonth = ((shifted % 12) + 12) % 12 + 1;
  return new Date(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01T12:00:00+08:00`);
}

export function getMonthTitle(date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function getMonthKey(date) {
  const { year, month } = getManilaYearMonthParts(date);
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function buildCalendarCells(date) {
  const { year, month } = getManilaYearMonthParts(date);
  const firstOfMonth = new Date(`${year}-${String(month).padStart(2, "0")}-01T12:00:00+08:00`);
  const firstDay = firstOfMonth.getUTCDay();
  const totalDays = new Date(Date.UTC(year, month, 0, 12, 0, 0)).getUTCDate();
  const cells = [];
  for (let index = 0; index < firstDay; index += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= totalDays; day += 1) {
    const isoDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({ day, isoDate });
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

export function toFirstDayIso(date) {
  const { year, month } = getManilaYearMonthParts(date);
  return `${year}-${String(month).padStart(2, "0")}-01`;
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
  if (normalized === "PENDING") return "bg-amber-100 text-amber-700";
  if (normalized === "DECLINED") return "bg-rose-100 text-rose-700";
  if (normalized === "CANCELLED") return "bg-rose-100 text-rose-700";
  if (normalized === "COMPLETED") return "bg-slate-200 text-slate-700";
  return "bg-emerald-100 text-emerald-700";
}

export function isPastIsoDate(isoDate) {
  return isoDate < getTodayIsoDate();
}

export function isBlockedByBookingLeadTime(isoDate) {
  return isoDate < getMinimumBookingIsoDate();
}

export function getAvailableSlotsForDate({
  availability,
  availabilityOverrides = [],
  counselorId,
  isoDate,
  monthAppointments,
  slotTimes,
  ignoreAppointmentId = "",
  studentNumber = "",
}) {
  if (!counselorId || !isoDate) return [];
  if (isBlockedByBookingLeadTime(isoDate)) return [];
  const availabilityMap = buildAvailabilityMap(availability, counselorId);
  const overrideMap = buildAvailabilityOverrideMap(availabilityOverrides, counselorId);
  const dayOfWeek = new Date(`${isoDate}T12:00:00+08:00`).getUTCDay();
  const bookedSlots = new Set(
    monthAppointments
      .filter(
        (item) =>
          item.counselorId === counselorId &&
          item.appointmentDate === isoDate &&
          item.id !== ignoreAppointmentId &&
          ["PENDING", "CONFIRMED"].includes(String(item.status || "").toUpperCase()),
      )
      .map((item) => `${item.appointmentDate}:${item.slotTime}`),
  );
  const studentHasAppointmentOnDate = Boolean(studentNumber) && monthAppointments.some(
    (item) =>
      item.studentNumber === studentNumber &&
      item.appointmentDate === isoDate &&
      item.id !== ignoreAppointmentId &&
      ["PENDING", "CONFIRMED"].includes(String(item.status || "").toUpperCase()),
  );
  if (studentHasAppointmentOnDate) return [];

  return slotTimes.filter((slot) => {
    const overrideKey = `${isoDate}:${slot.value}`;
    const enabled = overrideMap.has(overrideKey)
      ? overrideMap.get(overrideKey) === true
      : availabilityMap.get(`${dayOfWeek}:${slot.value}`) === true;
    const booked = bookedSlots.has(`${isoDate}:${slot.value}`);
    return enabled && !booked && !isPastIsoDate(isoDate);
  });
}
