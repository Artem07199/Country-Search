export function debounce(fn, delay) {
  let timerId;
  const cancel = () => {
    if (timerId !== undefined) {
      clearTimeout(timerId);
      timerId = undefined;
    }
  };
  const debounced = (...args) => {
    cancel();
    timerId = setTimeout(() => {
      timerId = undefined;
      fn(...args);
    }, delay);
  };
  return Object.assign(debounced, { cancel });
}
