
interface Task {
    urgency: number; // 0-100
    due_date?: string | null;
    weather_sensitive: number; // 0 or 1 (boolean in sqlite)
    funding_needed: number;
}

// Weights (configurable per org in future)
const WEIGHTS = {
    URGENCY: 1.5,
    DEADLINE: 2.0,
    WEATHER: 50, // Impact score deduction
    FUNDING: 0.5,
};

// Simulated Service
const getWeatherCondition = () => {
    // Randomly return 'clear', 'rain', 'storm'
    const conditions = ['clear', 'rain', 'storm'];
    return conditions[Math.floor(Math.random() * conditions.length)];
};

export const calculatePriority = (task: Task): number => {
    let score = 0;

    // 1. Urgency Base
    score += task.urgency * WEIGHTS.URGENCY;

    // 2. Deadline Proximity
    if (task.due_date) {
        const now = new Date().getTime();
        const due = new Date(task.due_date).getTime();
        const hoursRemaining = (due - now) / (1000 * 60 * 60);

        if (hoursRemaining < 0) score += 200; // Overdue!
        else if (hoursRemaining < 24) score += 100; // Due today
        else if (hoursRemaining < 72) score += 50; // Due in 3 days
        else score += Math.max(0, 100 - hoursRemaining); // Decaying score
    }

    // 3. Weather Impact
    const weather = getWeatherCondition();
    if (task.weather_sensitive && (weather === 'rain' || weather === 'storm')) {
        // If it's raining and task is sensitive, maybe we CAN'T do it, so priority drops?
        // Or it becomes urgent? Let's assume "Feasibility" logic: 
        // If sensitive to weather and weather is bad, Rank drops (blocked).
        score -= WEIGHTS.WEATHER;
    }

    // 4. Funding (Higher funding need might lower priority if budget tight, 
    // or higher priority if we want to spend? Let's assume higher need = lower priority for now)
    // score -= task.funding_needed * WEIGHTS.FUNDING;

    return Math.max(0, Math.floor(score));
};
