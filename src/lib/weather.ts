export interface WeatherData {
    temperature: number;
    isRaining: boolean;
    isSnowing: boolean;
    conditionCode: number;
    season: 'Spring' | 'Summer' | 'Autumn' | 'Winter';
}

export const fetchWeather = async (lat = 51.5074, lon = -0.1278): Promise<WeatherData> => {
    try {
        // OpenMeteo Free API
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
            temperature: 15,
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

    return Math.min(100, impact);
};
