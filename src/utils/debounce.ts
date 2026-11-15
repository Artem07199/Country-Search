export interface DebouncedFunction<Args extends unknown[]> {
  (...args: Args): void;
  cancel: () => void;
}

export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delay: number,
): DebouncedFunction<Args> {
  void fn;
  void delay;

  const stub = (...args: Args): void => {
    void args;
    throw new Error("Not implemented");
  };

  return Object.assign(stub, {
    cancel: (): void => {
      throw new Error("Not implemented");
    },
  });
}
