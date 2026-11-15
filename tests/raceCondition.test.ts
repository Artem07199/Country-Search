import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchCountries } from "../src/api/searchCountries.js";
import {
  createSearchController,
  type SearchState,
} from "../src/search/searchController.js";
import type { RawCountry } from "../src/types/country.js";

interface DeferredFetchCall {
  url: string;
  signal: AbortSignal;
  wasAborted: boolean;
  resolveWith: (countries: RawCountry[]) => void;
}

const spRawResults: RawCountry[] = [
  {
    name: "Spain",
    alpha3Code: "ESP",
    capital: "Madrid",
    region: "Europe",
    population: 47351567,
  },
  {
    name: "Svalbard and Jan Mayen",
    alpha3Code: "SJM",
    capital: "Longyearbyen",
    region: "Europe",
    population: 2562,
  },
];

const spainRawResults: RawCountry[] = [
  {
    name: "Spain",
    alpha3Code: "ESP",
    capital: "Madrid",
    region: "Europe",
    population: 47351567,
  },
];

function createRaceFetchMock(): {
  calls: DeferredFetchCall[];
  fetchMock: ReturnType<typeof vi.fn>;
} {
  const calls: DeferredFetchCall[] = [];

  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const signal = init?.signal;
    if (!signal) {
      throw new Error("Expected fetch to receive an AbortSignal");
    }

    let settled = false;
    let resolvePromise!: (value: Response) => void;
    let rejectPromise!: (reason?: unknown) => void;

    const promise = new Promise<Response>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });

    const callRecord: DeferredFetchCall = {
      url,
      signal,
      wasAborted: false,
      resolveWith: (countries: RawCountry[]) => {
        if (settled) {
          return;
        }
        settled = true;
        resolvePromise({
          ok: true,
          status: 200,
          json: async () => countries,
        } as Response);
      },
    };

    const handleAbort = (): void => {
      callRecord.wasAborted = true;
      if (settled) {
        return;
      }
      settled = true;
      const reason = signal.reason;
      rejectPromise(
        reason instanceof Error
          ? reason
          : new DOMException("The operation was aborted.", "AbortError"),
      );
    };

    if (signal.aborted) {
      handleAbort();
    } else {
      signal.addEventListener("abort", handleAbort, { once: true });
    }

    calls.push(callRecord);
    return promise;
  });

  return { calls, fetchMock };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("race condition handling with real AbortController cancellation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("aborts the earlier slower request and keeps only the latest query result when responses resolve out of order", async () => {
    const { calls, fetchMock } = createRaceFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    const states: SearchState[] = [];
    const controller = createSearchController({
      fetcher: (query, signal) => searchCountries(query, signal, 10_000),
      onStateChange: (state) => states.push(state),
      debounceMs: 200,
    });

    controller.handleInput("sp");
    vi.advanceTimersByTime(200);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toContain("/name/sp");

    controller.handleInput("spain");
    expect(calls[0]?.signal.aborted).toBe(true);
    expect(calls[0]?.wasAborted).toBe(true);

    vi.advanceTimersByTime(200);
    expect(calls).toHaveLength(2);
    expect(calls[1]?.url).toContain("/name/spain");

    calls[1]?.resolveWith(spainRawResults);
    await flushMicrotasks();

    calls[0]?.resolveWith(spRawResults);
    await flushMicrotasks();

    const finalState = controller.getState();
    expect(finalState.status).toBe("success");
    expect(finalState.query).toBe("spain");
    expect(finalState.countries.map((c) => c.name)).toEqual(["Spain"]);
    expect(states.some((s) => s.status === "error")).toBe(false);
  });

  it("prevents an outdated response from rendering during the debounce window before the next request starts", async () => {
    const { calls, fetchMock } = createRaceFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    const states: SearchState[] = [];
    const controller = createSearchController({
      fetcher: (query, signal) => searchCountries(query, signal, 10_000),
      onStateChange: (state) => states.push(state),
      debounceMs: 300,
    });

    controller.handleInput("sp");
    vi.advanceTimersByTime(300);
    expect(calls).toHaveLength(1);

    controller.handleInput("spain");
    vi.advanceTimersByTime(100);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.wasAborted).toBe(true);

    calls[0]?.resolveWith(spRawResults);
    await flushMicrotasks();

    expect(states.some((s) => s.status === "success")).toBe(false);
    expect(states.some((s) => s.status === "error")).toBe(false);
  });
});
