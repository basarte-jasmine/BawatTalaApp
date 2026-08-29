type ManilaDateParts = {
  day: number;
  isoDate: string;
  monthIndex: number;
  year: number;
};

export function getManilaTodayParts(date = new Date()): ManilaDateParts {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);

    const year = Number(parts.find((part) => part.type === "year")?.value ?? "0");
    const month = Number(parts.find((part) => part.type === "month")?.value ?? "1");
    const day = Number(parts.find((part) => part.type === "day")?.value ?? "1");

    return {
      year,
      monthIndex: month - 1,
      day,
      isoDate: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    };
  } catch {
    const utcTime = date.getTime() + date.getTimezoneOffset() * 60 * 1000;
    const manilaDate = new Date(utcTime + 8 * 60 * 60 * 1000);
    const year = manilaDate.getUTCFullYear();
    const month = manilaDate.getUTCMonth() + 1;
    const day = manilaDate.getUTCDate();

    return {
      year,
      monthIndex: month - 1,
      day,
      isoDate: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    };
  }
}

export function getManilaNow(date = new Date()): Date {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(date);
    const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
    let hour = read("hour");
    if (hour === 24) hour = 0;
    return new Date(read("year"), read("month") - 1, read("day"), hour, read("minute"), read("second"));
  } catch {
    const today = getManilaTodayParts(date);
    return new Date(today.year, today.monthIndex, today.day, date.getHours(), date.getMinutes(), date.getSeconds());
  }
}

export function getManilaStartOfToday(date = new Date()): Date {
  const today = getManilaTodayParts(date);
  return new Date(today.year, today.monthIndex, today.day);
}

export function getManilaWeekdayIndex(year: number, monthIndex: number, day: number) {
  const month = String(monthIndex + 1).padStart(2, "0");
  const date = String(day).padStart(2, "0");
  return new Date(`${year}-${month}-${date}T12:00:00+08:00`).getUTCDay();
}

export function getManilaDaysInMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function getManilaMonthName(monthIndex: number, year: number) {
  const month = String(monthIndex + 1).padStart(2, "0");
  const date = new Date(`${year}-${month}-01T12:00:00+08:00`);
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      month: "long",
    }).format(date);
  } catch {
    return [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ][monthIndex] ?? "";
  }
}
