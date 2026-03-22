import { Request, Response, NextFunction } from "express";
import { prisma } from "../index";
import { createError } from "../middleware/errorHandler";

// Open-Meteo geocoding: zip → lat/lon (US zip codes)
// Uses Open-Meteo's free geocoding API
async function zipToCoords(zip: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(zip)}&count=1&language=en&format=json`
    );
    const data: any = await res.json();
    if (data.results && data.results.length > 0) {
      return { lat: data.results[0].latitude, lon: data.results[0].longitude };
    }
    return null;
  } catch {
    return null;
  }
}

// Weather code descriptions
function weatherCodeToDescription(code: number): string {
  const map: Record<number, string> = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Foggy", 48: "Depositing rime fog",
    51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
    61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
    66: "Light freezing rain", 67: "Heavy freezing rain",
    71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
    77: "Snow grains", 80: "Slight rain showers", 81: "Moderate rain showers",
    82: "Violent rain showers", 85: "Slight snow showers", 86: "Heavy snow showers",
    95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail",
  };
  return map[code] ?? "Unknown";
}

export async function getWeather(req: Request, res: Response, next: NextFunction) {
  try {
    const { zip, days } = req.query;
    if (!zip) return next(createError("zip query parameter is required", 400));

    const zipCode = String(zip);
    const forecastDays = Math.min(parseInt(String(days ?? "7"), 10), 14);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check cache first
    const cached = await prisma.weatherCache.findMany({
      where: {
        zipCode,
        forecastDate: { gte: today },
        fetchedAt: { gte: new Date(Date.now() - 3 * 60 * 60 * 1000) }, // 3 hour TTL
      },
      orderBy: { forecastDate: "asc" },
      take: forecastDays,
    });

    if (cached.length >= forecastDays) {
      return res.json({
        zipCode,
        days: cached.map((c) => {
          const d = c.data as any;
          return { date: c.forecastDate.toISOString().split("T")[0], ...d };
        }),
        fetchedAt: cached[0].fetchedAt.toISOString(),
      });
    }

    // Geocode zip to lat/lon
    const coords = await zipToCoords(zipCode);
    if (!coords) return next(createError("Could not geocode zip code", 400));

    // Fetch from Open-Meteo
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_days=${forecastDays}`;

    const weatherRes = await fetch(url);
    if (!weatherRes.ok) return next(createError("Weather API request failed", 502));

    const weatherData: any = await weatherRes.json();
    const daily = weatherData.daily;

    if (!daily || !daily.time) return next(createError("Invalid weather response", 502));

    // Parse and cache
    const days_out: any[] = [];
    const now = new Date();

    for (let i = 0; i < daily.time.length; i++) {
      const dayData = {
        tempHighF: daily.temperature_2m_max[i],
        tempLowF: daily.temperature_2m_min[i],
        precipMm: daily.precipitation_sum[i],
        windMph: daily.wind_speed_10m_max[i],
        weatherCode: daily.weather_code[i],
        description: weatherCodeToDescription(daily.weather_code[i]),
      };

      // Upsert cache
      const forecastDate = new Date(daily.time[i] + "T00:00:00.000Z");
      await prisma.weatherCache.upsert({
        where: { zipCode_forecastDate: { zipCode, forecastDate } },
        update: { data: dayData, fetchedAt: now },
        create: { zipCode, forecastDate, data: dayData, fetchedAt: now },
      });

      days_out.push({ date: daily.time[i], ...dayData });
    }

    res.json({
      zipCode,
      days: days_out,
      fetchedAt: now.toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function checkScheduleWeather(req: Request, res: Response, next: NextFunction) {
  try {
    const { start, end } = req.query;
    if (!start || !end) return next(createError("start and end query parameters required", 400));

    const startDate = new Date(String(start));
    const endDate = new Date(String(end));

    // Get jobs in date range with their properties
    const jobs = await prisma.job.findMany({
      where: {
        status: { in: ["SCHEDULED", "PENDING"] },
        scheduledStart: { gte: startDate, lte: endDate },
      },
      include: {
        property: true,
        client: { select: { firstName: true, lastName: true } },
      },
    });

    if (jobs.length === 0) {
      return res.json({ alerts: [] });
    }

    // Collect unique zip codes from job properties
    const zipCodes = [...new Set(jobs.filter((j) => j.property?.zip).map((j) => j.property!.zip))];

    // Fetch weather for each zip code
    const weatherByZip: Record<string, Record<string, any>> = {};
    for (const zip of zipCodes) {
      const cached = await prisma.weatherCache.findMany({
        where: {
          zipCode: zip,
          forecastDate: { gte: startDate, lte: endDate },
        },
      });

      weatherByZip[zip] = {};
      for (const entry of cached) {
        const dateKey = entry.forecastDate.toISOString().split("T")[0];
        weatherByZip[zip][dateKey] = entry.data;
      }
    }

    // Generate alerts
    const alerts: any[] = [];
    for (const job of jobs) {
      if (!job.scheduledStart || !job.property?.zip) continue;

      const dateKey = job.scheduledStart.toISOString().split("T")[0];
      const weather = weatherByZip[job.property.zip]?.[dateKey];
      if (!weather) continue;

      const w = weather as any;

      // Rain alert: > 5mm precipitation
      if (w.precipMm > 5) {
        alerts.push({
          jobId: job.id,
          jobTitle: job.title,
          date: dateKey,
          issue: `Rain expected (${w.precipMm.toFixed(1)}mm) — ${w.description}`,
          severity: w.precipMm > 15 ? "high" : "medium",
        });
      }

      // High wind alert: > 25 mph
      if (w.windMph > 25) {
        alerts.push({
          jobId: job.id,
          jobTitle: job.title,
          date: dateKey,
          issue: `High winds (${w.windMph.toFixed(0)} mph) — unsafe for chemical applications`,
          severity: w.windMph > 40 ? "high" : "medium",
        });
      }

      // Freeze alert: low temp < 32°F
      if (w.tempLowF < 32) {
        alerts.push({
          jobId: job.id,
          jobTitle: job.title,
          date: dateKey,
          issue: `Freeze warning (low ${w.tempLowF.toFixed(0)}°F) — reschedule irrigation/planting`,
          severity: "high",
        });
      }

      // Extreme heat: high > 100°F
      if (w.tempHighF > 100) {
        alerts.push({
          jobId: job.id,
          jobTitle: job.title,
          date: dateKey,
          issue: `Extreme heat (${w.tempHighF.toFixed(0)}°F) — avoid midday chemical applications`,
          severity: "medium",
        });
      }
    }

    res.json({ alerts });
  } catch (err) {
    next(err);
  }
}
