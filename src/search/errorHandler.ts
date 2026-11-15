export type SearchErrorClassification =
  | { kind: "abort" }
  | { kind: "not-found" }
  | { kind: "timeout"; message: string }
  | { kind: "http"; status: number; message: string }
  | { kind: "network"; message: string };

export function classifySearchError(error: unknown): SearchErrorClassification {
  void error;
  throw new Error("Not implemented");
}
