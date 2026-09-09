import { getMeta, setMeta } from './db.js';

// Open-Meteo: free, no API key, CORS-enabled — safe to call directly from
// the browser with no backend involved. https://open-meteo.com
const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

// Maps Open-Meteo's numeric weather codes to a short label + our icon
// name. Full code list: https://open-meteo.com/en/docs — this covers the
// common ones; anything unmapped falls back to a generic label.
const WEATHER_CODES = {
  0: { label: 'Clear sky', icon: 'sun' },
  1: { label: 'Mostly clear', icon: 'sun' },
  2: { label: 'Partly cloudy', icon: 'cloud-sun' },
  3: { label: 'Overcast', icon: 'cloud' },
  45: { label: 'Fog', icon: 'cloud-fog' },
  48: { label: 'Fog', icon: 'cloud-fog' },
  51: { label: 'Light drizzle', icon: 'cloud-drizzle' },
  53: { label: 'Drizzle', icon: 'cloud-drizzle' },
  55: { label: 'Heavy drizzle', icon: 'cloud-drizzle' },
  61: { label: 'Light rain', icon: 'cloud-rain' },
  63: { label: 'Rain', icon: 'cloud-rain' },
  65: { label: 'Heavy rain', icon: 'cloud-rain' },
  71: { label: 'Light snow', icon: 'cloud-snow' },
  73: { label: 'Snow', icon: 'cloud-snow' },
  75: { label: 'Heavy snow', icon: 'cloud-snow' },
  80: { label: 'Rain showers', icon: 'cloud-rain' },
  81: { label: 'Rain showers', icon: 'cloud-rain' },
  82: { label: 'Violent showers', icon: 'cloud-rain' },
  95: { label: 'Thunderstorm', icon: 'cloud-lightning' },
  96: { label: 'Thunderstorm + hail', icon: 'cloud-lightning' },
  99: { label: 'Thunderstorm + hail', icon: 'cloud-lightning' },
};

export function describeWeatherCode(code) {
  return WEATHER_CODES[code] || { label: 'Unknown', icon: 'cloud' };
}

export function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => reject(err),
      { timeout: 10000, maximumAge: 60 * 60 * 1000 } // ok to reuse a fix from up to an hour ago
    );
  });
}

async function fetchForecast(latitude, longitude) {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
    current: 'temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code',
    timezone: 'auto',
    forecast_days: '5',
  });
  const res = await fetch(`${BASE_URL}?${params}`);
  if (!res.ok) throw new Error(`Weather request failed (${res.status})`);
  return res.json();
}

/**
 * Returns the freshest weather we can: fetches live if online and a
 * location is available, otherwise falls back to whatever was last
 * cached. Never throws — offline or a failed fetch just means the
 * caller gets cached data (or null if there's never been any).
 */
export async function getWeather() {
  const cached = await getMeta('weather_cache');

  if (!navigator.onLine) {
    return cached ? { ...cached, stale: true } : null;
  }

  try {
    const location = await getLocation();
    const data = await fetchForecast(location.latitude, location.longitude);
    const fresh = {
      location,
      fetchedAt: new Date().toISOString(),
      current: data.current,
      daily: data.daily,
    };
    await setMeta('weather_cache', fresh);
    return { ...fresh, stale: false };
  } catch (err) {
    // No location permission, no signal, API hiccup — whatever the
    // reason, fall back to cache rather than showing an error.
    return cached ? { ...cached, stale: true } : null;
  }
}
