import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../src/api/httpError.js";
import { searchCountries } from "../src/api/searchCountries.js";
import type { RawCountry } from "../src/types/country.js";

const mockSpain: RawCountry = {
  name: "Spain",
  alpha3Code: "ESP",
  capital: "Madrid",
  region: "Europe",
  population: 47351567,
  flags: { svg: "https://flagcdn.com/es.svg", alt: "Flag of Spain" },
  languages: [{ name: "Spanish" }],
};

function createAbortAwareFetchMock(): ReturnType<typeof vi.fn> {
  return vi.fn((_url: string, init?: RequestInit) => {
    const signal = init?.signal;

    return new Promise((_resolve, reject) => {
      const rejectWithReason = (): void => {
        const reason = signal?.reason;
        reject(
          reason instanceof Error
            ? reason
            : new DOMException("Aborted", "AbortError"),
        );
      };

      if (signal?.aborted) {
        rejectWithReason();
        return;
      }

      signal?.addEventListener("abort", rejectWithReason, { once: true });
    });
  });
}

describe("searchCountries", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches countries by encoded query and maps the response", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [mockSpain],
    });

    const controller = new AbortController();
    const countries = await searchCountries(
      "  south africa  ",
      controller.signal,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://countries.dev/name/south%20africa");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(countries).toHaveLength(1);
    expect(countries[0]?.name).toBe("Spain");
  });

  it("returns an empty array without calling fetch when query is empty or whitespace", async () => {
    const controller = new AbortController();
    const result = await searchCountries("   ", controller.signal);

    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns an empty array on 404 instead of throwing an error", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ status: 404, message: "Not Found" }),
    });

    const controller = new AbortController();
    const result = await searchCountries(
      "nonexistentcountry",
      controller.signal,
    );

    expect(result).toEqual([]);
  });

  it("throws HttpError with response status on non-404 HTTP errors", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const controller = new AbortController();

    try {
      await searchCountries("spain", controller.signal);
      expect.fail("Expected HttpError to be thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect(error).toBeInstanceOf(Error);
      expect((error as HttpError).status).toBe(500);
    }
  });

  it("aborts the request with AbortError when caller signal aborts", async () => {
    vi.stubGlobal("fetch", createAbortAwareFetchMock());

    const controller = new AbortController();
    const promise = searchCountries("spain", controller.signal, 5000);

    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });

  it("aborts the request with TimeoutError when timeout expires", async () => {
    vi.stubGlobal("fetch", createAbortAwareFetchMock());

    const controller = new AbortController();
    const promise = searchCountries("spain", controller.signal, 30);

    await expect(promise).rejects.toMatchObject({ name: "TimeoutError" });
  });
});
