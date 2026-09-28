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

## Verify

```bash
npm test
npm run build
```
