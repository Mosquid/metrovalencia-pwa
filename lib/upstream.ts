import { load } from "cheerio";
import { normalizeName } from "./normalize";
import { resolveNextStops } from "./routes";
import { madridTimestamp, minutesUntilMadridTime } from "./time";

const CATALOG_URL =
  "https://geoportal.valencia.es/server/rest/services/OPENDATA/Trafico/MapServer/221/query?where=1%3D1&outFields=*&f=json&returnGeometry=false";
const DEPARTURES_ORIGIN = "https://geoportal.valencia.es";
const DEPARTURES_PATH = "/geoportal-services/api/v1/salidas-metro.html";

export type Station = {
  code: string;
  name: string;
  lines: string[];
};

export type Departure = {
  id: string;
  line: string;
  routeDescription: string;
  destination: string;
  time: string;
  minutes: number;
  nextStops: string[] | null;
};

let catalogueCache: { expires: number; value: Station[] } | null = null;
const departureCache = new Map<string, { expires: number; promise: Promise<Departure[]> }>();

async function fetchWithTimeout(url: string, init?: RequestInit) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
}

export async function getStations(): Promise<Station[]> {
  if (catalogueCache && catalogueCache.expires > Date.now()) return catalogueCache.value;

  const response = await fetchWithTimeout(CATALOG_URL, {
    headers: { Accept: "application/json" },
    next: { revalidate: 86_400 },
  });
  if (!response.ok) throw new Error(`Station catalogue returned ${response.status}`);
  const payload = (await response.json()) as {
    features?: Array<{
      attributes?: { codigo?: unknown; nombre?: unknown; linea?: unknown };
    }>;
  };
  if (!Array.isArray(payload.features)) throw new Error("Unexpected station catalogue payload");

  const stations = payload.features
    .map(({ attributes }): Station | null => {
      if (!attributes || typeof attributes.codigo !== "string" || typeof attributes.nombre !== "string") {
        return null;
      }
      return {
        code: attributes.codigo,
        name: attributes.nombre.trim(),
        lines: String(attributes.linea ?? "")
          .split(",")
          .map((line) => line.trim())
          .filter(Boolean),
      };
    })
    .filter((station): station is Station => Boolean(station));

  if (stations.length < 100) throw new Error("Station catalogue is unexpectedly incomplete");
  catalogueCache = { expires: Date.now() + 86_400_000, value: stations };
  return stations;
}

function choices(stations: Station[]) {
  return [...new Map(stations.map((station) => [normalizeName(station.name), station.name])).values()].sort(
    (a, b) => a.localeCompare(b, "es"),
  );
}

export function resolveStation(query: string, stations: Station[]) {
  const normalized = normalizeName(query);
  const allChoices = choices(stations);
  if (!normalized) return { status: "choose" as const, reason: "missing", choices: allChoices };

  const exact = stations.filter((station) => normalizeName(station.name) === normalized);
  if (exact.length) return { status: "resolved" as const, name: exact[0].name, matches: exact };

  const partialNames = allChoices.filter((name) => normalizeName(name).includes(normalized));
  if (partialNames.length === 1) {
    const matches = stations.filter((station) => normalizeName(station.name) === normalizeName(partialNames[0]));
    return { status: "resolved" as const, name: matches[0].name, matches };
  }

  return {
    status: "choose" as const,
    reason: partialNames.length > 1 ? "ambiguous" : "unknown",
    choices: partialNames.length ? partialNames : allChoices,
  };
}

export function parseDeparturesHtml(html: string, station: Station): Departure[] {
  const $ = load(html);
  const pageText = $("body").text().replace(/\s+/g, " ").trim();
  if (!/Próximas salidas/i.test(pageText)) throw new Error("Unexpected departures HTML");

  const departures: Departure[] = [];
  $(".imagenParada").each((_, marker) => {
    const row = $(marker).parent();
    const image = row.find("img").first().attr("src") ?? "";
    const line = /linea_metro_([\w-]+)\.png/i.exec(image)?.[1] ?? "";
    const destination = row.find("b").first().text().replace(/\s+/g, " ").trim();
    const text = row.text().replace(/\s+/g, " ").trim();
    const time = /\b(\d{1,2}:\d{2}:\d{2})\b/.exec(text)?.[1] ?? "";
    const routeDescription = text.match(/^(.+?),\s*Destino\b/i)?.[1]?.trim() ?? "";

    if (!line || !destination || !time || !routeDescription) {
      throw new Error("Unexpected departure row HTML");
    }

    departures.push({
      id: `${normalizeName(station.name)}|${line}|${normalizeName(destination)}|${time}`,
      line,
      routeDescription,
      destination,
      time,
      minutes: minutesUntilMadridTime(time),
      nextStops: resolveNextStops(line, destination, station.name),
    });
  });
  return departures;
}

async function departuresForStation(station: Station) {
  const cached = departureCache.get(station.code);
  if (cached && cached.expires > Date.now()) return cached.promise;

  const url = new URL(DEPARTURES_PATH, DEPARTURES_ORIGIN);
  url.searchParams.set("estacion", station.code);
  url.searchParams.set("lang", "es");
  const promise = fetchWithTimeout(url.toString(), {
    headers: { Accept: "text/html" },
    cache: "no-store",
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Departures returned ${response.status}`);
      const html = await response.text();
      return parseDeparturesHtml(html, station);
    })
    .catch((error) => {
      departureCache.delete(station.code);
      throw error;
    });

  departureCache.set(station.code, { expires: Date.now() + 20_000, promise });
  return promise;
}

export async function getDepartures(stations: Station[]) {
  const batches = await Promise.all(stations.map(departuresForStation));
  const departures = deduplicateDepartures(batches.flat());

  return {
    departures: departures.sort((a, b) => a.minutes - b.minutes || a.time.localeCompare(b.time)),
    updatedAt: madridTimestamp(),
  };
}

export function deduplicateDepartures(departures: Departure[]) {
  const deduplicated = new Map<string, Departure>();
  for (const departure of departures) deduplicated.set(departure.id, departure);
  return [...deduplicated.values()];
}
