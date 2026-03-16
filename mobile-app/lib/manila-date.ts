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
