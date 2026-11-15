import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../src/api/httpError.js";
import { classifySearchError } from "../src/search/errorHandler.js";
import {
  createSearchController,
  type SearchState,
} from "../src/search/searchController.js";
import type { Country } from "../src/types/country.js";

const spainCountry: Country = {
  id: "ESP",
  name: "Spain",
  flagUrl: "https://flagcdn.com/es.svg",
  flagAlt: "Flag of Spain",
  capital: "Madrid",
  region: "Europe",
  population: 47351567,
  languages: ["Spanish"],
  description: "Spain — Southern Europe (Europe), столица: Madrid.",
  area: 505992,
  borders: ["FRA", "PRT"],
  currencies: ["Euro (€)"],
};

describe("classifySearchError", () => {
  it("classifies AbortError separately from TimeoutError", () => {
    const abortError = new DOMException(
      "The operation was aborted.",
      "AbortError",
    );
    expect(classifySearchError(abortError)).toEqual({ kind: "abort" });
  });

  it("classifies TimeoutError as a user-visible timeout error", () => {
    const timeoutError = new DOMException(
      "The operation timed out.",
      "TimeoutError",
    );
    const result = classifySearchError(timeoutError);

    expect(result.kind).toBe("timeout");
    if (result.kind === "timeout") {
      expect(result.message.length).toBeGreaterThan(0);
    }
  });

  it("classifies HttpError 404 as not-found rather than an error", () => {
    const notFoundError = new HttpError(404, "Not Found");
    expect(classifySearchError(notFoundError)).toEqual({ kind: "not-found" });
  });

  it("classifies non-404 HttpError as http error with status", () => {
    const serverError = new HttpError(503, "Service Unavailable");
    const result = classifySearchError(serverError);

    expect(result.kind).toBe("http");
    if (result.kind === "http") {
      expect(result.status).toBe(503);
      expect(result.message).toContain("503");
    }
  });

  it("classifies unknown or network errors as network error", () => {
    const networkError = new TypeError("Failed to fetch");
    const result = classifySearchError(networkError);

    expect(result.kind).toBe("network");
    if (result.kind === "network") {
      expect(result.message.length).toBeGreaterThan(0);
    }
  });
});

describe("createSearchController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("aborts the active request immediately on new input before debounce fires and does not emit error state", async () => {
    const signals: AbortSignal[] = [];
    const fetcher = vi.fn((_query: string, signal: AbortSignal) => {
      signals.push(signal);
      return new Promise<Country[]>((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      });
    });

    const states: SearchState[] = [];
    const controller = createSearchController({
      fetcher,
      onStateChange: (state) => states.push(state),
      debounceMs: 300,
    });

    controller.handleInput("sp");
    vi.advanceTimersByTime(300);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(signals[0]?.aborted).toBe(false);

    // Новый ввод должен отменить активный запрос немедленно, не дожидаясь debounce
    controller.handleInput("spain");
    expect(signals[0]?.aborted).toBe(true);

    await vi.runOnlyPendingTimersAsync();

    expect(states.some((s) => s.status === "error")).toBe(false);
  });

  it("transitions to empty state when fetcher returns an empty array (404 semantics)", async () => {
    const fetcher = vi.fn(async () => []);
    const states: SearchState[] = [];

    const controller = createSearchController({
      fetcher,
      onStateChange: (state) => states.push(state),
      debounceMs: 200,
    });

    controller.handleInput("zzzzzz");
    await vi.advanceTimersByTimeAsync(200);

    expect(controller.getState()).toEqual({
      status: "empty",
      query: "zzzzzz",
      countries: [],
    });
  });

  it("transitions to error state on TimeoutError and retries the exact last query", async () => {
    const fetcher = vi
      .fn<(query: string, signal: AbortSignal) => Promise<Country[]>>()
      .mockRejectedValueOnce(new DOMException("Timed out", "TimeoutError"))
      .mockResolvedValueOnce([spainCountry]);

    const controller = createSearchController({
      fetcher,
      onStateChange: () => {},
      debounceMs: 200,
    });

    controller.handleInput("spain");
    await vi.advanceTimersByTimeAsync(200);

    expect(controller.getState().status).toBe("error");
    expect(controller.getState().errorMessage).toBeTruthy();

    controller.retry();
    await Promise.resolve();
    await Promise.resolve();

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1]?.[0]).toBe("spain");
    expect(controller.getState().status).toBe("success");
    expect(controller.getState().countries).toEqual([spainCountry]);
  });

  it("clears results and cancels pending request when input becomes empty", () => {
    const fetcher = vi.fn(async () => [spainCountry]);
    const controller = createSearchController({
      fetcher,
      onStateChange: () => {},
      debounceMs: 300,
    });

    controller.handleInput("sp");
    vi.advanceTimersByTime(150);
    controller.handleInput("   ");
    vi.advanceTimersByTime(300);

    expect(fetcher).not.toHaveBeenCalled();
    expect(controller.getState()).toEqual({
      status: "idle",
      query: "",
      countries: [],
    });
  });
});
