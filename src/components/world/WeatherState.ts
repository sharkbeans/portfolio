import { fetchPublicJson } from "../../services/api";

export type WeatherCondition = "clear" | "rain";
export type TimePeriod = "day" | "night";

export type WeatherSnapshot = {
  condition: WeatherCondition;
  period: TimePeriod;
};

// Georgetown, Penang.
const PENANG_LAT = 5.4164;
const PENANG_LON = 100.3327;

const CACHE_KEY = "world:weather-cache";
const CACHE_TTL_MS = 20 * 60 * 1000; // Penang conditions don't shift fast enough to justify polling more often
const FALLBACK: WeatherSnapshot = { condition: "clear", period: "day" };

type OpenMeteoResponse = {
  current: {
    precipitation: number;
    is_day: 0 | 1;
  };
};

type CacheEntry = {
  fetchedAt: number;
  snapshot: WeatherSnapshot;
};

function readCache(): WeatherSnapshot | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null;
    return entry.snapshot;
  } catch {
    return null;
  }
}

function writeCache(snapshot: WeatherSnapshot) {
  try {
    const entry: CacheEntry = { fetchedAt: Date.now(), snapshot };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Private-browsing/quota failures just mean the next load re-fetches — not worth surfacing.
  }
}

async function fetchLive(): Promise<WeatherSnapshot> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${PENANG_LAT}&longitude=${PENANG_LON}&current=precipitation,is_day`;
  const data = await fetchPublicJson<OpenMeteoResponse>(url);
  return {
    condition: data.current.precipitation > 0 ? "rain" : "clear",
    period: data.current.is_day === 1 ? "day" : "night",
  };
}

/**
 * Live Penang weather/time-of-day, used to pick which foot effect the player
 * kicks up as they walk. Fetch failures fall back to the clear/day default
 * silently — this is a decorative detail, so an error state would draw more
 * attention than just not showing rain.
 */
export class WeatherState {
  #snapshot: WeatherSnapshot = FALLBACK;
  #debugOverride: Partial<WeatherSnapshot> | null = null;

  async load() {
    const cached = readCache();
    if (cached) {
      this.#snapshot = cached;
      return;
    }
    try {
      this.#snapshot = await fetchLive();
      writeCache(this.#snapshot);
    } catch {
      this.#snapshot = FALLBACK;
    }
  }

  get(): WeatherSnapshot {
    return { ...this.#snapshot, ...this.#debugOverride };
  }

  /** Dev-only debug hook — merges into any existing override, or clears it when passed `null`. */
  setDebugOverride(partial: Partial<WeatherSnapshot> | null) {
    this.#debugOverride = partial ? { ...this.#debugOverride, ...partial } : null;
  }

  getDebugOverride() {
    return this.#debugOverride;
  }
}
