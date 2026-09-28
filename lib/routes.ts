import routeData from "./route-data.generated.json";
import { normalizeName } from "./normalize";

type RouteData = {
  patterns: Record<string, string[][]>;
};

const data = routeData as RouteData;

export function resolveNextStops(line: string, destination: string, station: string) {
  const key = `${normalizeName(line)}|${normalizeName(destination)}`;
  const stationKey = normalizeName(station);
  const destinationKey = normalizeName(destination);
  const suffixes = (data.patterns[key] ?? [])
    .map((pattern) => {
      const index = pattern.findIndex((stop) => normalizeName(stop) === stationKey);
      return index >= 0 ? pattern.slice(index + 1) : [];
    })
    .filter((suffix) => suffix.length > 0 && normalizeName(suffix.at(-1) ?? "") === destinationKey);

  const displaySequences = suffixes.map((suffix) => {
    const next = suffix.slice(0, 3);
    const finalDestination = suffix.at(-1)!;
    if (!next.some((stop) => normalizeName(stop) === normalizeName(finalDestination))) {
      next.push(finalDestination);
    }
    return next;
  });
  const unique = new Map(
    displaySequences.map((sequence) => [sequence.map(normalizeName).join("|"), sequence]),
  );
  if (unique.size !== 1) return null;
  return [...unique.values()][0];
}
