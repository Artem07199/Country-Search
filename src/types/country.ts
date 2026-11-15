export interface RawCountryLanguage {
  name: string;
  nativeName?: string;
}

export interface RawCountryCurrency {
  code?: string;
  name: string;
  symbol?: string;
}

export interface RawCountryFlags {
  svg?: string;
  png?: string;
  alt?: string;
}

export interface RawCountry {
  name: string;
  alpha3Code?: string;
  capital?: string;
  region?: string;
  subregion?: string;
  population?: number;
  area?: number;
  borders?: string[];
  flag?: string;
  flags?: RawCountryFlags;
  languages?: RawCountryLanguage[];
  currencies?: RawCountryCurrency[];
  demonym?: string;
}

export interface Country {
  id: string;
  name: string;
  flagUrl: string;
  flagAlt: string;
  capital: string;
  region: string;
  population: number;
  languages: string[];
  description: string;
  area: number | null;
  borders: string[];
  currencies: string[];
}
