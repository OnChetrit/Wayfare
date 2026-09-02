export type DateTimeFieldMode = 'date' | 'time';

export function dateTimePickerDate(value: string, mode: DateTimeFieldMode) {
  const normalized = mode === 'date' ? `${value}T12:00` : `2000-01-01T${value}`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function dateTimeFieldValue(value: Date, mode: DateTimeFieldMode) {
  const pad = (part: number) => String(part).padStart(2, '0');
  if (mode === 'time') return `${pad(value.getHours())}:${pad(value.getMinutes())}`;
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}
