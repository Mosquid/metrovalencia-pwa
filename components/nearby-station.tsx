"use client";

import { useEffect, useState } from "react";
import { cityStations, suggestCloserStation, type Coordinates } from "@/lib/location";
import { normalizeName } from "@/lib/normalize";

function formatDistance(metres: number) {
  return metres < 1_000 ? `${Math.max(10, Math.round(metres / 10) * 10)} m` : `${(metres / 1_000).toFixed(1)} km`;
}

export function NearbyStation({ stationName }: { stationName: string }) {
  const [position, setPosition] = useState<(Coordinates & { accuracy: number }) | null>(null);
  const [dismissed, setDismissed] = useState("");
  const stationKey = normalizeName(stationName);
  const eligible = cityStations.some((station) => normalizeName(station.name) === stationKey);

  useEffect(() => {
    if (!eligible || dismissed === stationKey || !navigator.geolocation) return;
    let watch: number | undefined;
    let active = false;
    const stop = () => {
      active = false;
      if (watch !== undefined) navigator.geolocation.clearWatch(watch);
      watch = undefined;
    };
    const update = () => {
      stop();
      setPosition(null);
      if (document.visibilityState !== "visible") return;
      active = true;
      watch = navigator.geolocation.watchPosition(
        ({ coords }) => {
          if (active) setPosition({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy });
        },
        () => { if (active) setPosition(null); },
        { maximumAge: 60_000, timeout: 10_000, enableHighAccuracy: false },
      );
    };
    update();
    document.addEventListener("visibilitychange", update);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", update);
    };
  }, [eligible, dismissed, stationKey]);

  const suggestion = position && dismissed !== stationKey ? suggestCloserStation(position, stationName) : null;
  if (!suggestion) return null;

  return (
    <aside className="nearby-station" aria-label="Closer station suggestion">
      <p role="status">
        <strong>{suggestion.station.name} is closer to you</strong>
        <span>About {formatDistance(suggestion.distance)} away, compared with {formatDistance(suggestion.bookmarkedDistance)} to {stationName}. Distances are straight-line estimates.</span>
      </p>
      <div className="nearby-actions">
        <a className="primary-button" href={`/?station=${encodeURIComponent(suggestion.station.name)}`}>Switch to {suggestion.station.name}</a>
        <button className="quiet-button" type="button" onClick={() => setDismissed(stationKey)}>Keep {stationName}</button>
      </div>
    </aside>
  );
}
