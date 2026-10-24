# Próximo Metro

A small mobile-first Next.js PWA for checking upcoming Metrovalencia departures by station.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000/?station=Campanar`.

## Data and behaviour

- Stations come from the Valencia Geoportal ArcGIS station catalogue and are cached for 24 hours.
- Departures come from the Valencia Geoportal Metrovalencia HTML endpoint through a server-side, allowlisted adapter. They are cached for 20 seconds.
- Names are matched case-insensitively and accent-insensitively. Exact matches win; ambiguous partial matches return a picker.
- [City-area station coordinates](lib/station-data.generated.json) include 82 Metrovalencia metro and tram stations from the official Valencia Geoportal, captured on 2026-10-24 in WGS84 latitude/longitude. A generous rectangle (39.42–39.515° N, 0.44–0.315° W) includes the city and nearby boundary stations; it is not an exact municipal boundary.
- When opening a selected city-area station, the browser requests location access. While the page is visible, the app suggests the closest station if it saves over 1 km in straight-line distance compared with the selected station. It allows twice the reported GPS accuracy as a margin and ignores fixes worse than 500 m. Location denial, errors, or unsupported browsers leave departures available. Coordinates stay on the device and are never stored or sent to the server.
- The suggestion offers **Switch to [station]** (opens its `?station=` URL) or **Keep [station]** (dismisses it for the current visit). Switching requires a tap and leaves the original bookmark unchanged.
- Departures are deduplicated by normalized station name, line, destination, and departure time.
- Minutes remaining are calculated using `Europe/Madrid`, including the midnight rollover.
- Intermediate stops come from the FGV Metro de Valencia GTFS published by Spain's National Access Point. The checked-in route index was generated from the 2026-09-22 snapshot mirrored by Mobility Database. The feed identifies FGV as the producer and carries the required `Powered by MITRAMS` attribution.
- If the line, destination, and station do not resolve to one verified displayed sequence, the UI says `Intermediate stops unavailable.`

The client refreshes every 30 seconds only while visible, refreshes immediately after becoming visible, and prevents overlapping requests. The service worker caches the app shell but not API calls. The latest successful result is retained in local storage solely as an explicitly marked offline copy.

## Refresh the route index

Download the current official Metro de Valencia GTFS from the [Spanish National Access Point](https://nap.transportes.gob.es/Files/Detail/967), extract it, then run:

```bash
npm run routes:build -- /path/to/extracted-gtfs
```

The generator reads `routes.txt`, `trips.txt`, `stops.txt`, and `stop_times.txt` and replaces `lib/route-data.generated.json` with the verified route and destination patterns.

## Refresh station coordinates

```bash
npm run stations:build
```

This downloads the official Geoportal catalogue with `returnGeometry=true&outSR=4326` and rebuilds the city-area snapshot. For a saved ArcGIS JSON response, use `npm run stations:build -- /path/to/catalogue.json YYYY-MM-DD`. Station locations are attributed to Ajuntament de València under CC BY 4.0.

## Verify

```bash
npm test
npm run build
```
