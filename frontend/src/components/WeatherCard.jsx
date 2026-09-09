import React, { useEffect, useState, useCallback } from 'react';
import { Sun, CloudSun, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudSnow, CloudLightning, MapPin, RefreshCw } from 'lucide-react';
import { getWeather, describeWeatherCode } from '../weather.js';

const ICONS = {
  sun: Sun, 'cloud-sun': CloudSun, cloud: Cloud, 'cloud-fog': CloudFog,
  'cloud-drizzle': CloudDrizzle, 'cloud-rain': CloudRain, 'cloud-snow': CloudSnow, 'cloud-lightning': CloudLightning,
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function WeatherCard() {
  const [weather, setWeather] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ok | denied | empty
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await getWeather();
      setWeather(result);
      setStatus(result ? 'ok' : 'empty');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (status === 'loading') {
    return (
      <div className="bg-white rounded-lg border border-border p-3 text-[12px] text-muted">
        Loading weather…
      </div>
    );
  }

  if (status === 'empty') {
    return (
      <div className="bg-white rounded-lg border border-border p-3">
        <div className="flex items-center gap-1.5 text-[12px] text-muted mb-2">
          <MapPin size={12} /> No weather yet — allow location access once while online to fetch it.
        </div>
        <button onClick={load} disabled={refreshing} className="text-[11px] text-teal font-medium">
          {refreshing ? 'Trying…' : 'Try again'}
        </button>
      </div>
    );
  }

  const { current, daily, fetchedAt, stale } = weather;
  const CurrentIcon = ICONS[describeWeatherCode(current.weather_code).icon];

  return (
    <div className="bg-white rounded-lg border border-border p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-muted uppercase tracking-wide">
          Weather {stale ? '· cached' : ''}
        </span>
        <button onClick={load} disabled={refreshing} className="text-muted">
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <CurrentIcon size={32} className="text-forest flex-shrink-0" />
        <div>
          <div className="font-serif text-2xl text-ink">{Math.round(current.temperature_2m)}°C</div>
          <div className="text-[12px] text-muted">{describeWeatherCode(current.weather_code).label}</div>
        </div>
      </div>

      {daily?.time && (
        <div className="flex justify-between mt-3 pt-3 border-t border-parchment">
          {daily.time.map((date, i) => {
            const DayIcon = ICONS[describeWeatherCode(daily.weather_code[i]).icon];
            const dayName = i === 0 ? 'Today' : DAY_NAMES[new Date(date).getDay()];
            return (
              <div key={date} className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted">{dayName}</span>
                <DayIcon size={14} className="text-forest" />
                <span className="text-[10px] text-ink">{Math.round(daily.temperature_2m_max[i])}°</span>
                <span className="text-[10px] text-muted">{Math.round(daily.temperature_2m_min[i])}°</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="text-[10px] text-muted mt-2">Updated {timeAgo(fetchedAt)}</div>
    </div>
  );
}
