import { HttpError } from "./httpError.js";
import { mapCountryResponse } from "./mapCountryResponse.js";
const API_BASE_URL = "https://countries.dev/name";
export const DEFAULT_TIMEOUT_MS = 8000;
export async function searchCountries(
  query,
  signal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
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
  const rawCountries = await response.json();
  return rawCountries.map(mapCountryResponse);
}
