import { HttpError } from "../api/httpError.js";

export type SearchErrorClassification =
  | { kind: "abort" }
  | { kind: "not-found" }
  | { kind: "timeout"; message: string }
  | { kind: "http"; status: number; message: string }
  | { kind: "network"; message: string };

function getErrorName(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "name" in error) {
    const { name } = error as { name?: unknown };
    return typeof name === "string" ? name : undefined;
  }
  return undefined;
}

export function classifySearchError(error: unknown): SearchErrorClassification {
  const errorName = getErrorName(error);

  if (errorName === "AbortError") {
    return { kind: "abort" };
  }

  if (errorName === "TimeoutError") {
    return {
      kind: "timeout",
      message:
        "Превышено время ожидания ответа от сервера. Попробуйте ещё раз.",
    };
  }

  if (error instanceof HttpError) {
    if (error.status === 404) {
      return { kind: "not-found" };
    }

    return {
      kind: "http",
      status: error.status,
      message: `Ошибка сервера (${error.status}). Попробуйте повторить запрос.`,
    };
  }

  return {
    kind: "network",
    message:
      "Не удалось выполнить запрос. Проверьте подключение к сети и попробуйте снова.",
  };
}
