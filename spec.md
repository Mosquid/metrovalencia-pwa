Build a minimal, mobile-first PWA that shows upcoming Metrovalencia departures for a station.
Requirements

1. Accept the station name through a URL query parameter: /?station=Campanar.
2. Resolve names case-insensitively and accent-insensitively: Turia matches Túria.
3. Fetch upcoming departures and show:
   - Line number.
   - Destination, labelled “Towards …”.
   - Departure time and minutes remaining.
   - Next few stops towards that destination, only if backed by verified route data.
4. Refresh every 30 seconds while the page is visible, immediately when returning to it, and through a manual refresh button.
5. Make the app installable as a PWA. Preserve the selected station in the installed app’s launch URL.
   Verified data sources
   Station catalogue - ArcGIS REST API:
   https://geoportal.valencia.es/server/rest/services/OPENDATA/Trafico/MapServer/221/query?where=1%3D1&outFields=*&f=json&returnGeometry=false
   The response contains features[].attributes, including:
   Field Meaning
   codigo Station code
   nombre Station name
   linea Associated line(s)
   proximas_llegadas Spanish departures-page URL

Departure endpoint, using Alacant as an example:
https://geoportal.valencia.es/geoportal-services/api/v1/salidas-metro.html?estacion=190&lang=es
This endpoint returns server-rendered HTML, not JSON. Successfully retrieved it during research. Each departure contains:

For each departure, show the next stations in that train’s travel direction, followed by its final destination.
Example, departing from Empalme:
Beniferri → Campanar → Túria → … → [final destination]

- Display the next 3 stations after the selected station, in travel order.
- Append the final destination, avoiding duplication if it’s already among those stations.
- Determine the sequence using the departure’s line, destination, and verified ordered route data.
- Handle branches, short-turn services, and opposite directions correctly. Don’t assume every train travels the full line.
- Obtain an authoritative route dataset, such as official GTFS, to supplement the departures feed. Finding and validating this data is part of implementation.
- If a departure’s route cannot be resolved, explicitly show “Intermediate stops unavailable.” This is an error fallback, not the intended finished functionality.

Add an acceptance criterion:
Trains departing the same station in opposite directions show the correct, different sequences of upcoming stops.

- Line image such as linea_metro_10.png.
- Route description such as 10 - Alacant - Natzaret.
- Destination in a <b> element.
- Departure time such as 22:41:00.
  The observed response contained duplicate departures. Deduplicate by station, line, destination, and departure time.
  Implementation approach
- Use a small server-side adapter to fetch and parse the upstream HTML, exposing normalized JSON to the frontend. Avoid depending on upstream browser CORS support.
- Cache the station catalogue for 24 hours and departures for roughly 15–30 seconds.
- Fetch upstream URLs from a fixed, allowlisted host and path; never proxy arbitrary user-supplied URLs.
- Match exact normalized station names first. If multiple station codes share a name, aggregate their departures and deduplicate.
- For missing or unknown names, show a station picker. For ambiguous partial matches, ask the user to select a station.
- Use Europe/Madrid for departure times, regardless of the device timezone. Handle departures around midnight.
- The source exposes departure times; whether these are live predictions or scheduled times remains unverified. Label them “Upcoming departures,” not “Live arrivals.”
- Detect upstream failures or unexpected HTML and show an error rather than silently reporting no trains.
  Direction and intermediate stops
  Destination is available directly from the departures feed and satisfies the basic direction requirement.
  Intermediate stops require a separate, verified ordered route dataset, such as an official GTFS feed. Do not infer station order from coordinates, station codes, or the catalogue’s record order. If route data is unavailable, ship destination-only direction.
  UI and offline behaviour
- Station name at the top.
- Upcoming departures ordered by time, with prominent minutes remaining and destination.
- Last successful update time.
- Clear loading, no-departures, unknown-station, and connection-error states.
- Cache the app shell for offline use. If retaining departure data, clearly mark it stale/offline and never present it as current.
- Include a manifest, suitable icons, and service worker.
  Acceptance criteria
- /?station=Campanar displays real departures or an explicit upstream error.
- Accented and unaccented station names resolve consistently.
- Duplicate upstream entries appear only once.
- Each departure clearly identifies its direction.
- Midnight calculations work when the device is outside Spain.
- Refreshes never overlap, and background tabs stop polling.
- Installation reopens the selected station.
- No mocked departures appear in normal operation.
