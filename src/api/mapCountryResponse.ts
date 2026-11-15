import type { Country, RawCountry } from "../types/country.js";

export function mapCountryResponse(raw: RawCountry): Country {
  void raw;
  throw new Error("Not implemented");
}
