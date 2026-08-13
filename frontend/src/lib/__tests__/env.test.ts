import { describe, it, expect } from "vitest";
import { getCamundaConfig } from "../env";

describe("getCamundaConfig", () => {
  it("returns the config when all three vars are present", () => {
    const config = getCamundaConfig({
      CAMUNDA_REST_URL: "https://camunda-api.example.com",
      CAMUNDA_USERNAME: "demo",
      CAMUNDA_PASSWORD: "secret",
    } as NodeJS.ProcessEnv);
    expect(config).toEqual({
      restUrl: "https://camunda-api.example.com",
      username: "demo",
      password: "secret",
    });
  });

  it("throws when CAMUNDA_PASSWORD is missing", () => {
    expect(() =>
      getCamundaConfig({
        CAMUNDA_REST_URL: "https://camunda-api.example.com",
        CAMUNDA_USERNAME: "demo",
      } as NodeJS.ProcessEnv)
    ).toThrow(/CAMUNDA_REST_URL, CAMUNDA_USERNAME, and CAMUNDA_PASSWORD/);
  });
});
