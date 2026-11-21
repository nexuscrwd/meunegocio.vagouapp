export function parseDurationToMinutes(
  input?: string | number | null,
  fallback: number = 40
): number {
  if (typeof input === 'number' && Number.isFinite(input) && input > 0) {
    return Math.round(input);
  }
  if (input === null || input === undefined) {
    return fallback;
  }

  const raw = String(input).trim().toLowerCase();
  if (!raw) return fallback;

  if (/^\d+$/.test(raw)) {
    const val = parseInt(raw, 10);
    return val > 0 ? val : fallback;
  }

  const colonMatch = raw.match(/^(\d{1,2}):(\d{1,2})$/);
  if (colonMatch) {
    const hours = parseInt(colonMatch[1], 10);
    const mins = parseInt(colonMatch[2], 10);
    const total = hours * 60 + mins;
    return total > 0 ? total : fallback;
  }

  let totalMinutes = 0;
  let matchedUnit = false;

  const hourMatch = raw.match(/(\d+(?:[.,]\d+)?)\s*(?:horas?|hrs?|h)\b/);
  if (hourMatch) {
    const hoursFloat = parseFloat(hourMatch[1].replace(',', '.'));
    if (Number.isFinite(hoursFloat)) {
      totalMinutes += Math.round(hoursFloat * 60);
      matchedUnit = true;
    }

    const afterHour = raw.slice((hourMatch.index ?? 0) + hourMatch[0].length);
    const trailingMinMatch = afterHour.match(/^\s*(\d{1,2})\s*(?:minutos?|mins?|min|m)?\b/);
    if (trailingMinMatch && !raw.match(/(\d+)\s*(?:minutos?|mins?|min|m)\b/)) {
      const extraMins = parseInt(trailingMinMatch[1], 10);
      if (Number.isFinite(extraMins)) {
        totalMinutes += extraMins;
      }
    }
  }

  const minMatch = raw.match(/(\d+)\s*(?:minutos?|mins?|min|m)\b/);
  if (minMatch) {
    const mins = parseInt(minMatch[1], 10);
    if (Number.isFinite(mins)) {
      totalMinutes += mins;
      matchedUnit = true;
    }
  }

  if (matchedUnit && totalMinutes > 0) {
    return totalMinutes;
  }

  const digits = parseInt(raw.replace(/\D/g, ''), 10);
  return Number.isFinite(digits) && digits > 0 ? digits : fallback;
}

export function formatDurationFromMinutes(minutes?: number | null): string {
  const total = typeof minutes === 'number' && Number.isFinite(minutes) && minutes > 0
    ? Math.round(minutes)
    : 40;

  if (total >= 60) {
    const hours = Math.floor(total / 60);
    const rem = total % 60;
    return rem > 0 ? `${hours}h ${rem}min` : `${hours}h`;
  }

  return `${total} min`;
}
