import { debounce } from "../utils/debounce.js";
import { classifySearchError } from "./errorHandler.js";
export const DEFAULT_DEBOUNCE_MS = 350;
export function createSearchController(options) {
  const { fetcher, onStateChange, debounceMs = DEFAULT_DEBOUNCE_MS } = options;
  let activeController = null;
  let lastQuery = "";
  let state = {
    status: "idle",
    query: "",
    countries: [],
  };
  const setState = (nextState) => {
    state = nextState;
    onStateChange(state);
  };
  const abortActiveRequest = () => {
    if (activeController !== null) {
      activeController.abort();
      activeController = null;
    }
  };
  const executeSearch = async (query) => {
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
  const debouncedSearch = debounce((query) => {
    void executeSearch(query);
  }, debounceMs);
  const handleInput = (rawQuery) => {
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
  const searchNow = (rawQuery) => {
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
  const retry = () => {
    if (!lastQuery) {
      return;
    }
    debouncedSearch.cancel();
    void executeSearch(lastQuery);
  };
  const destroy = () => {
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
