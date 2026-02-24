export function toPascalCase(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9()\- ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

export function normalizeStudentNumber(value: string) {
  const compact = value.replace(/\s+/g, "");
  const match = compact.match(/^(\d{2})[- ]?(\d{4})$/);
  if (!match) return value;
  return `${match[1]}-${match[2]}`;
}

export function formatBirthdate(date: Date) {
  const mm = `${date.getMonth() + 1}`.padStart(2, "0");
  const dd = `${date.getDate()}`.padStart(2, "0");
  const yyyy = `${date.getFullYear()}`;
  return `${mm}/${dd}/${yyyy}`;
}
