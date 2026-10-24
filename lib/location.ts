import catalogue from "./station-data.generated.json";
import { normalizeName } from "./normalize";

export type Coordinates = { latitude: number; longitude: number };
export type LocatedStation = Coordinates & { code: string; name: string; lines: string[] };
export const cityStations: LocatedStation[] = catalogue.stations;

function validCoordinates(point: Coordinates) {
  return Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90 &&
    Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180;
}

export function distanceMetres(a: Coordinates, b: Coordinates) {
  const radians = Math.PI / 180;
  const latitude = (b.latitude - a.latitude) * radians;
  const longitude = (b.longitude - a.longitude) * radians;
  const haversine = Math.sin(latitude / 2) ** 2 +
    Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) * Math.sin(longitude / 2) ** 2;
  return 6_371_000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, haversine))));
}

export function suggestCloserStation(
  position: Coordinates & { accuracy: number },
  bookmarkedName: string,
  stations: LocatedStation[] = cityStations,
) {
  if (!validCoordinates(position) || !Number.isFinite(position.accuracy) ||
      position.accuracy < 0 || position.accuracy > 500) return null;

  const bookmarked = stations.filter((station) => normalizeName(station.name) === normalizeName(bookmarkedName));
  if (!bookmarked.length) return null;

  const distances = stations.filter(validCoordinates).map((station) => ({
    station,
    distance: distanceMetres(position, station),
  }));
  const nearest = distances.reduce<(typeof distances)[number] | null>(
    (best, candidate) => !best || candidate.distance < best.distance ? candidate : best,
    null,
  );
  const bookmarkedDistance = Math.min(...bookmarked.map((station) => distanceMetres(position, station)));
  // Both distances can shift by the reported GPS error. Require a clear 1 km saving.
  if (!nearest || normalizeName(nearest.station.name) === normalizeName(bookmarkedName) ||
      bookmarkedDistance - nearest.distance <= 1_000 + 2 * position.accuracy) return null;

  return { station: nearest.station, distance: nearest.distance, bookmarkedDistance };
}
