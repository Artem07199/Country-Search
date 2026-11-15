import { describe, expect, it, vi } from "vitest";
import { createCachedSearch } from "../src/search/cachedSearch.js";
import {
  createSearchHistory,
  type StorageLike,
} from "../src/search/searchHistory.js";
import type { Country } from "../src/types/country.js";

const spain: Country = {
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

function createMemoryStorage(): StorageLike {
  const store = new Map<string, string>();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
  };
}

describe("createCachedSearch", () => {
  it("returns cached results for repeated normalized queries without calling fetcher again", async () => {
    const fetcher = vi.fn(async () => [spain]);
    const cachedSearch = createCachedSearch(fetcher);

    const first = await cachedSearch("Spain", new AbortController().signal);
    const second = await cachedSearch("  spain ", new AbortController().signal);

    expect(first).toEqual([spain]);
    expect(second).toEqual([spain]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("deduplicates concurrent in-flight requests and isolates caller aborts", async () => {
    let resolveFetch!: (countries: Country[]) => void;
    let internalSignal!: AbortSignal;

    const fetcher = vi.fn((_query: string, signal: AbortSignal) => {
      internalSignal = signal;
      return new Promise<Country[]>((resolve, reject) => {
        resolveFetch = resolve;
        signal.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      });
    });

    const cachedSearch = createCachedSearch(fetcher);
    const controllerA = new AbortController();
    const controllerB = new AbortController();

    const promiseA = cachedSearch("spain", controllerA.signal);
    const promiseB = cachedSearch("SPAIN", controllerB.signal);

    expect(fetcher).toHaveBeenCalledTimes(1);

    controllerA.abort();
    await expect(promiseA).rejects.toMatchObject({ name: "AbortError" });
    expect(internalSignal.aborted).toBe(false);

    resolveFetch([spain]);
    await expect(promiseB).resolves.toEqual([spain]);
  });

  it("aborts the underlying network request when all subscribers cancel", async () => {
    let internalSignal!: AbortSignal;

    const fetcher = vi.fn((_query: string, signal: AbortSignal) => {
      internalSignal = signal;
      return new Promise<Country[]>((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      });
    });

    const cachedSearch = createCachedSearch(fetcher);
    const controller = new AbortController();
    const promise = cachedSearch("spain", controller.signal);

    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(internalSignal.aborted).toBe(true);
  });
});

describe("createSearchHistory", () => {
  it("stores unique recent queries in reverse chronological order with max limit", () => {
    const history = createSearchHistory(createMemoryStorage(), 3);

    history.add("Spain");
    history.add("Belarus");
    history.add("France");
    history.add("spain");
    history.add("Germany");

    expect(history.getAll()).toEqual(["Germany", "spain", "France"]);
  });

  it("handles corrupted storage JSON gracefully and clears history", () => {
    const storage = createMemoryStorage();
    storage.setItem("country-search:history", "{broken-json");

    const history = createSearchHistory(storage);
    expect(history.getAll()).toEqual([]);

    history.add("Italy");
    expect(history.getAll()).toEqual(["Italy"]);

    history.clear();
    expect(history.getAll()).toEqual([]);
  });
});
