import { describe, expect, it } from "vitest";
import { resolveNextStops } from "./routes";

describe("resolveNextStops", () => {
  it("returns different verified sequences for opposite directions", () => {
    expect(resolveNextStops("1", "Bétera", "Campanar")).toEqual([
      "Beniferri",
      "Empalme",
      "Burjassot",
      "Bétera",
    ]);
    expect(resolveNextStops("1", "Castelló", "Campanar")).toEqual([
      "Túria",
      "Àngel Guimerà",
      "Pl. Espanya",
      "Castelló",
    ]);
  });

  it("handles short-turn services without assuming the full line", () => {
    expect(resolveNextStops("1", "Empalme", "Campanar")).toEqual(["Beniferri", "Empalme"]);
  });
});
