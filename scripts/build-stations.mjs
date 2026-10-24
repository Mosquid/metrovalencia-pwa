import { readFile, writeFile } from "node:fs/promises";

const sourceUrl = "https://geoportal.valencia.es/server/rest/services/OPENDATA/Trafico/MapServer/221/query?where=1%3D1&outFields=*&f=json&returnGeometry=true&outSR=4326";
// A deliberately generous city-area rectangle, including neighbouring stations.
const bounds = { south: 39.42, north: 39.515, west: -0.44, east: -0.315 };
const payload = process.argv[2]
  ? JSON.parse(await readFile(process.argv[2], "utf8"))
  : await fetch(sourceUrl).then((response) => {
      if (!response.ok) throw new Error(`Station catalogue returned ${response.status}`);
      return response.json();
    });

if (payload.spatialReference?.wkid !== 4326 || payload.exceededTransferLimit || !Array.isArray(payload.features)) {
  throw new Error("Expected a complete station catalogue in WGS84 coordinates");
}

const stations = payload.features.flatMap(({ attributes, geometry }) => {
  const latitude = geometry?.y;
  const longitude = geometry?.x;
  if (typeof attributes?.codigo !== "string" || typeof attributes?.nombre !== "string" ||
      !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("Station is missing its name, code, or coordinates");
  }
  if (latitude < bounds.south || latitude > bounds.north || longitude < bounds.west || longitude > bounds.east) return [];
  return [{
    code: attributes.codigo,
    name: attributes.nombre.trim(),
    lines: String(attributes.linea ?? "").split(",").map((line) => line.trim()).filter(Boolean),
    latitude: Number(latitude.toFixed(6)),
    longitude: Number(longitude.toFixed(6)),
  }];
}).sort((a, b) => a.name.localeCompare(b.name, "es"));

if (stations.length < 60) throw new Error("City station catalogue is unexpectedly incomplete");

await writeFile("lib/station-data.generated.json", `${JSON.stringify({
  source: "Ajuntament de València, FGV Estaciones",
  sourceUrl,
  attribution: "Ajuntament de València, CC BY 4.0",
  snapshot: process.argv[3] ?? new Date().toISOString().slice(0, 10),
  bounds,
  stations,
}, null, 2)}\n`);
console.log(`Wrote ${stations.length} city-area stations`);
