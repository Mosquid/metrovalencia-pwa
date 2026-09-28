const MADRID_TZ = "Europe/Madrid";

function madridParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MADRID_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, Number(part.value)])) as Record<
    "year" | "month" | "day" | "hour" | "minute" | "second",
    number
  >;
}

export function minutesUntilMadridTime(time: string, now = new Date()) {
  const match = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(time);
  if (!match) throw new Error(`Invalid departure time: ${time}`);

  const current = madridParts(now);
  const nowWallClock = Date.UTC(
    current.year,
    current.month - 1,
    current.day,
    current.hour,
    current.minute,
    current.second,
  );
  let departureWallClock = Date.UTC(
    current.year,
    current.month - 1,
    current.day,
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  );

  if (departureWallClock < nowWallClock - 5 * 60_000) {
    departureWallClock += 24 * 60 * 60_000;
  }

  return Math.max(0, Math.ceil((departureWallClock - nowWallClock) / 60_000));
}

export function madridTimestamp(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: MADRID_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(now);
}
