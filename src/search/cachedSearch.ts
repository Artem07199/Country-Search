import type { Country } from "../types/country.js";
import type { CountryFetcher } from "./searchController.js";

interface InFlightEntry {
  promise: Promise<Country[]>;
  controller: AbortController;
  subscribers: number;
}

function createAbortError(signal: AbortSignal): unknown {
  return signal.reason instanceof Error
    ? signal.reason
    : new DOMException("The operation was aborted.", "AbortError");
}

export function createCachedSearch(fetcher: CountryFetcher): CountryFetcher {
  const cache = new Map<string, Country[]>();
  const inFlight = new Map<string, InFlightEntry>();

  return (rawQuery: string, callerSignal: AbortSignal): Promise<Country[]> => {
    if (callerSignal.aborted) {
      return Promise.reject(createAbortError(callerSignal));
    }

    const trimmed = rawQuery.trim();
    const key = trimmed.toLowerCase();

    if (!key) {
      return Promise.resolve([]);
    }

    const cached = cache.get(key);
    if (cached !== undefined) {
      return Promise.resolve(cached);
    }

    let entry = inFlight.get(key);

    if (!entry) {
      const controller = new AbortController();
      const promise = fetcher(trimmed, controller.signal)
        .then((countries) => {
          cache.set(key, countries);
          return countries;
        })
        .finally(() => {
          inFlight.delete(key);
        });

      promise.catch(() => {});

      entry = {
        promise,
        controller,
        subscribers: 0,
      };
      inFlight.set(key, entry);
    }

    const currentEntry = entry;
    currentEntry.subscribers += 1;

    return new Promise<Country[]>((resolve, reject) => {
      let settled = false;

      const onCallerAbort = (): void => {
        if (settled) {
          return;
        }
        settled = true;
        currentEntry.subscribers -= 1;

        if (currentEntry.subscribers <= 0) {
          currentEntry.controller.abort();
        }

        reject(createAbortError(callerSignal));
      };

      callerSignal.addEventListener("abort", onCallerAbort, { once: true });

      currentEntry.promise.then(
        (countries) => {
          if (settled) {
            return;
          }
          settled = true;
          callerSignal.removeEventListener("abort", onCallerAbort);
          resolve(countries);
        },
        (error: unknown) => {
          if (settled) {
            return;
          }
          settled = true;
          callerSignal.removeEventListener("abort", onCallerAbort);
          reject(error);
        },
      );
    });
  };
}
