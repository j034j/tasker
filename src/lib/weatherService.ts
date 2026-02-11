
export interface WeatherData {
    temperature: number;
    isRaining: boolean;
    isSnowing: boolean;
    conditionCode: number;
    season: 'Spring' | 'Summer' | 'Autumn' | 'Winter';
}

export interface GeoLocation {
    name: string;
    latitude: number;
    longitude: number;
    country: string;
}

/**
 * Geocoding: Convert city name to Lat/Long
 */
export const getCoordinates = async (locationName: string): Promise<GeoLocation | null> => {
    try {
        const response = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationName)}&count=1&language=en&format=json`
        );
        const data = await response.json();
        if (data.results && data.results.length > 0) {
            return {
                name: data.results[0].name,
                latitude: data.results[0].latitude,
                longitude: data.results[0].longitude,
                country: data.results[0].country
            };
        }
        return null;
    } catch (e) {
        console.error("Geocoding failed", e);
        return null;
    }
};

/**
 * Fetch Weather from Open-Meteo
 */
export const fetchWeather = async (lat: number, lon: number): Promise<WeatherData> => {
    try {
        const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,rain,showers,snowfall&timezone=auto`
        );
        const data = await response.json();
        const current = data.current;

        const code = current.weather_code;
        // Rain codes: 51-67, 80-82, 95-99
        const isRaining = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95);
        // Snow codes: 71-77, 85-86
        const isSnowing = (code >= 71 && code <= 77) || (code >= 85 && code <= 86);

        // Season Detection (Northern Hemisphere simple)
        const month = new Date().getMonth(); // 0-11
        let season: WeatherData['season'] = 'Winter';
        if (month >= 2 && month <= 4) season = 'Spring';
        else if (month >= 5 && month <= 7) season = 'Summer';
        else if (month >= 8 && month <= 10) season = 'Autumn';

        return {
            temperature: current.temperature_2m,
            isRaining,
            isSnowing,
            conditionCode: code,
            season
        };
    } catch (e) {
        console.error("Failed to fetch weather", e);
        // Fallback
        return {
            temperature: 20,
            isRaining: false,
            isSnowing: false,
            conditionCode: 0,
            season: 'Spring'
        };
    }
};

export const getWeatherImpact = (weather: WeatherData): number => {
    let impact = 0;

    // Base Seasonal Impact (e.g. Winter is harder for construction)
    if (weather.season === 'Winter') impact += 20;
    if (weather.season === 'Autumn') impact += 10;

    // Active Weather Impact
    if (weather.isRaining) impact += 50;
    if (weather.isSnowing) impact += 80; // High impact!
    if (weather.temperature < 0) impact += 30; // Freezing
    if (weather.temperature > 35) impact += 20; // Heatwave

    return Math.min(100, impact);
};

export const getWeatherIcon = (code: number): string => {
    // WMO Weather interpretation codes (WW)
    // Code 0: Clear sky
    if (code === 0) return '☀️'; // Clear
    // Code 1, 2, 3: Mainly clear, partly cloudy, and overcast
    if (code >= 1 && code <= 3) return 'cloud-sun'; // Partly Cloudy (using string for Lucide if needed, or emoji) -> '⛅'
    // Let's use Emojis for simplicity in text, or specific Lucide icon names if checking in component
    // User asked "appropriate weather icon". Lucide icons are cleaner.
    // Let's return Lucide icon names and handle them in the component?
    // Or just simple Emojis? "show besides the name...". Emojis are easiest and colorful.

    if (code === 0) return '☀️';
    if (code === 1) return '🌤️';
    if (code === 2) return 'partly cloundy'; // Wait, standard emojis: ⛅
    if (code === 2) return '⛅';
    if (code === 3) return '☁️'; // Overcast

    // Fog
    if (code >= 45 && code <= 48) return '🌫️';

    // Drizzle
    if (code >= 51 && code <= 55) return 'bf-cloud-rain'; // 🌧️
    if (code >= 56 && code <= 57) return 'freezing-rain'; // 🥶🌧️

    // Rain
    if (code >= 61 && code <= 65) return '🌧️';
    if (code >= 66 && code <= 67) return '❄️🌧️'; // Freezing Rain

    // Snow
    if (code >= 71 && code <= 77) return '🌨️';

    // Rain showers
    if (code >= 80 && code <= 82) return '🌦️';

    // Snow showers
    if (code >= 85 && code <= 86) return '🌨️';

    // Thunderstorm
    if (code >= 95 && code <= 99) return '⛈️';

    return '❓';
};
