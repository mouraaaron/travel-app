const MONTH_ABBREVIATIONS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

export function parseFormDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatFormDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatLabelDate(value: string): string {
  const date = parseFormDate(value) as Date;
  return `${date.getDate()} ${MONTH_ABBREVIATIONS[date.getMonth()]}`;
}

export function formatTripDateLabel(
  departureDate: string | undefined,
  mode: "range" | "single",
  returnDate?: string
): string {
  if (!departureDate) return "Selecione a data";
  if (mode === "single" || !returnDate) return formatLabelDate(departureDate);
  return `${formatLabelDate(departureDate)} — ${formatLabelDate(returnDate)}`;
}

export function isConfirmEnabled(departureDate: string | undefined): boolean {
  return Boolean(departureDate);
}
