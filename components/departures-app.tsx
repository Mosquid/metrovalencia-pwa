"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { normalizeName } from "@/lib/normalize";

type Departure = {
  id: string;
  line: string;
  routeDescription: string;
  destination: string;
  time: string;
  minutes: number;
  nextStops: string[] | null;
};

type Success = {
  status: "ok";
  station: string;
  departures: Departure[];
  updatedAt: string;
};

type Choice = {
  status: "choose";
  reason: "missing" | "unknown" | "ambiguous";
  choices: string[];
};

type ErrorResponse = { status: "error"; message: string };
type ApiResponse = Success | Choice | ErrorResponse;
type ViewState =
  | { kind: "loading" }
  | { kind: "success"; data: Success; stale: boolean }
  | { kind: "choice"; data: Choice }
  | { kind: "error"; message: string };

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const CACHE_KEY = "proximo-metro:last-success";

function RefreshIcon({ spinning = false }: { spinning?: boolean }) {
  return (
    <svg className={spinning ? "spin" : undefined} aria-hidden="true" viewBox="0 0 24 24">
      <path d="M20 11a8 8 0 1 0-2.34 5.66M20 4v7h-7" />
    </svg>
  );
}

function TrainMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32">
      <rect x="7" y="3" width="18" height="23" rx="7" />
      <path d="M10 13h12M11 29l3-3m7 3-3-3" />
      <circle cx="12" cy="19" r="1" />
      <circle cx="20" cy="19" r="1" />
    </svg>
  );
}

function formatUpdate(timestamp: string) {
  const time = timestamp.split(" ")[1]?.slice(0, 5);
  return time ? `${time} Spain time` : timestamp;
}

export function DeparturesApp({ initialStation }: { initialStation: string }) {
  const [state, setState] = useState<ViewState>({ kind: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState(initialStation);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const requestInFlight = useRef(false);

  const load = useCallback(
    async (manual = false) => {
      if (requestInFlight.current) return;
      requestInFlight.current = true;
      if (manual) setRefreshing(true);

      try {
        const response = await fetch(`/api/departures?station=${encodeURIComponent(initialStation)}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as ApiResponse;
        if (!response.ok || payload.status === "error") {
          throw new Error(payload.status === "error" ? payload.message : "Could not load departures.");
        }
        if (payload.status === "choose") {
          setState({ kind: "choice", data: payload });
          return;
        }

        setState({ kind: "success", data: payload, stale: false });
        setQuery(payload.station);
        localStorage.setItem(CACHE_KEY, JSON.stringify({ station: initialStation, data: payload }));

        if (payload.station !== initialStation) {
          const url = new URL(window.location.href);
          url.searchParams.set("station", payload.station);
          window.history.replaceState({}, "", url);
        }
      } catch (error) {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as { station: string; data: Success };
            if (normalizeName(parsed.station) === normalizeName(initialStation)) {
              setState({ kind: "success", data: parsed.data, stale: true });
              return;
            }
          } catch {
            localStorage.removeItem(CACHE_KEY);
          }
        }
        setState({ kind: "error", message: error instanceof Error ? error.message : "Could not load departures." });
      } finally {
        requestInFlight.current = false;
        setRefreshing(false);
      }
    },
    [initialStation],
  );

  useEffect(() => {
    void load();
    let interval: ReturnType<typeof setInterval> | undefined;
    const updatePolling = () => {
      if (interval) clearInterval(interval);
      if (document.visibilityState === "visible") {
        void load();
        interval = setInterval(() => void load(), 30_000);
      }
    };
    document.addEventListener("visibilitychange", updatePolling);
    updatePolling();
    return () => {
      document.removeEventListener("visibilitychange", updatePolling);
      if (interval) clearInterval(interval);
    };
  }, [load]);

  useEffect(() => {
    const handleInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handleInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleInstall);
  }, []);

  const grouped = useMemo(() => {
    if (state.kind !== "success") return [];
    const groups = new Map<string, { destination: string; departures: Departure[] }>();
    for (const departure of state.data.departures) {
      const key = normalizeName(departure.destination);
      const group = groups.get(key) ?? { destination: departure.destination, departures: [] };
      group.departures.push(departure);
      groups.set(key, group);
    }
    return [...groups.values()].sort(
      (a, b) => (a.departures[0]?.minutes ?? 0) - (b.departures[0]?.minutes ?? 0),
    );
  }, [state]);

  function submitStation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const station = query.trim();
    window.location.assign(station ? `/?station=${encodeURIComponent(station)}` : "/");
  }

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  const choices = state.kind === "choice" ? state.data.choices : [];
  const stationName = state.kind === "success" ? state.data.station : initialStation;

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Próximo Metro home">
          <span className="brand-mark"><TrainMark /></span>
          <span>Próximo Metro</span>
        </a>
        {installPrompt && (
          <button className="quiet-button install-button" type="button" onClick={install}>
            Install
          </button>
        )}
      </header>

      <section className="station-header" aria-labelledby="station-title">
        <p className="eyebrow">Upcoming departures</p>
        <div className="station-title-row">
          <h1 id="station-title">{stationName || "Choose your station"}</h1>
          {state.kind === "success" && (
            <button
              className="refresh-button"
              type="button"
              onClick={() => void load(true)}
              disabled={refreshing}
              aria-label="Refresh departures"
            >
              <RefreshIcon spinning={refreshing} />
              <span>{refreshing ? "Refreshing" : "Refresh"}</span>
            </button>
          )}
        </div>
        {state.kind === "success" && (
          <div className={`freshness ${state.stale ? "is-stale" : ""}`} role="status">
            <span className="status-dot" />
            {state.stale
              ? `Offline copy from ${formatUpdate(state.data.updatedAt)}`
              : `Updated ${formatUpdate(state.data.updatedAt)}`}
          </div>
        )}
      </section>

      {state.kind === "loading" && (
        <section className="loading-state" aria-label="Loading departures" aria-busy="true">
          <div className="skeleton skeleton-heading" />
          {[0, 1, 2].map((item) => <div className="skeleton skeleton-row" key={item} />)}
        </section>
      )}

      {state.kind === "success" && state.data.departures.length === 0 && (
        <section className="message-state">
          <span className="state-symbol">○</span>
          <h2>No upcoming departures</h2>
          <p>Metrovalencia returned no more trains for this station right now.</p>
        </section>
      )}

      {state.kind === "success" && state.data.departures.length > 0 && (
        <div className="directions" aria-live="polite">
          {grouped.map((group, groupIndex) => (
            <section className="direction" key={normalizeName(group.destination)}>
              <div className="direction-heading">
                <span className="direction-index">{String(groupIndex + 1).padStart(2, "0")}</span>
                <h2>Towards <strong>{group.destination}</strong></h2>
              </div>
              <ol className="departure-list">
                {group.departures.map((departure) => (
                  <li className="departure" key={departure.id}>
                    <div className={`line-badge line-${departure.line}`} aria-label={`Line ${departure.line}`}>
                      {departure.line}
                    </div>
                    <div className="departure-main">
                      <div className="departure-topline">
                        <p className="route-name">{departure.routeDescription}</p>
                        <time dateTime={departure.time}>{departure.time.slice(0, 5)}</time>
                      </div>
                      {departure.nextStops ? (
                        <p className="stops" aria-label="Upcoming stops">
                          {departure.nextStops.map((stop, index) => (
                            <span key={`${stop}-${index}`}>
                              {index > 0 && <span className="arrow" aria-hidden="true">→</span>}
                              <span className={index === departure.nextStops!.length - 1 ? "final-stop" : ""}>{stop}</span>
                            </span>
                          ))}
                        </p>
                      ) : (
                        <p className="stops unavailable">Intermediate stops unavailable.</p>
                      )}
                    </div>
                    <div className="minutes" aria-label={`${departure.minutes} minutes remaining`}>
                      <strong>{departure.minutes}</strong>
                      <span>{departure.minutes === 1 ? "min" : "mins"}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}

      {state.kind === "choice" && (
        <section className="message-state picker-state">
          <span className="state-symbol">⌖</span>
          <h2>{state.data.reason === "ambiguous" ? "Which station?" : state.data.reason === "unknown" ? "Station not found" : "Choose a station"}</h2>
          <p>{state.data.reason === "ambiguous" ? "More than one station matches that name." : "Enter a Metrovalencia station to get started."}</p>
          <StationForm query={query} setQuery={setQuery} choices={choices} onSubmit={submitStation} />
        </section>
      )}

      {state.kind === "error" && (
        <section className="message-state error-state">
          <span className="state-symbol">!</span>
          <h2>Departures unavailable</h2>
          <p>{state.message}</p>
          <button className="primary-button" type="button" onClick={() => void load(true)} disabled={refreshing}>
            Try again
          </button>
        </section>
      )}

      {state.kind === "success" && (
        <details className="change-station">
          <summary>Change station</summary>
          <StationForm query={query} setQuery={setQuery} choices={[]} onSubmit={submitStation} />
        </details>
      )}

      <footer>
        <p>Times are supplied by Metrovalencia and may be scheduled rather than live predictions.</p>
        <p>Route data: <a href="https://www.transportes.gob.es/" target="_blank" rel="noreferrer">Powered by MITRAMS</a></p>
      </footer>
    </main>
  );
}

function StationForm({
  query,
  setQuery,
  choices,
  onSubmit,
}: {
  query: string;
  setQuery: (value: string) => void;
  choices: string[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="station-form" onSubmit={onSubmit}>
      <label htmlFor="station">Station name</label>
      <div className="input-row">
        <input
          id="station"
          name="station"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          list="station-options"
          placeholder="e.g. Campanar"
          autoComplete="off"
          required
        />
        <button className="primary-button" type="submit">Show trains</button>
      </div>
      {choices.length > 0 && (
        <div className="choice-list" aria-label="Matching stations">
          {choices.slice(0, 12).map((choice) => (
            <button type="button" key={choice} onClick={() => window.location.assign(`/?station=${encodeURIComponent(choice)}`)}>
              {choice}
            </button>
          ))}
        </div>
      )}
      <datalist id="station-options">
        {choices.map((choice) => <option value={choice} key={choice} />)}
      </datalist>
    </form>
  );
}
