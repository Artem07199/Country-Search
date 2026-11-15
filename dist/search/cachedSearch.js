function createAbortError(signal) {
  return signal.reason instanceof Error
    ? signal.reason
    : new DOMException("The operation was aborted.", "AbortError");
}
export function createCachedSearch(fetcher) {
  const cache = new Map();
  const inFlight = new Map();
  return (rawQuery, callerSignal) => {
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
    return new Promise((resolve, reject) => {
      let settled = false;
      const onCallerAbort = () => {
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
        (error) => {
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
