const APP_TIME_ZONE = 'Asia/Jakarta';

/**
 * Converts an ISO timestamp to the wall-clock format expected by
 * <input type="datetime-local">. Admin scheduling is intentionally shown in
 * the business timezone instead of the Worker runtime timezone (which is UTC).
 */
export function formatDateTimeLocal(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '';

  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date).replace(' ', 'T');
}

/** Parse a datetime-local value as Asia/Jakarta, not as the Worker timezone. */
export function parseDateTimeLocal(value: string) {
  if (!value) return null;
  const normalized = value.length === 16 ? `${value}:00` : value;
  const parsed = new Date(`${normalized}+07:00`);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
}
