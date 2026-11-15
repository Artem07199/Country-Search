# Architectural Decisions — Country Search

## 1. Request Cancellation Mechanism and Debounce Delay

### Why Ignoring Stale Responses Is Not Enough

Simply discarding outdated responses via a timestamp or request counter leaves unnecessary HTTP requests running in the background, wastes bandwidth, and complicates loading-state management. Furthermore, if a previous request is cancelled only when the _next_ network call starts (after the debounce delay expires), the old request can still resolve during the debounce window and render stale results under the newly typed query.

### How Cancellation Is Implemented

- **Immediate cancellation on every input change:** In `src/search/searchController.ts`, `handleInput` immediately calls `abortActiveRequest()` (`activeController.abort()`) and `debouncedSearch.cancel()` on every keystroke. Any in-flight network request is aborted right away, before the next debounce timer even starts.
- **Separating user cancellation from timeouts:** In `src/api/searchCountries.ts`, the external `signal` from the search controller is combined with a timeout signal via `AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])` (`DEFAULT_TIMEOUT_MS = 8000`).
  - When aborted by a new user input, `fetch` rejects with a `DOMException` where `name === 'AbortError'`. `classifySearchError` (`src/search/errorHandler.ts`) classifies it as `'abort'`, so the controller silently ignores it without transitioning the UI to an error state.
  - When the timeout expires, `fetch` rejects with a `DOMException` where `name === 'TimeoutError'`. This is classified as `'timeout'` and displayed to the user with a "Retry" button.
- **Compatibility with in-flight deduplication (cache):** In `src/search/cachedSearch.ts`, each active unique query tracks its active `subscribers` count. If one of multiple concurrent subscribers cancels, only its promise rejects while the shared `fetch` continues. When the last (or only) subscriber cancels, `controller.abort()` is invoked so the browser genuinely aborts the network request (`canceled` in DevTools).

### Choice of Debounce Delay (`350 ms`)

`DEFAULT_DEBOUNCE_MS` is set to `350` in `src/search/searchController.ts`:

- Delays below `150–200 ms` barely reduce network traffic at an average typing speed (4–6 characters per second), firing intermediate requests for prefixes like `s`, `sp`, `spa`.
- Delays above `500 ms` make the interface feel sluggish because users notice a clear pause after finishing a word before the loading indicator appears.
- `350 ms` sits in the sweet spot (`300–400 ms`): it absorbs the gap between consecutive keystrokes during continuous typing while keeping the UI responsive once the user pauses.

---

## 2. Complexity Analysis (Big O)

### `mapCountryResponse(raw)` (`src/api/mapCountryResponse.ts`)

- **Time:** $O(L + B + C)$ per country, where $L$ is the number of languages (`raw.languages`), $B$ is the number of bordering countries (`raw.borders`), and $C$ is the number of currencies (`raw.currencies`). All scalar fields (`name`, `alpha3Code`, `capital`, `region`, `population`, `area`, `flags`) are accessed in $O(1)$.
  - In real-world country data, $L$, $B$, and $C$ are small bounded constants (typically under 15 items), so mapping a single record runs in $O(1)$ in practice, and mapping an entire API response of $N$ countries (`rawCountries.map(mapCountryResponse)`) runs in $O(N)$.
- **Space:** $O(L + B + C)$ for allocating the resulting `Country` object and shallow copies of `languages`, `borders`, and `currencies` to preserve input immutability.

### Response Cache and In-Flight Deduplication (`src/search/cachedSearch.ts`)

Both completed responses (`cache`) and active requests (`inFlight`) are stored in JavaScript `Map<string, ...>` hash tables:

- **Lookup, insertion, and deletion:** Amortized $O(1)$ with respect to the number of cached entries (or $O(|q|)$ when accounting for query normalization `trim().toLowerCase()` and hashing a query of length $|q|$).
- **Space:** $O(K \cdot M)$, where $K$ is the number of unique cached queries and $M$ is the average number of countries per response. Entries in `inFlight` are always removed in `finally`, preventing memory leaks.

### Search History (`src/search/searchHistory.ts`)

- **Time:** $O(H)$ for insertion and deduplication, where $H$ is the maximum history size (`DEFAULT_MAX_ITEMS = 6`). Because $H$ is a small fixed constant, this effectively runs in $O(1)$.

---

## 3. Clean Code Principles Applied

- **Single Responsibility Principle (SRP) / Separation of Concerns:**
  - Network layer (`src/api/searchCountries.ts`, `src/api/httpError.ts`) handles only HTTP communication, `response.ok` checks, `404` empty-result semantics, and timeouts.
  - Data transformation (`src/api/mapCountryResponse.ts`) is isolated into a pure mapper function.
  - Error classification (`src/search/errorHandler.ts`) is decoupled from state orchestration (`src/search/searchController.ts`).
  - All business logic is completely DOM-agnostic and tested in Node.js without a browser; rendering is strictly isolated in `src/ui/renderApp.ts` and `src/ui/domHelpers.ts`.
- **Dependency Injection:**
  - `createSearchController` receives `fetcher` and `onStateChange` as parameters, enabling deterministic unit and race-condition testing with mocked `fetch` calls.
  - `createSearchHistory` depends on the `StorageLike` interface instead of `window.localStorage` directly, allowing trivial testing with an in-memory storage stub.
- **Pure Functions and Immutability:**
  - `mapCountryResponse` never mutates its `RawCountry` input and returns fresh array copies (`[...(raw.borders ?? [])]`).
  - `classifySearchError` is a deterministic pure function with no side effects.
- **Guard Clauses (Early Returns):**
  - Edge cases (empty query, `404` status, already-aborted signal, empty result list) return early in `searchCountries`, `createCachedSearch`, `createSearchController`, and `renderState`, keeping control flow flat and readable.
- **Safe Native DOM Manipulation:**
  - `src/ui/renderApp.ts` and `src/ui/domHelpers.ts` avoid `innerHTML` and `insertAdjacentHTML` entirely, using `document.createElement`, `textContent`, and `replaceChildren` to prevent XSS and keep rendering predictable.
