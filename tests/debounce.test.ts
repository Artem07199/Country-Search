import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { debounce } from "../src/utils/debounce.js";

describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("delays function execution until after the specified delay", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced("spain");
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("spain");
  });

  it("resets the timer on repeated calls and invokes with the latest arguments", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced("s");
    vi.advanceTimersByTime(200);

    debounced("sp");
    vi.advanceTimersByTime(200);

    debounced("spain");
    vi.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("spain");
  });

  it("allows multiple separate executions after each delay elapses", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    debounced("france");
    vi.advanceTimersByTime(200);

    debounced("germany");
    vi.advanceTimersByTime(200);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(1, "france");
    expect(fn).toHaveBeenNthCalledWith(2, "germany");
  });

  it("cancels a pending invocation when cancel() is called", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced("italy");
    vi.advanceTimersByTime(150);
    debounced.cancel();

    vi.advanceTimersByTime(300);
    expect(fn).not.toHaveBeenCalled();
  });
});
