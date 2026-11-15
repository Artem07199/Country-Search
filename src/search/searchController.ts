import type { Country } from "../types/country.js";
import { debounce } from "../utils/debounce.js";
import { classifySearchError } from "./errorHandler.js";

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
  const { fetcher, onStateChange, debounceMs = DEFAULT_DEBOUNCE_MS } = options;

  let activeController: AbortController | null = null;
  let lastQuery = "";
  let state: SearchState = {
    status: "idle",
    query: "",
    countries: [],
  };

  const setState = (nextState: SearchState): void => {
    state = nextState;
    onStateChange(state);
  };

  const abortActiveRequest = (): void => {
    if (activeController !== null) {
      activeController.abort();
      activeController = null;
    }
  };

  const executeSearch = async (query: string): Promise<void> => {
    abortActiveRequest();

    const controller = new AbortController();
    activeController = controller;

    setState({
      status: "loading",
      query,
      countries: [],
    });

    try {
      const countries = await fetcher(query, controller.signal);

      if (controller.signal.aborted || activeController !== controller) {
        return;
      }

      activeController = null;

      if (countries.length === 0) {
        setState({
          status: "empty",
          query,
          countries: [],
        });
        return;
      }

      setState({
        status: "success",
        query,
        countries,
      });
    } catch (error) {
      if (activeController === controller) {
        activeController = null;
      }

      const classified = classifySearchError(error);

      if (classified.kind === "abort") {
        return;
      }

      if (classified.kind === "not-found") {
        setState({
          status: "empty",
          query,
          countries: [],
        });
        return;
      }

      setState({
        status: "error",
        query,
        countries: [],
        errorMessage: classified.message,
      });
    }
  };

  const debouncedSearch = debounce((query: string) => {
    void executeSearch(query);
  }, debounceMs);

  const handleInput = (rawQuery: string): void => {
    abortActiveRequest();
    debouncedSearch.cancel();

    const query = rawQuery.trim();
    lastQuery = query;

    if (!query) {
      setState({
        status: "idle",
        query: "",
        countries: [],
      });
      return;
    }

    debouncedSearch(query);
  };

  const searchNow = (rawQuery: string): void => {
    abortActiveRequest();
    debouncedSearch.cancel();

    const query = rawQuery.trim();
    lastQuery = query;

    if (!query) {
      setState({
        status: "idle",
        query: "",
        countries: [],
      });
      return;
    }

    void executeSearch(query);
  };

  const retry = (): void => {
    if (!lastQuery) {
      return;
    }

    debouncedSearch.cancel();
    void executeSearch(lastQuery);
  };

  const destroy = (): void => {
    debouncedSearch.cancel();
    abortActiveRequest();
  };

  return {
    handleInput,
    searchNow,
    retry,
    getState: () => state,
    destroy,
  };
}
