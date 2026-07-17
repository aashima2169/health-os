// lib/weather.ts
// Environmental evidence for Signals — humidity, temperature, air quality.
// Open-Meteo: free, no API key, generous limits for this usage volume.
// Entirely optional evidence — if geocoding fails, city isn't set, or a
// date range has no historical data available, callers get an empty
// result rather than an error; Signals already treats everything here
// (like photos, domain_reads) as optional.
import { getProfile, upsertProfile } from './db'

interface DailyWeather {
  tempMaxC: number | null
  humidityPct: number | null
}

interface DailyAirQuality {
  usAqi: number | null
  pm25: number | null
}

export interface DailyEnvironment extends DailyWeather, DailyAirQuality {}

// Geocodes profile.city once and caches the result on the profile row —
// Signals shouldn't re-geocode on every run.
export async function getProfileCoords(): Promise<{ lat: number; lon: number } | null> {
  const profile = await getProfile()
  if (!profile?.city) return null
  if (profile.lat != null && profile.lon != null) return { lat: profile.lat, lon: profile.lon }

  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(profile.city)}&count=1&language=en&format=json`
    )
    if (!res.ok) return null
    const data = await res.json()
    const result = data.results?.[0]
    if (!result) return null

    const coords = { lat: result.latitude, lon: result.longitude }
    upsertProfile({ lat: coords.lat, lon: coords.lon }).catch((err) =>
      console.error('[weather] failed to cache geocoded coords:', err),
    )
    return coords
  } catch (err) {
    console.error('[weather] geocoding failed:', err)
    return null
  }
}

async function getHistoricalWeather(
  lat: number, lon: number, startDate: string, endDate: string,
): Promise<Record<string, DailyWeather>> {
  try {
    const res = await fetch(
      `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
      `&start_date=${startDate}&end_date=${endDate}` +
      `&daily=temperature_2m_max,relative_humidity_2m_max&timezone=auto`
    )
    if (!res.ok) return {}
    const data = await res.json()
    const dates: string[] = data.daily?.time ?? []
    const temps: (number | null)[] = data.daily?.temperature_2m_max ?? []
    const humidity: (number | null)[] = data.daily?.relative_humidity_2m_max ?? []

    const byDate: Record<string, DailyWeather> = {}
    dates.forEach((date, i) => {
      byDate[date] = { tempMaxC: temps[i] ?? null, humidityPct: humidity[i] ?? null }
    })
    return byDate
  } catch (err) {
    console.error('[weather] historical weather fetch failed:', err)
    return {}
  }
}

// Air quality history is hourly, not daily — averaged per date here since
// flare windows reason in whole days. Historical AQI coverage is shorter
// than the weather archive's, so older dates may simply come back empty;
// that's expected, not an error.
async function getHistoricalAirQuality(
  lat: number, lon: number, startDate: string, endDate: string,
): Promise<Record<string, DailyAirQuality>> {
  try {
    const res = await fetch(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
      `&start_date=${startDate}&end_date=${endDate}` +
      `&hourly=us_aqi,pm2_5&timezone=auto`
    )
    if (!res.ok) return {}
    const data = await res.json()
    const times: string[] = data.hourly?.time ?? []
    const aqi: (number | null)[] = data.hourly?.us_aqi ?? []
    const pm25: (number | null)[] = data.hourly?.pm2_5 ?? []

    const sums: Record<string, { aqiSum: number; aqiCount: number; pmSum: number; pmCount: number }> = {}
    times.forEach((time, i) => {
      const date = time.slice(0, 10)
      sums[date] ??= { aqiSum: 0, aqiCount: 0, pmSum: 0, pmCount: 0 }
      if (aqi[i] != null) { sums[date].aqiSum += aqi[i]!; sums[date].aqiCount++ }
      if (pm25[i] != null) { sums[date].pmSum += pm25[i]!; sums[date].pmCount++ }
    })

    const byDate: Record<string, DailyAirQuality> = {}
    for (const [date, s] of Object.entries(sums)) {
      byDate[date] = {
        usAqi: s.aqiCount > 0 ? Math.round(s.aqiSum / s.aqiCount) : null,
        pm25: s.pmCount > 0 ? Math.round((s.pmSum / s.pmCount) * 10) / 10 : null,
      }
    }
    return byDate
  } catch (err) {
    console.error('[weather] historical air quality fetch failed:', err)
    return {}
  }
}

// Combines weather + air quality for a date range, keyed by date ('' if
// profile.city isn't set or geocoding fails — treated as optional evidence
// everywhere this is consumed).
export async function getEnvironmentByDate(startDate: string, endDate: string): Promise<Record<string, DailyEnvironment>> {
  const coords = await getProfileCoords()
  if (!coords) return {}

  const [weather, airQuality] = await Promise.all([
    getHistoricalWeather(coords.lat, coords.lon, startDate, endDate),
    getHistoricalAirQuality(coords.lat, coords.lon, startDate, endDate),
  ])

  const dates = new Set([...Object.keys(weather), ...Object.keys(airQuality)])
  const combined: Record<string, DailyEnvironment> = {}
  dates.forEach((date) => {
    combined[date] = {
      tempMaxC: weather[date]?.tempMaxC ?? null,
      humidityPct: weather[date]?.humidityPct ?? null,
      usAqi: airQuality[date]?.usAqi ?? null,
      pm25: airQuality[date]?.pm25 ?? null,
    }
  })
  return combined
}
