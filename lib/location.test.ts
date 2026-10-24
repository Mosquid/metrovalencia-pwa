import { describe, expect, it } from "vitest";
import { cityStations, distanceMetres, suggestCloserStation, type LocatedStation } from "./location";

const stations: LocatedStation[] = [
  { code: "a", name: "Túria", lines: ["1", "2"], latitude: 39.48, longitude: -0.39 },
  { code: "b", name: "Colón", lines: ["3"], latitude: 39.46, longitude: -0.37 },
];
const position = { latitude: 39.46, longitude: -0.37, accuracy: 10 };

describe("nearby station suggestions", () => {
  it("finds the closest station and matches accented bookmarks", () => {
    const result = suggestCloserStation(position, "TURIA", stations);
    expect(result?.station.name).toBe("Colón");
    expect(result?.distance).toBe(0);
    expect(result?.bookmarkedDistance).toBeGreaterThan(2_000);
  });

  it("compares the saving, rather than just distance to the bookmark", () => {
    const distantPosition = { ...position, latitude: 39.44, longitude: -0.35 };
    expect(distanceMetres(distantPosition, stations[1])).toBeGreaterThan(1_000);
    expect(suggestCloserStation(distantPosition, "Colón", stations)).toBeNull();
    const similarStations = [stations[0], { ...stations[1], latitude: 39.479, longitude: -0.389 }];
    expect(suggestCloserStation(position, "Túria", similarStations)).toBeNull();
  });

  it("requires strictly more than 1 km, allowing for GPS uncertainty", () => {
    const north = (metres: number) => ({ ...stations[0], latitude: position.latitude + metres / 6_371_000 * 180 / Math.PI, longitude: position.longitude });
    expect(suggestCloserStation({ ...position, accuracy: 0 }, "Túria", [north(999), stations[1]])).toBeNull();
    expect(suggestCloserStation({ ...position, accuracy: 0 }, "Túria", [north(1_001), stations[1]])?.station.name).toBe("Colón");
    expect(suggestCloserStation({ ...position, accuracy: 100 }, "Túria", [north(1_199), stations[1]])).toBeNull();
    expect(suggestCloserStation({ ...position, accuracy: 100 }, "Túria", [north(1_201), stations[1]])?.station.name).toBe("Colón");
  });

  it("handles duplicate platforms by using the nearest bookmarked location", () => {
    const duplicate = { ...stations[0], code: "a2", latitude: position.latitude, longitude: position.longitude };
    expect(suggestCloserStation(position, "Túria", [...stations, duplicate])).toBeNull();
  });

  it("skips unknown bookmarks, empty lists, and unreliable positions", () => {
    expect(suggestCloserStation(position, "Missing", stations)).toBeNull();
    expect(suggestCloserStation(position, "Túria", [])).toBeNull();
    for (const invalid of [{ accuracy: 501 }, { accuracy: NaN }, { accuracy: -1 }, { latitude: NaN }, { latitude: 91 }, { longitude: 181 }]) {
      expect(suggestCloserStation({ ...position, ...invalid }, "Túria", stations)).toBeNull();
    }
  });

  it("uses real city coordinates with coverage across Valencia", () => {
    expect(cityStations.length).toBeGreaterThanOrEqual(60);
    expect(new Set(cityStations.map((station) => station.code)).size).toBe(cityStations.length);
    for (const station of cityStations) {
      expect(station.latitude).toBeGreaterThanOrEqual(39.42);
      expect(station.latitude).toBeLessThanOrEqual(39.515);
      expect(station.longitude).toBeGreaterThanOrEqual(-0.44);
      expect(station.longitude).toBeLessThanOrEqual(-0.315);
    }
    for (const name of ["Campanar", "Benimàmet", "Tossal del Rei", "Natzaret", "Marítim", "Alacant"]) {
      expect(cityStations.some((station) => station.name === name)).toBe(true);
    }
    const colon = cityStations.find((station) => station.name === "Colón")!;
    expect(suggestCloserStation({ ...colon, accuracy: 20 }, "Campanar")?.station.name).toBe("Colón");
    expect(distanceMetres(colon, colon)).toBe(0);
  });
});
