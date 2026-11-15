import type { Country } from "../types/country.js";

export const DEFAULT_TIMEOUT_MS = 8000;

export async function searchCountries(
  query: string,
  signal: AbortSignal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Country[]> {
  void query;
  void signal;
  void timeoutMs;
  throw new Error("Not implemented");
}
