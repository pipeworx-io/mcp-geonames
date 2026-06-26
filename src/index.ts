interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * GeoNames MCP — GeoNames geographical database API
 *
 * BYO key: requires a free GeoNames username from https://www.geonames.org/login
 * Passed via _apiKey parameter (used as the "username" parameter).
 *
 * Tools:
 * - search_geonames: search for places by name with optional country filter
 * - get_nearby: find nearby places given lat/lng coordinates
 * - get_timezone: get timezone info for a lat/lng location
 * - find_postal_codes: postal/ZIP code <-> place lookup
 */


// HTTP, not HTTPS — api.geonames.org's HTTPS cert is permanently broken
// (CN=tile.immofacts.ch, expired Oct 2021). CF rejects every upstream
// request with 526 "Invalid SSL Certificate"; production analytics
// showed 51/51 = 100% error rate over 24h until this switch. GeoNames
// has never shipped a working public HTTPS cert and the username is
// already passed in the URL, so plaintext changes nothing about the
// secrecy model.
const BASE_URL = 'http://api.geonames.org';

// --- Helpers ---

function extractKey(args: Record<string, unknown>): string {
  const key = args._apiKey as string;
  delete args._apiKey;
  if (!key) throw new Error('GeoNames username required. Register free at https://www.geonames.org/login and pass via _apiKey.');
  return key;
}

// --- Raw API types ---

type RawGeoname = {
  geonameId?: number | null;
  name?: string | null;
  toponymName?: string | null;
  countryCode?: string | null;
  countryName?: string | null;
  adminName1?: string | null;
  adminCode1?: string | null;
  lat?: string | null;
  lng?: string | null;
  population?: number | null;
  fclName?: string | null;
  fcodeName?: string | null;
  distance?: string | null;
};

type SearchResponse = {
  totalResultsCount?: number | null;
  geonames?: RawGeoname[];
};

type TimezoneResponse = {
  timezoneId?: string | null;
  gmtOffset?: number | null;
  rawOffset?: number | null;
  dstOffset?: number | null;
  time?: string | null;
  sunrise?: string | null;
  sunset?: string | null;
  countryCode?: string | null;
  countryName?: string | null;
  lat?: number | null;
  lng?: number | null;
};

// --- Formatters ---

function formatPlace(g: RawGeoname) {
  return {
    geoname_id: g.geonameId ?? null,
    name: g.name ?? null,
    toponym_name: g.toponymName ?? null,
    country_code: g.countryCode ?? null,
    country_name: g.countryName ?? null,
    admin_region: g.adminName1 ?? null,
    admin_code: g.adminCode1 ?? null,
    latitude: g.lat ? parseFloat(g.lat) : null,
    longitude: g.lng ? parseFloat(g.lng) : null,
    population: g.population ?? null,
    feature_class: g.fclName ?? null,
    feature_code: g.fcodeName ?? null,
    distance_km: g.distance ? parseFloat(g.distance) : undefined,
  };
}

// --- Tool definitions ---

const tools: McpToolExport['tools'] = [
  {
    name: 'search_geonames',
    description:
      'Search for places (cities, landmarks, regions) by name. Returns coordinates, country, population, and feature type. Example: search_geonames("Paris", "FR"). Use get_nearby to find places near a known location.',
    inputSchema: {
      type: 'object',
      properties: {
        _apiKey: { type: 'string', description: 'GeoNames username' },
        query: { type: 'string', description: 'Place name to search for (e.g., "Tokyo", "Grand Canyon")' },
        country: { type: 'string', description: 'ISO 3166-1 alpha-2 country code to filter (e.g., "US", "JP")' },
        limit: { type: 'number', description: 'Number of results (default: 10, max: 100)' },
      },
      required: ['_apiKey', 'query'],
    },
  },
  {
    name: 'get_nearby',
    description:
      'Find places near a given latitude/longitude. Returns nearby cities, landmarks, and features sorted by distance. Example: get_nearby(48.8566, 2.3522) for places near Paris.',
    inputSchema: {
      type: 'object',
      properties: {
        _apiKey: { type: 'string', description: 'GeoNames username' },
        lat: { type: 'number', description: 'Latitude (e.g., 48.8566)' },
        lng: { type: 'number', description: 'Longitude (e.g., 2.3522)' },
        radius: { type: 'number', description: 'Search radius in km (default: 10, max: 300)' },
      },
      required: ['_apiKey', 'lat', 'lng'],
    },
  },
  {
    name: 'get_timezone',
    description:
      'Get timezone information for a latitude/longitude location. Returns timezone ID, GMT offset, DST offset, current local time, sunrise, and sunset. Example: get_timezone(40.7128, -74.0060) for New York.',
    inputSchema: {
      type: 'object',
      properties: {
        _apiKey: { type: 'string', description: 'GeoNames username' },
        lat: { type: 'number', description: 'Latitude (e.g., 40.7128)' },
        lng: { type: 'number', description: 'Longitude (e.g., -74.0060)' },
      },
      required: ['_apiKey', 'lat', 'lng'],
    },
  },
  {
    name: 'find_postal_codes',
    description:
      'Look up postal/ZIP codes and places by each other. Pass "postal_code" (+ country) to find the place(s) a code maps to ("what city is ZIP 90210"); or pass "place" (+ country) to find the postal codes for a place name ("postal codes for Paris"). Returns place name, country, admin region (state/county), postal code, and coordinates.',
    inputSchema: {
      type: 'object',
      properties: {
        _apiKey: { type: 'string', description: 'GeoNames username' },
        postal_code: { type: 'string', description: 'Postal/ZIP code to look up (e.g. "90210", "75001"). Provide country for accuracy.' },
        place: { type: 'string', description: 'Place name to find postal codes for (e.g. "Paris", "Springfield"). Use instead of postal_code.' },
        country: { type: 'string', description: 'ISO 3166-1 alpha-2 country code (e.g. "US", "FR"). Strongly recommended — codes and place names repeat across countries.' },
        limit: { type: 'number', description: 'Max results (default 10, max 100).' },
      },
      required: ['_apiKey'],
    },
  },
];

// --- callTool dispatcher ---

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const username = extractKey(args);

  switch (name) {
    case 'search_geonames':
      return searchPlaces(username, args.query as string, args.country as string | undefined, (args.limit as number) ?? 10);
    case 'get_nearby':
      return getNearby(username, args.lat as number, args.lng as number, (args.radius as number) ?? 10);
    case 'get_timezone':
      return getTimezone(username, args.lat as number, args.lng as number);
    case 'find_postal_codes':
      return findPostalCodes(
        username,
        args.postal_code as string | undefined,
        args.place as string | undefined,
        args.country as string | undefined,
        (args.limit as number) ?? 10,
      );
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// --- Tool implementations ---

async function searchPlaces(username: string, query: string, country?: string, limit?: number) {
  const count = Math.min(Math.max(1, limit ?? 10), 100);
  const params = new URLSearchParams({
    q: query,
    maxRows: String(count),
    username,
    type: 'json',
  });
  if (country) params.set('country', country.toUpperCase());

  const res = await fetch(`${BASE_URL}/searchJSON?${params}`);
  if (!res.ok) throw new Error(`GeoNames API error: ${res.status}`);

  const data = (await res.json()) as SearchResponse;

  // GeoNames returns errors in the response body
  if ((data as unknown as { status?: { message?: string } }).status?.message) {
    throw new Error(`GeoNames error: ${(data as unknown as { status: { message: string } }).status.message}`);
  }

  return {
    query,
    country: country?.toUpperCase() ?? null,
    total: data.totalResultsCount ?? 0,
    returned: (data.geonames ?? []).length,
    places: (data.geonames ?? []).map(formatPlace),
  };
}

async function getNearby(username: string, lat: number, lng: number, radius?: number) {
  const r = Math.min(Math.max(1, radius ?? 10), 300);
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radius: String(r),
    maxRows: '20',
    username,
    type: 'json',
  });

  const res = await fetch(`${BASE_URL}/findNearbyJSON?${params}`);
  if (!res.ok) throw new Error(`GeoNames API error: ${res.status}`);

  const data = (await res.json()) as { geonames?: RawGeoname[] };

  if ((data as unknown as { status?: { message?: string } }).status?.message) {
    throw new Error(`GeoNames error: ${(data as unknown as { status: { message: string } }).status.message}`);
  }

  return {
    latitude: lat,
    longitude: lng,
    radius_km: r,
    count: (data.geonames ?? []).length,
    nearby: (data.geonames ?? []).map(formatPlace),
  };
}

async function getTimezone(username: string, lat: number, lng: number) {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    username,
    type: 'json',
  });

  const res = await fetch(`${BASE_URL}/timezoneJSON?${params}`);
  if (!res.ok) throw new Error(`GeoNames API error: ${res.status}`);

  const data = (await res.json()) as TimezoneResponse;

  if ((data as unknown as { status?: { message?: string } }).status?.message) {
    throw new Error(`GeoNames error: ${(data as unknown as { status: { message: string } }).status.message}`);
  }

  return {
    timezone_id: data.timezoneId ?? null,
    gmt_offset: data.gmtOffset ?? null,
    raw_offset: data.rawOffset ?? null,
    dst_offset: data.dstOffset ?? null,
    current_time: data.time ?? null,
    sunrise: data.sunrise ?? null,
    sunset: data.sunset ?? null,
    country_code: data.countryCode ?? null,
    country_name: data.countryName ?? null,
    latitude: data.lat ?? lat,
    longitude: data.lng ?? lng,
  };
}

type RawPostal = {
  postalcode?: string | null;
  postalCode?: string | null; // postalCodeSearchJSON uses camelCase; lookup uses lowercase
  placeName?: string | null;
  countryCode?: string | null;
  adminName1?: string | null;
  adminCode1?: string | null;
  adminName2?: string | null;
  adminName3?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
};

function num(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  return typeof v === 'number' ? v : parseFloat(v);
}

function formatPostal(p: RawPostal) {
  return {
    postal_code: p.postalcode ?? p.postalCode ?? null,
    place_name: p.placeName ?? null,
    country_code: p.countryCode ?? null,
    admin1: p.adminName1 ?? null,
    admin1_code: p.adminCode1 ?? null,
    admin2: p.adminName2 ?? null,
    admin3: p.adminName3 ?? null,
    latitude: num(p.lat),
    longitude: num(p.lng),
  };
}

async function findPostalCodes(
  username: string,
  postalCode: string | undefined,
  place: string | undefined,
  country: string | undefined,
  limit: number,
) {
  const count = Math.min(Math.max(1, limit ?? 10), 100);
  const params = new URLSearchParams({ username, maxRows: String(count) });
  if (country) params.set('country', country.toUpperCase());

  let endpoint: string;
  let mode: string;
  if (postalCode && postalCode.trim()) {
    params.set('postalcode', postalCode.trim());
    endpoint = 'postalCodeLookupJSON';
    mode = 'lookup'; // postal code -> places
  } else if (place && place.trim()) {
    params.set('placename', place.trim());
    endpoint = 'postalCodeSearchJSON';
    mode = 'search'; // place name -> postal codes
  } else {
    throw new Error(
      'Provide either "postal_code" (to find the places a code maps to) or "place" (to find postal codes for a place name).',
    );
  }

  const res = await fetch(`${BASE_URL}/${endpoint}?${params}`);
  if (!res.ok) throw new Error(`GeoNames API error: ${res.status}`);

  // postalCodeLookupJSON returns `postalcodes`; postalCodeSearchJSON returns `postalCodes`.
  const data = (await res.json()) as {
    postalcodes?: RawPostal[];
    postalCodes?: RawPostal[];
    status?: { message?: string };
  };
  if (data.status?.message) throw new Error(`GeoNames error: ${data.status.message}`);

  const list = data.postalcodes ?? data.postalCodes ?? [];
  return {
    mode,
    postal_code: postalCode?.trim() ?? null,
    place: place?.trim() ?? null,
    country: country?.toUpperCase() ?? null,
    count: list.length,
    results: list.map(formatPostal),
  };
}

export default { tools, callTool, meter: { credits: 5 } } satisfies McpToolExport;
