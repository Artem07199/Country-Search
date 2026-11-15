import type { Country, RawCountry } from "../types/country.js";
import { HttpError } from "./httpError.js";
import { mapCountryResponse } from "./mapCountryResponse.js";

const API_BASE_URL = "https://countries.dev/name";

export const DEFAULT_TIMEOUT_MS = 8000;

export async function searchCountries(
  query: string,
  signal: AbortSignal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Country[]> {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return [];
  }

  const combinedSignal = AbortSignal.any([
    signal,
    AbortSignal.timeout(timeoutMs),
  ]);
  const url = `${API_BASE_URL}/${encodeURIComponent(trimmedQuery)}`;
  const response = await fetch(url, { signal: combinedSignal });

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    throw new HttpError(
      response.status,
      `Request failed with status ${response.status}: ${response.statusText || "Unknown error"}`,
    );
  }

  const rawCountries = (await response.json()) as RawCountry[];
  return rawCountries.map(mapCountryResponse);
}
