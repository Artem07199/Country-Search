export function createEl(tag, className, text) {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}
export function formatNumber(value) {
  return new Intl.NumberFormat("ru-RU").format(value);
}
