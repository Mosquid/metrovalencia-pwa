import { describe, expect, it } from "vitest";
import { minutesUntilMadridTime } from "./time";

describe("minutesUntilMadridTime", () => {
  it("uses Europe/Madrid when the device clock is in another zone", () => {
    expect(minutesUntilMadridTime("23:15:00", new Date("2026-09-28T21:00:00Z"))).toBe(15);
  });

  it("rolls an upcoming departure across midnight", () => {
    expect(minutesUntilMadridTime("00:10:00", new Date("2026-09-28T21:55:00Z"))).toBe(15);
  });
});
