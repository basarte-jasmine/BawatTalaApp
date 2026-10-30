import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";

export type WeatherCondition = {
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  category: "clear" | "clouds" | "rain" | "snow" | "thunder";
  gentleNote: string;
};

export type HourlyForecastItem = {
  formattedTime: string;
  isoTime: string;
  temperature: number;
  weatherCode: number;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
  rainProbability?: number;
};

export type WeatherData = {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  windSpeed: number;
  precipitation: number;
  weatherCode: number;
  isDay: boolean;
  condition: WeatherCondition;
  dailyHigh: number;
  dailyLow: number;
  dailyWeatherCodes: number[];
  hourly: HourlyForecastItem[];
  cityName: string;
  regionName: string;
  locationLabel: string;
  latitude: number;
  longitude: number;
  fetchedAt: number;
};

export function getWeatherCondition(code: number, isDay: boolean = true): WeatherCondition {
  switch (code) {
    case 0:
      return {
        description: isDay ? "Clear sky" : "Clear night",
        icon: isDay ? "sunny" : "moon",
        category: "clear",
        gentleNote: isDay
          ? "Bright and clear — a great moment to take a mindful breath."
          : "Quiet, clear skies tonight — time to unwind and reflect.",
      };
    case 1:
      return {
        description: isDay ? "Mainly clear" : "Partly clear",
        icon: isDay ? "partly-sunny" : "cloudy-night",
        category: "clear",
        gentleNote: "Pleasant weather outside. Savor this peaceful moment.",
      };
    case 2:
      return {
        description: "Partly cloudy",
        icon: isDay ? "partly-sunny" : "cloudy-night",
        category: "clouds",
        gentleNote: "Soft clouds drifting by — pause and check in with yourself.",
      };
    case 3:
      return {
        description: "Overcast",
        icon: "cloudy",
        category: "clouds",
        gentleNote: "Calm, muted skies. A cozy atmosphere to write in your journal.",
      };
    case 45:
    case 48:
      return {
        description: "Foggy",
        icon: "cloudy-outline",
        category: "clouds",
        gentleNote: "Misty and still outside. Take it slow and stay grounded.",
      };
    case 51:
      return {
        description: "Light drizzle",
        icon: "rainy-outline",
        category: "rain",
        gentleNote: "A soothing gentle drizzle. A comforting backdrop for your thoughts.",
      };
    case 53:
      return {
        description: "Drizzle",
        icon: "rainy-outline",
        category: "rain",
        gentleNote: "Light rain falling — stay comfortable and take care of yourself.",
      };
    case 55:
      return {
        description: "Dense drizzle",
        icon: "rainy",
        category: "rain",
        gentleNote: "Steady soft rain outside. A good time for a warm drink.",
      };
    case 56:
    case 57:
      return {
        description: "Freezing drizzle",
        icon: "snow-outline",
        category: "snow",
        gentleNote: "Chilly outside. Keep warm and stay safe.",
      };
    case 61:
      return {
        description: "Slight rain",
        icon: "rainy-outline",
        category: "rain",
        gentleNote: "Gentle rain is falling. Let the sound wash away today's stress.",
      };
    case 63:
      return {
        description: "Moderate rain",
        icon: "rainy",
        category: "rain",
        gentleNote: "Rainy outside — stay dry and cozy indoors.",
      };
    case 65:
      return {
        description: "Heavy rain",
        icon: "rainy",
        category: "rain",
        gentleNote: "Heavy rain falling. Stay sheltered and safe wherever you are.",
      };
    case 66:
    case 67:
      return {
        description: "Freezing rain",
        icon: "snow-outline",
        category: "snow",
        gentleNote: "Cold and icy. Stay cozy and warm inside.",
      };
    case 71:
    case 73:
    case 75:
      return {
        description: "Snow fall",
        icon: "snow",
        category: "snow",
        gentleNote: "Quiet snowflakes falling. Wrap up warm.",
      };
    case 77:
      return {
        description: "Snow grains",
        icon: "snow",
        category: "snow",
        gentleNote: "Cold and brisk outside. Stay bundled up.",
      };
    case 80:
    case 81:
    case 82:
      return {
        description: "Rain showers",
        icon: "rainy",
        category: "rain",
        gentleNote: "Passing rain showers — take comfort in your own space.",
      };
    case 85:
    case 86:
      return {
        description: "Snow showers",
        icon: "snow",
        category: "snow",
        gentleNote: "Chilly winter showers. Stay safe and warm.",
      };
    case 95:
      return {
        description: "Thunderstorm",
        icon: "thunderstorm",
        category: "thunder",
        gentleNote: "Thunder rumbling outside. Rest safely indoors.",
      };
    case 96:
    case 99:
      return {
        description: "Thunderstorm with hail",
        icon: "thunderstorm",
        category: "thunder",
        gentleNote: "Stormy weather. Stay safe and grounded inside.",
      };
    default:
      if (code >= 51 && code <= 67) {
        return {
          description: "Rain",
          icon: "rainy",
          category: "rain",
          gentleNote: "Rainy day — a peaceful time to write and reflect.",
        };
      }
      return {
        description: isDay ? "Fair" : "Fair night",
        icon: isDay ? "partly-sunny" : "moon",
        category: "clear",
        gentleNote: "A gentle moment in your day. Take a deep breath.",
      };
  }
}

export function formatHourlyDisplayTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
      const parts = isoString.split("T")[1]?.split(":") || [];
      const hour = parseInt(parts[0], 10);
      if (Number.isNaN(hour)) return isoString;
      const ampm = hour >= 12 ? "PM" : "AM";
      const h12 = hour % 12 === 0 ? 12 : hour % 12;
      return `${h12} ${ampm}`;
    }
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

/**
 * Resolves the real city and region names using a multi-strategy approach:
 * 1. Native Location.reverseGeocodeAsync (expo-location)
 * 2. BigDataCloud reverse geocode client API (fast, free, accurate for PH and worldwide)
 * 3. OpenStreetMap Nominatim
 */
export async function resolveUserLocationName(
  latitude: number,
  longitude: number
): Promise<{ cityName: string; regionName: string; locationLabel: string }> {
  // Strategy 1: Try native Android reverse geocode via expo-location
  try {
    const geocodes = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (geocodes && geocodes.length > 0) {
      const first = geocodes[0];
      let rawCity = first.city || first.subregion || first.district || first.name || "";
      let rawRegion = first.region || first.subregion || first.country || "";

      let cleanCity = rawCity.replace(/^City of\s+/i, "").replace(/\s+City$/i, "").trim();

      if (cleanCity && !/^Your Location$/i.test(cleanCity)) {
        let cleanRegion = rawRegion.replace(/^Province of\s+/i, "").trim();
        if (cleanRegion === cleanCity) cleanRegion = first.country || "";

        return {
          cityName: cleanCity,
          regionName: cleanRegion || "Philippines",
          locationLabel: cleanRegion ? `${cleanCity}, ${cleanRegion}` : cleanCity,
        };
      }
    }
  } catch {
    // Continue to web fallback
  }

  // Strategy 2: BigDataCloud client reverse geocoding
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      let city = data.locality || data.city || "";
      let region = data.principalSubdivision || "";

      city = city.replace(/^City of\s+/i, "").replace(/\s+City$/i, "").trim();
      if (city) {
        return {
          cityName: city,
          regionName: region || "Philippines",
          locationLabel: region ? `${city}, ${region}` : city,
        };
      }
    }
  } catch {
    // Continue to next fallback
  }

  // Strategy 3: OpenStreetMap Nominatim
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "BawatTalaApp/2.0" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      let city = addr.city || addr.town || addr.municipality || addr.city_district || addr.county || "";
      let region = addr.state || addr.region || addr.province || "";

      city = city.replace(/^City of\s+/i, "").replace(/\s+City$/i, "").trim();
      if (city) {
        return {
          cityName: city,
          regionName: region || "Philippines",
          locationLabel: region ? `${city}, ${region}` : city,
        };
      }
    }
  } catch {
    // Fall through
  }

  // Last-resort fallback: Detect timezone to give a meaningful local designation
  let fallbackRegion = "Philippines";
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (tz.includes("Manila")) {
      return {
        cityName: "Metro Manila",
        regionName: "Philippines",
        locationLabel: "Metro Manila, Philippines",
      };
    }
  } catch {}

  return {
    cityName: "Current Location",
    regionName: fallbackRegion,
    locationLabel: "Current Location",
  };
}

export function buildOpenMeteoUrl(latitude: number, longitude: number): string {
  let timezone = "Asia/Manila";
  try {
    const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detectedTz && typeof detectedTz === "string") {
      timezone = detectedTz;
    }
  } catch {
    timezone = "Asia/Manila";
  }

  const lat = latitude.toFixed(4);
  const lon = longitude.toFixed(4);
  return `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=${encodeURIComponent(timezone)}`;
}

export async function fetchOpenMeteoWeather(
  latitude: number,
  longitude: number,
  locationInfo?: { cityName: string; regionName: string; locationLabel: string }
): Promise<WeatherData> {
  const url = buildOpenMeteoUrl(latitude, longitude);
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Weather request failed with status ${response.status}`);
  }

  const data = await response.json();

  if (!data || !data.current) {
    throw new Error("Invalid weather response from provider");
  }

  const current = data.current;
  const temp = Math.round(Number(current.temperature_2m));
  const apparentTemp = Math.round(Number(current.apparent_temperature ?? current.temperature_2m));
  const humidity = Math.round(Number(current.relative_humidity_2m));
  const windSpeed = Math.round(Number(current.wind_speed_10m ?? 0));
  const precipitation = Number(current.precipitation ?? 0);
  const isDay = current.is_day !== undefined ? Boolean(current.is_day) : true;
  const weatherCode = Number(current.weather_code ?? 0);
  const condition = getWeatherCondition(weatherCode, isDay);

  // Daily High / Low
  let dailyHigh = temp;
  let dailyLow = temp;
  if (data.daily && Array.isArray(data.daily.temperature_2m_max) && data.daily.temperature_2m_max.length > 0) {
    dailyHigh = Math.round(Number(data.daily.temperature_2m_max[0]));
  }

  const dailyWeatherCodes =
    data.daily && Array.isArray(data.daily.weather_code)
      ? data.daily.weather_code.map((code: unknown) => Number(code))
      : [];
  if (data.daily && Array.isArray(data.daily.temperature_2m_min) && data.daily.temperature_2m_min.length > 0) {
    dailyLow = Math.round(Number(data.daily.temperature_2m_min[0]));
  }

  // Hourly slots
  const hourlyList: HourlyForecastItem[] = [];
  if (data.hourly && Array.isArray(data.hourly.time) && Array.isArray(data.hourly.temperature_2m)) {
    const times: string[] = data.hourly.time;
    const temps: number[] = data.hourly.temperature_2m;
    const codes: number[] = data.hourly.weather_code ?? [];
    const pops: number[] = data.hourly.precipitation_probability ?? [];

    const nowIso = current.time || new Date().toISOString();
    let startIndex = times.findIndex((t) => t >= nowIso.slice(0, 13));
    if (startIndex < 0) startIndex = 0;

    const sliceCount = 6;
    for (let i = startIndex; i < Math.min(times.length, startIndex + sliceCount); i++) {
      const hTime = times[i];
      const hTemp = Math.round(Number(temps[i]));
      const hCode = Number(codes[i] ?? 0);
      const hPop = pops[i] !== undefined ? Math.round(Number(pops[i])) : undefined;
      const hCond = getWeatherCondition(hCode, isDay);
      hourlyList.push({
        isoTime: hTime,
        formattedTime: i === startIndex ? "Now" : formatHourlyDisplayTime(hTime),
        temperature: hTemp,
        weatherCode: hCode,
        icon: hCond.icon,
        description: hCond.description,
        rainProbability: hPop,
      });
    }
  }

  const resolvedLoc = locationInfo || {
    cityName: "Your Location",
    regionName: "Philippines",
    locationLabel: "Your Location",
  };

  return {
    temperature: temp,
    apparentTemperature: apparentTemp,
    humidity,
    windSpeed,
    precipitation,
    weatherCode,
    isDay,
    condition,
    dailyHigh,
    dailyLow,
    dailyWeatherCodes,
    hourly: hourlyList,
    cityName: resolvedLoc.cityName,
    regionName: resolvedLoc.regionName,
    locationLabel: resolvedLoc.locationLabel,
    latitude,
    longitude,
    fetchedAt: Date.now(),
  };
}
