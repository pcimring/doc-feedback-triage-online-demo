import { describe, it, expect } from "vitest";
import { SAMPLES, pickRandomSample } from "../samples";

describe("pickRandomSample", () => {
  it("always returns one of the entries in SAMPLES", () => {
    for (let i = 0; i < 50; i++) {
      expect(SAMPLES).toContainEqual(pickRandomSample());
    }
  });
});
