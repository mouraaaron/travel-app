export interface Airport {
  code: string;
  name: string;
  lat: number;
  lng: number;
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
  lat: number;
  lng: number;
}

const CITIES: City[] = [
  {
    city: "São Paulo",
    country: "Brasil",
    airports: [
      { code: "GRU", name: "Aeroporto Internacional de Guarulhos", lat: -23.4356, lng: -46.4731 },
      { code: "CGH", name: "Aeroporto de Congonhas", lat: -23.6261, lng: -46.6564 },
    ],
  },
  {
    city: "Rio de Janeiro",
    country: "Brasil",
    airports: [
      { code: "GIG", name: "Aeroporto Internacional do Galeão", lat: -22.8099, lng: -43.2506 },
      { code: "SDU", name: "Aeroporto Santos Dumont", lat: -22.9105, lng: -43.1631 },
    ],
  },
  {
    city: "Brasília",
    country: "Brasil",
    airports: [{ code: "BSB", name: "Aeroporto Internacional de Brasília", lat: -15.8697, lng: -47.9208 }],
  },
  {
    city: "Salvador",
    country: "Brasil",
    airports: [{ code: "SSA", name: "Aeroporto Internacional de Salvador", lat: -12.9086, lng: -38.3225 }],
  },
  {
    city: "Curitiba",
    country: "Brasil",
    airports: [{ code: "CWB", name: "Aeroporto Internacional Afonso Pena", lat: -25.5285, lng: -49.1758 }],
  },
  {
    city: "Nova York",
    country: "Estados Unidos",
    airports: [
      { code: "JFK", name: "John F. Kennedy International Airport", lat: 40.6413, lng: -73.7781 },
      { code: "LGA", name: "LaGuardia Airport", lat: 40.7769, lng: -73.874 },
    ],
  },
  {
    city: "Miami",
    country: "Estados Unidos",
    airports: [{ code: "MIA", name: "Miami International Airport", lat: 25.7959, lng: -80.287 }],
  },
  {
    city: "Buenos Aires",
    country: "Argentina",
    airports: [
      { code: "EZE", name: "Aeroporto Internacional Ministro Pistarini", lat: -34.8222, lng: -58.5358 },
      { code: "AEP", name: "Aeroparque Jorge Newbery", lat: -34.5592, lng: -58.4156 },
    ],
  },
  {
    city: "Lisboa",
    country: "Portugal",
    airports: [{ code: "LIS", name: "Aeroporto Humberto Delgado", lat: 38.7813, lng: -9.1359 }],
  },
  {
    city: "Confins",
    country: "Brasil",
    airports: [{ code: "CNF", name: "Aeroporto Internacional de Confins", lat: -19.6336, lng: -43.9686 }],
  },
  {
    city: "Porto Alegre",
    country: "Brasil",
    airports: [{ code: "POA", name: "Aeroporto Internacional Salgado Filho", lat: -29.9939, lng: -51.1711 }],
  },
  {
    city: "Recife",
    country: "Brasil",
    airports: [{ code: "REC", name: "Aeroporto Internacional dos Guararapes", lat: -8.1264, lng: -34.9236 }],
  },
  {
    city: "Fortaleza",
    country: "Brasil",
    airports: [{ code: "FOR", name: "Aeroporto Internacional Pinto Martins", lat: -3.7763, lng: -38.5326 }],
  },
  {
    city: "Manaus",
    country: "Brasil",
    airports: [{ code: "MAO", name: "Aeroporto Internacional Eduardo Gomes", lat: -3.0386, lng: -60.0497 }],
  },
  {
    city: "Belo Horizonte",
    country: "Brasil",
    airports: [{ code: "PLU", name: "Aeroporto da Pampulha", lat: -19.8512, lng: -43.9506 }],
  },
  {
    city: "Londres",
    country: "Reino Unido",
    airports: [
      { code: "LHR", name: "Heathrow Airport", lat: 51.47, lng: -0.4543 },
      { code: "LGW", name: "Gatwick Airport", lat: 51.1537, lng: -0.1821 },
    ],
  },
  {
    city: "Paris",
    country: "França",
    airports: [{ code: "CDG", name: "Aéroport Charles de Gaulle", lat: 49.0097, lng: 2.5479 }],
  },
  {
    city: "Madri",
    country: "Espanha",
    airports: [{ code: "MAD", name: "Aeropuerto Adolfo Suárez Madrid-Barajas", lat: 40.4936, lng: -3.5668 }],
  },
  {
    city: "Frankfurt",
    country: "Alemanha",
    airports: [{ code: "FRA", name: "Frankfurt Airport", lat: 50.0379, lng: 8.5622 }],
  },
  {
    city: "Tóquio",
    country: "Japão",
    airports: [{ code: "NRT", name: "Narita International Airport", lat: 35.772, lng: 140.3929 }],
  },
  {
    city: "Santiago",
    country: "Chile",
    airports: [{ code: "SCL", name: "Aeropuerto Internacional Arturo Merino Benítez", lat: -33.393, lng: -70.7858 }],
  },
  {
    city: "Bogotá",
    country: "Colômbia",
    airports: [{ code: "BOG", name: "Aeropuerto Internacional El Dorado", lat: 4.7016, lng: -74.1469 }],
  },
  {
    city: "Cidade do México",
    country: "México",
    airports: [{ code: "MEX", name: "Aeropuerto Internacional Benito Juárez", lat: 19.4363, lng: -99.0721 }],
  },
  {
    city: "Toronto",
    country: "Canadá",
    airports: [{ code: "YYZ", name: "Toronto Pearson International Airport", lat: 43.6777, lng: -79.6248 }],
  },
  {
    city: "Dubai",
    country: "Emirados Árabes Unidos",
    airports: [{ code: "DXB", name: "Dubai International Airport", lat: 25.2532, lng: 55.3657 }],
  },
  {
    city: "Joanesburgo",
    country: "África do Sul",
    airports: [{ code: "JNB", name: "OR Tambo International Airport", lat: -26.1392, lng: 28.246 }],
  },
  {
    city: "Abuja",
    country: "Nigéria",
    airports: [{ code: "ABV", name: "Nnamdi Azikiwe International Airport", lat: 9.0068, lng: 7.2632 }],
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
          lat: airport.lat,
          lng: airport.lng,
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
          lat: airport.lat,
          lng: airport.lng,
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

export function isInternationalRoute(originCode: string, destinationCode: string): boolean {
  return isInternational(originCode) || isInternational(destinationCode);
}
