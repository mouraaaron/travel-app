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
  {
    city: "Confins",
    country: "Brasil",
    airports: [{ code: "CNF", name: "Aeroporto Internacional de Confins" }],
  },
  {
    city: "Porto Alegre",
    country: "Brasil",
    airports: [{ code: "POA", name: "Aeroporto Internacional Salgado Filho" }],
  },
  {
    city: "Recife",
    country: "Brasil",
    airports: [{ code: "REC", name: "Aeroporto Internacional dos Guararapes" }],
  },
  {
    city: "Fortaleza",
    country: "Brasil",
    airports: [{ code: "FOR", name: "Aeroporto Internacional Pinto Martins" }],
  },
  {
    city: "Manaus",
    country: "Brasil",
    airports: [{ code: "MAO", name: "Aeroporto Internacional Eduardo Gomes" }],
  },
  {
    city: "Belo Horizonte",
    country: "Brasil",
    airports: [{ code: "PLU", name: "Aeroporto da Pampulha" }],
  },
  {
    city: "Londres",
    country: "Reino Unido",
    airports: [
      { code: "LHR", name: "Heathrow Airport" },
      { code: "LGW", name: "Gatwick Airport" },
    ],
  },
  {
    city: "Paris",
    country: "França",
    airports: [{ code: "CDG", name: "Aéroport Charles de Gaulle" }],
  },
  {
    city: "Madri",
    country: "Espanha",
    airports: [{ code: "MAD", name: "Aeropuerto Adolfo Suárez Madrid-Barajas" }],
  },
  {
    city: "Frankfurt",
    country: "Alemanha",
    airports: [{ code: "FRA", name: "Frankfurt Airport" }],
  },
  {
    city: "Tóquio",
    country: "Japão",
    airports: [{ code: "NRT", name: "Narita International Airport" }],
  },
  {
    city: "Santiago",
    country: "Chile",
    airports: [{ code: "SCL", name: "Aeropuerto Internacional Arturo Merino Benítez" }],
  },
  {
    city: "Bogotá",
    country: "Colômbia",
    airports: [{ code: "BOG", name: "Aeropuerto Internacional El Dorado" }],
  },
  {
    city: "Cidade do México",
    country: "México",
    airports: [{ code: "MEX", name: "Aeropuerto Internacional Benito Juárez" }],
  },
  {
    city: "Toronto",
    country: "Canadá",
    airports: [{ code: "YYZ", name: "Toronto Pearson International Airport" }],
  },
  {
    city: "Dubai",
    country: "Emirados Árabes Unidos",
    airports: [{ code: "DXB", name: "Dubai International Airport" }],
  },
  {
    city: "Joanesburgo",
    country: "África do Sul",
    airports: [{ code: "JNB", name: "OR Tambo International Airport" }],
  },
  {
    city: "Abuja",
    country: "Nigéria",
    airports: [{ code: "ABV", name: "Nnamdi Azikiwe International Airport" }],
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

export interface PhoneCountry {
  name: string;
  iso2: string;
  dialCode: string;
}

export const COUNTRIES: PhoneCountry[] = [
  { name: "Brasil", iso2: "BR", dialCode: "55" },
  { name: "Estados Unidos", iso2: "US", dialCode: "1" },
  { name: "Argentina", iso2: "AR", dialCode: "54" },
  { name: "Portugal", iso2: "PT", dialCode: "351" },
  { name: "Reino Unido", iso2: "GB", dialCode: "44" },
  { name: "França", iso2: "FR", dialCode: "33" },
  { name: "Espanha", iso2: "ES", dialCode: "34" },
  { name: "Alemanha", iso2: "DE", dialCode: "49" },
  { name: "Japão", iso2: "JP", dialCode: "81" },
  { name: "Chile", iso2: "CL", dialCode: "56" },
  { name: "Colômbia", iso2: "CO", dialCode: "57" },
  { name: "México", iso2: "MX", dialCode: "52" },
  { name: "Canadá", iso2: "CA", dialCode: "1" },
  { name: "Emirados Árabes Unidos", iso2: "AE", dialCode: "971" },
  { name: "África do Sul", iso2: "ZA", dialCode: "27" },
  { name: "Nigéria", iso2: "NG", dialCode: "234" },
];

export function isInternational(iataCode: string): boolean {
  const normalizedCode = iataCode.trim().toUpperCase();
  for (const city of CITIES) {
    if (city.airports.some((airport) => airport.code === normalizedCode)) {
      return city.country !== "Brasil";
    }
  }
  return false;
}
