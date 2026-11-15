import { describe, expect, it } from "vitest";
import { mapCountryResponse } from "../src/api/mapCountryResponse.js";
import type { RawCountry } from "../src/types/country.js";

const spainRaw: RawCountry = {
  name: "Spain",
  alpha3Code: "ESP",
  capital: "Madrid",
  region: "Europe",
  subregion: "Southern Europe",
  population: 47351567,
  area: 505992,
  borders: ["AND", "FRA", "GIB", "PRT", "MAR"],
  flag: "https://flagcdn.com/es.svg",
  flags: {
    svg: "https://flagcdn.com/es.svg",
    png: "https://flagcdn.com/w320/es.png",
    alt: "The flag of Spain",
  },
  languages: [{ name: "Spanish", nativeName: "Español" }],
  currencies: [{ code: "EUR", name: "Euro", symbol: "€" }],
  demonym: "Spanish",
};

describe("mapCountryResponse", () => {
  it("maps a full API country object into the application Country model", () => {
    const result = mapCountryResponse(spainRaw);

    expect(result).toEqual({
      id: "ESP",
      name: "Spain",
      flagUrl: "https://flagcdn.com/es.svg",
      flagAlt: "The flag of Spain",
      capital: "Madrid",
      region: "Europe",
      population: 47351567,
      languages: ["Spanish"],
      description: "Spain — Southern Europe (Europe), столица: Madrid.",
      area: 505992,
      borders: ["AND", "FRA", "GIB", "PRT", "MAR"],
      currencies: ["Euro (€)"],
    });
  });

  it("handles missing optional fields safely with fallback values", () => {
    const minimalRaw: RawCountry = {
      name: "Antarctica",
    };

    const result = mapCountryResponse(minimalRaw);

    expect(result).toEqual({
      id: "Antarctica",
      name: "Antarctica",
      flagUrl: "",
      flagAlt: "Флаг Antarctica",
      capital: "Не указана",
      region: "Не указан",
      population: 0,
      languages: [],
      description: "Antarctica — регион не указан.",
      area: null,
      borders: [],
      currencies: [],
    });
  });

  it("falls back to flags.png or flag when flags.svg is absent", () => {
    const withPng = mapCountryResponse({
      name: "Testland",
      flags: { png: "https://example.com/flag.png" },
    });
    const withDirectFlag = mapCountryResponse({
      name: "Testland",
      flag: "https://example.com/direct.svg",
    });

    expect(withPng.flagUrl).toBe("https://example.com/flag.png");
    expect(withDirectFlag.flagUrl).toBe("https://example.com/direct.svg");
  });

  it("does not mutate the input object and returns copies of arrays", () => {
    const input: RawCountry = {
      name: "Belarus",
      borders: ["POL", "LTU"],
      languages: [{ name: "Belarusian" }, { name: "Russian" }],
    };

    const result = mapCountryResponse(input);
    result.borders.push("UKR");

    expect(input.borders).toEqual(["POL", "LTU"]);
  });
});
