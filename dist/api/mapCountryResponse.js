function formatCurrency(currency) {
  return currency.symbol
    ? `${currency.name} (${currency.symbol})`
    : currency.name;
}
function buildDescription(raw) {
  const location =
    raw.subregion && raw.region
      ? `${raw.subregion} (${raw.region})`
      : (raw.region ?? raw.subregion);
  if (!location) {
    return `${raw.name} — регион не указан.`;
  }
  const capitalPart = raw.capital ? `, столица: ${raw.capital}` : "";
  return `${raw.name} — ${location}${capitalPart}.`;
}
export function mapCountryResponse(raw) {
  const flagUrl = raw.flags?.svg ?? raw.flags?.png ?? raw.flag ?? "";
  const flagAlt = raw.flags?.alt ?? `Флаг ${raw.name}`;
  return {
    id: raw.alpha3Code ?? raw.name,
    name: raw.name,
    flagUrl,
    flagAlt,
    capital: raw.capital?.trim() || "Не указана",
    region: raw.region?.trim() || "Не указан",
    population: raw.population ?? 0,
    languages: (raw.languages ?? []).map((language) => language.name),
    description: buildDescription(raw),
    area: raw.area ?? null,
    borders: [...(raw.borders ?? [])],
    currencies: (raw.currencies ?? []).map(formatCurrency),
  };
}
