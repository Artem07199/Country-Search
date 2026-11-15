import type { Country } from "../types/country.js";

export type SearchStatus = "idle" | "loading" | "success" | "empty" | "error";

export interface SearchState {
  status: SearchStatus;
  query: string;
  countries: Country[];
  errorMessage?: string;
}

export type CountryFetcher = (
  query: string,
  signal: AbortSignal,
) => Promise<Country[]>;

export interface SearchControllerOptions {
  fetcher: CountryFetcher;
  onStateChange: (state: SearchState) => void;
  debounceMs?: number;
}

export interface SearchController {
  handleInput: (rawQuery: string) => void;
  searchNow: (rawQuery: string) => void;
  retry: () => void;
  getState: () => SearchState;
  destroy: () => void;
}

export const DEFAULT_DEBOUNCE_MS = 350;

export function createSearchController(
  options: SearchControllerOptions,
): SearchController {
  void options;
  throw new Error("Not implemented");
}
