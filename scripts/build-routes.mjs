import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = resolve(process.argv[2] ?? "data/gtfs");
const output = resolve("lib/route-data.generated.json");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...values] = rows;
  return values.map((valuesRow) => Object.fromEntries(header.map((key, index) => [key, valuesRow[index] ?? ""])));
}

const normalize = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const [routes, trips, stops, stopTimes] = await Promise.all(
  ["routes.txt", "trips.txt", "stops.txt", "stop_times.txt"].map(async (file) =>
    parseCsv(await readFile(resolve(source, file), "utf8")),
  ),
);

const lineByRoute = new Map(routes.map((route) => [route.route_id, route.route_short_name]));
const stopById = new Map(stops.map((stop) => [stop.stop_id, stop.stop_name]));
const tripById = new Map(
  trips.map((trip) => [trip.trip_id, { line: lineByRoute.get(trip.route_id), destination: trip.trip_headsign }]),
);
const stopIdsByTrip = new Map();

for (const stopTime of stopTimes) {
  if (!tripById.has(stopTime.trip_id)) continue;
  const list = stopIdsByTrip.get(stopTime.trip_id) ?? [];
  list.push({ id: stopTime.stop_id, sequence: Number(stopTime.stop_sequence) });
  stopIdsByTrip.set(stopTime.trip_id, list);
}

const patternSets = new Map();
for (const [tripId, stopIds] of stopIdsByTrip) {
  const trip = tripById.get(tripId);
  if (!trip?.line || !trip.destination) continue;
  const sequence = stopIds
    .sort((a, b) => a.sequence - b.sequence)
    .map((stop) => stopById.get(stop.id))
    .filter(Boolean);
  if (sequence.length < 2) continue;
  const key = `${normalize(trip.line)}|${normalize(trip.destination)}`;
  const patterns = patternSets.get(key) ?? new Map();
  patterns.set(sequence.map(normalize).join("|"), sequence);
  patternSets.set(key, patterns);
}

const patterns = Object.fromEntries(
  [...patternSets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, values]) => [key, [...values.values()]]),
);

await writeFile(
  output,
  `${JSON.stringify({
    source: "Spanish National Access Point, FGV Metro de Valencia GTFS",
    sourceUrl: "https://nap.transportes.gob.es/Files/Detail/967",
    snapshot: "2026-09-22",
    attribution: "Powered by MITRAMS",
    patterns,
  })}\n`,
);

console.log(`Wrote ${Object.keys(patterns).length} route/destination patterns to ${output}`);
