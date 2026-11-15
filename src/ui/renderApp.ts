import type { SearchState } from "../search/searchController.js";
import type { Country } from "../types/country.js";
import { createEl, formatNumber } from "./domHelpers.js";

export interface AppCallbacks {
  onInput: (query: string) => void;
  onSubmit: (query: string) => void;
  onRetry: () => void;
  onHistorySelect: (query: string) => void;
  onHistoryClear: () => void;
}

export interface AppView {
  renderState: (state: SearchState) => void;
  renderHistory: (items: string[]) => void;
  setInputValue: (value: string) => void;
}

function createMetaRow(label: string, value: string): HTMLDivElement {
  const row = createEl("div", "meta-row");
  const keyEl = createEl("span", "meta-label", `${label}: `);
  const valEl = createEl("span", "meta-value", value);
  row.append(keyEl, valEl);
  return row;
}

function createCountryCard(
  country: Country,
  onSelect: (country: Country) => void,
): HTMLElement {
  const card = createEl("article", "country-card");
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Подробнее о стране ${country.name}`);

  const flagWrap = createEl("div", "country-flag-wrap");
  if (country.flagUrl) {
    const img = createEl("img", "country-flag");
    img.src = country.flagUrl;
    img.alt = country.flagAlt;
    img.loading = "lazy";
    flagWrap.append(img);
  } else {
    flagWrap.append(createEl("div", "country-flag-placeholder", "Нет флага"));
  }

  const body = createEl("div", "country-card-body");
  const title = createEl("h2", "country-name", country.name);
  const languagesText =
    country.languages.length > 0 ? country.languages.join(", ") : "Не указаны";

  body.append(
    title,
    createMetaRow("Столица", country.capital),
    createMetaRow("Регион", country.region),
    createMetaRow("Население", formatNumber(country.population)),
    createMetaRow("Языки", languagesText),
  );

  card.append(flagWrap, body);

  card.addEventListener("click", () => onSelect(country));
  card.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(country);
    }
  });

  return card;
}

function createDetailModal(
  country: Country,
  onClose: () => void,
): HTMLDivElement {
  const backdrop = createEl("div", "modal-backdrop");
  backdrop.setAttribute("role", "dialog");
  backdrop.setAttribute("aria-modal", "true");
  backdrop.setAttribute("aria-label", country.name);

  const dialog = createEl("div", "modal-dialog");

  const header = createEl("div", "modal-header");
  const title = createEl("h2", "modal-title", country.name);
  const closeBtn = createEl("button", "modal-close", "×");
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Закрыть");
  closeBtn.addEventListener("click", onClose);
  header.append(title, closeBtn);

  const content = createEl("div", "modal-content");
  if (country.flagUrl) {
    const flag = createEl("img", "modal-flag");
    flag.src = country.flagUrl;
    flag.alt = country.flagAlt;
    content.append(flag);
  }

  const description = createEl("p", "modal-description", country.description);
  const detailsList = createEl("div", "modal-details");

  const areaText =
    country.area !== null ? `${formatNumber(country.area)} км²` : "Не указана";
  const languagesText =
    country.languages.length > 0 ? country.languages.join(", ") : "Не указаны";
  const currenciesText =
    country.currencies.length > 0
      ? country.currencies.join(", ")
      : "Не указаны";
  const bordersText =
    country.borders.length > 0
      ? country.borders.join(", ")
      : "Нет сухопутных границ";

  detailsList.append(
    createMetaRow("Столица", country.capital),
    createMetaRow("Регион", country.region),
    createMetaRow("Население", formatNumber(country.population)),
    createMetaRow("Площадь", areaText),
    createMetaRow("Языки", languagesText),
    createMetaRow("Валюты", currenciesText),
    createMetaRow("Границы", bordersText),
  );

  content.append(description, detailsList);
  dialog.append(header, content);
  backdrop.append(dialog);

  backdrop.addEventListener("click", (event: MouseEvent) => {
    if (event.target === backdrop) {
      onClose();
    }
  });

  return backdrop;
}

export function mountApp(root: HTMLElement, callbacks: AppCallbacks): AppView {
  const container = createEl("div", "app-container");

  const header = createEl("header", "app-header");
  const title = createEl("h1", "app-title", "Поиск стран");
  const subtitle = createEl(
    "p",
    "app-subtitle",
    "Введите название страны на английском — например, Spain, Belarus или Japan",
  );
  header.append(title, subtitle);

  const form = createEl("form", "search-form");
  form.setAttribute("role", "search");

  const inputWrap = createEl("div", "search-input-wrap");
  const input = createEl("input", "search-input");
  input.type = "search";
  input.placeholder = "Например: Spain...";
  input.autocomplete = "off";
  input.setAttribute("aria-label", "Поиск страны по названию");

  const clearBtn = createEl("button", "clear-btn hidden", "Очистить");
  clearBtn.type = "button";

  inputWrap.append(input, clearBtn);
  form.append(inputWrap);

  const historySection = createEl("section", "history-section hidden");
  historySection.setAttribute("aria-label", "История поиска");

  const statusArea = createEl("main", "results-area");
  statusArea.setAttribute("aria-live", "polite");

  const modalHost = createEl("div", "modal-host");

  container.append(header, form, historySection, statusArea, modalHost);
  root.replaceChildren(container);

  let activeEscapeHandler: ((event: KeyboardEvent) => void) | null = null;

  const closeModal = (): void => {
    modalHost.replaceChildren();
    if (activeEscapeHandler) {
      document.removeEventListener("keydown", activeEscapeHandler);
      activeEscapeHandler = null;
    }
  };

  const openModal = (country: Country): void => {
    closeModal();
    const modal = createDetailModal(country, closeModal);
    modalHost.replaceChildren(modal);

    activeEscapeHandler = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        closeModal();
      }
    };
    document.addEventListener("keydown", activeEscapeHandler);
  };

  const updateClearVisibility = (): void => {
    clearBtn.classList.toggle("hidden", input.value.length === 0);
  };

  input.addEventListener("input", () => {
    updateClearVisibility();
    callbacks.onInput(input.value);
  });

  form.addEventListener("submit", (event: SubmitEvent) => {
    event.preventDefault();
    callbacks.onSubmit(input.value);
  });

  clearBtn.addEventListener("click", () => {
    input.value = "";
    updateClearVisibility();
    callbacks.onInput("");
    input.focus();
  });

  const renderState = (state: SearchState): void => {
    if (state.status === "idle") {
      const box = createEl("div", "state-box state-idle");
      box.append(
        createEl("p", "state-title", "Начните вводить название страны"),
        createEl(
          "p",
          "state-hint",
          "Результаты появятся автоматически без перезагрузки страницы.",
        ),
      );
      statusArea.replaceChildren(box);
      return;
    }

    if (state.status === "loading") {
      const box = createEl("div", "state-box state-loading");
      const spinner = createEl("div", "spinner");
      spinner.setAttribute("aria-hidden", "true");
      box.append(
        spinner,
        createEl("p", "state-title", `Ищем «${state.query}»...`),
      );
      statusArea.replaceChildren(box);
      return;
    }

    if (state.status === "empty") {
      const box = createEl("div", "state-box state-empty");
      box.append(
        createEl("p", "state-title", "Ничего не найдено"),
        createEl(
          "p",
          "state-hint",
          `По запросу «${state.query}» совпадений нет. Попробуйте другое написание.`,
        ),
      );
      statusArea.replaceChildren(box);
      return;
    }

    if (state.status === "error") {
      const box = createEl("div", "state-box state-error");
      const titleEl = createEl(
        "p",
        "state-title",
        "Не удалось загрузить данные",
      );
      const msgEl = createEl(
        "p",
        "state-hint",
        state.errorMessage ?? "Произошла ошибка при обращении к серверу.",
      );
      const retryBtn = createEl("button", "retry-btn", "Повторить");
      retryBtn.type = "button";
      retryBtn.addEventListener("click", callbacks.onRetry);

      box.append(titleEl, msgEl, retryBtn);
      statusArea.replaceChildren(box);
      return;
    }

    const summary = createEl(
      "p",
      "results-count",
      `Найдено стран: ${state.countries.length}`,
    );
    const grid = createEl("div", "countries-grid");
    state.countries.forEach((country) => {
      grid.append(createCountryCard(country, openModal));
    });

    statusArea.replaceChildren(summary, grid);
  };

  const renderHistory = (items: string[]): void => {
    if (items.length === 0) {
      historySection.classList.add("hidden");
      historySection.replaceChildren();
      return;
    }

    historySection.classList.remove("hidden");
    const label = createEl("span", "history-label", "Недавние:");
    const chipsWrap = createEl("div", "history-chips");

    items.forEach((query) => {
      const chip = createEl("button", "history-chip", query);
      chip.type = "button";
      chip.addEventListener("click", () => callbacks.onHistorySelect(query));
      chipsWrap.append(chip);
    });

    const clearHistoryBtn = createEl(
      "button",
      "history-clear-btn",
      "Очистить историю",
    );
    clearHistoryBtn.type = "button";
    clearHistoryBtn.addEventListener("click", callbacks.onHistoryClear);

    historySection.replaceChildren(label, chipsWrap, clearHistoryBtn);
  };

  const setInputValue = (value: string): void => {
    input.value = value;
    updateClearVisibility();
  };

  return {
    renderState,
    renderHistory,
    setInputValue,
  };
}
