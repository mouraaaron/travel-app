export interface Airport {
  code: string;
  name: string;
}

export interface City {
  city: string;
  country: string;
  airports: Airport[];
}

export interface AirportOption {
  code: string;
  label: string;
  sublabel: string;
}

export const CITIES: City[] = [
  {
    city: "São Paulo",
    country: "Brasil",
    airports: [
      { code: "GRU", name: "Aeroporto Internacional de Guarulhos" },
      { code: "CGH", name: "Aeroporto de Congonhas" },
    ],
  },
  {
    city: "Rio de Janeiro",
    country: "Brasil",
    airports: [
      { code: "GIG", name: "Aeroporto Internacional do Galeão" },
      { code: "SDU", name: "Aeroporto Santos Dumont" },
    ],
  },
  {
    city: "Brasília",
    country: "Brasil",
    airports: [{ code: "BSB", name: "Aeroporto Internacional de Brasília" }],
  },
  {
    city: "Salvador",
    country: "Brasil",
    airports: [{ code: "SSA", name: "Aeroporto Internacional de Salvador" }],
  },
  {
    city: "Curitiba",
    country: "Brasil",
    airports: [{ code: "CWB", name: "Aeroporto Internacional Afonso Pena" }],
  },
  {
    city: "Nova York",
    country: "Estados Unidos",
    airports: [
      { code: "JFK", name: "John F. Kennedy International Airport" },
      { code: "LGA", name: "LaGuardia Airport" },
    ],
  },
  {
    city: "Miami",
    country: "Estados Unidos",
    airports: [{ code: "MIA", name: "Miami International Airport" }],
  },
  {
    city: "Buenos Aires",
    country: "Argentina",
    airports: [
      { code: "EZE", name: "Aeroporto Internacional Ministro Pistarini" },
      { code: "AEP", name: "Aeroparque Jorge Newbery" },
    ],
  },
  {
    city: "Lisboa",
    country: "Portugal",
    airports: [{ code: "LIS", name: "Aeroporto Humberto Delgado" }],
  },
];

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function searchAirports(query: string): AirportOption[] {
  const normalizedQuery = normalize(query);
  if (normalizedQuery.length === 0) return [];

  const options: AirportOption[] = [];
  for (const city of CITIES) {
    for (const airport of city.airports) {
      const haystack = normalize(
        `${city.city} ${city.country} ${airport.code} ${airport.name}`
      );
      if (haystack.includes(normalizedQuery)) {
        options.push({
          code: airport.code,
          label: `${city.city} (${airport.code})`,
          sublabel: airport.name,
        });
      }
    }
  }
  return options;
}

export function findAirportByCode(code: string): AirportOption | undefined {
  const normalizedCode = code.trim().toUpperCase();
  for (const city of CITIES) {
    for (const airport of city.airports) {
      if (airport.code === normalizedCode) {
        return {
          code: airport.code,
          label: `${city.city} (${airport.code})`,
          sublabel: airport.name,
        };
      }
    }
  }
  return undefined;
}
