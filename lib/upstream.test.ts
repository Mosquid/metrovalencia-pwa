import { describe, expect, it } from "vitest";
import { deduplicateDepartures, resolveStation, type Departure } from "./upstream";

const stations = [
  { code: "26", name: "Túria", lines: ["1", "2"] },
  { code: "27", name: "Campanar", lines: ["1", "2"] },
  { code: "127", name: "Canyamelar", lines: ["6", "8"] },
];

describe("resolveStation", () => {
  it("matches accents and case insensitively", () => {
    const result = resolveStation("TURIA", stations);
    expect(result.status).toBe("resolved");
    if (result.status === "resolved") expect(result.name).toBe("Túria");
  });

  it("returns choices for an unknown station", () => {
    expect(resolveStation("Not a station", stations).status).toBe("choose");
  });
});

describe("deduplicateDepartures", () => {
  it("keeps one copy of an upstream duplicate", () => {
    const departure: Departure = {
      id: "alacant|10|natzaret|23:06:00",
      line: "10",
      routeDescription: "10 - Alacant - Natzaret",
      destination: "Natzaret",
      time: "23:06:00",
      minutes: 5,
      nextStops: ["Russafa", "Natzaret"],
    };
    expect(deduplicateDepartures([departure, { ...departure }])).toEqual([departure]);
  });
});
