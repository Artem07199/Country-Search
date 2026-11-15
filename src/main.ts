import { searchCountries } from "./api/searchCountries.js";
import { createCachedSearch } from "./search/cachedSearch.js";
import { createSearchController } from "./search/searchController.js";
import { createSearchHistory } from "./search/searchHistory.js";
import { mountApp, type AppView } from "./ui/renderApp.js";

function initApp(): void {
  const history = createSearchHistory(window.localStorage);
  const cachedFetcher = createCachedSearch((query, signal) =>
    searchCountries(query, signal),
  );

  const root = document.createElement("div");
  root.id = "app";
  document.body.append(root);

  let view: AppView | null = null;

  const controller = createSearchController({
    fetcher: cachedFetcher,
    onStateChange: (state) => {
      view?.renderState(state);
      if (state.status === "success" && state.query) {
        view?.renderHistory(history.add(state.query));
      }
    },
  });

  view = mountApp(root, {
    onInput: (query) => controller.handleInput(query),
    onSubmit: (query) => controller.searchNow(query),
    onRetry: () => controller.retry(),
    onHistorySelect: (query) => {
      view?.setInputValue(query);
      controller.searchNow(query);
    },
    onHistoryClear: () => {
      view?.renderHistory(history.clear());
    },
  });

  view.renderHistory(history.getAll());
  view.renderState(controller.getState());
}

initApp();
