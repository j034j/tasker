
import type { Task } from './store';

export interface RankingWeights {
    urgencyWeight: number;
    timeFactorWeight: number;
    weatherIndexWeight: number;
    fundingFactorWeight: number;
    skillAvailabilityWeight: number;
}

export const DEFAULT_WEIGHTS: RankingWeights = {
    urgencyWeight: 1.5,
    timeFactorWeight: 1.2,
    weatherIndexWeight: 1.0,
    fundingFactorWeight: 0.8,
    skillAvailabilityWeight: 0.8,
};

export const calculateTimeFactor = (dueDate?: string): number => {
    if (!dueDate) return 0;
    const now = new Date().getTime();
    const due = new Date(dueDate).getTime();

    // Calculate difference in days
    const diffDays = (due - now) / (1000 * 60 * 60 * 24);

    if (diffDays < 0) return 100; // Overdue is max priority
    if (diffDays <= 1) return 100; // Due within 24h
    if (diffDays <= 3) return 90; // Due within 3 days
    if (diffDays <= 7) return 60; // Due within a week

    // Linearly decay from 50 to 0 over 30 days
    return Math.max(0, 50 - ((diffDays - 7) * 2));
};

export const calculateTaskScore = (task: Task, _weights: RankingWeights): number => { // eslint-disable-line @typescript-eslint/no-unused-vars -- API compatibility
    const baseUrgency = task.urgency;
    const overrideUrgency = task.admin_override_urgency;
    const overridePriority = Math.max(0, Math.min(100, Number(task.admin_override_priority || 0)));

    // Subjective org-level override is intentionally supreme.
    // Urgency override alone is enough to jump above objective-ranked tasks.
    if (overrideUrgency !== null && overrideUrgency !== undefined) {
        return 10000 + (Math.max(0, Math.min(100, Number(overrideUrgency))) * 100);
    }

    // Backward compatibility for tasks that only used legacy priority boost.
    if (overridePriority > 0) {
        return 10000 + (overridePriority * 100) + baseUrgency;
    }

    return baseUrgency;
};

/**
 * Calculates a unified Urgency/Priority Score (0-100) based on all factors.
 */
export interface UrgencyFactors {
    title?: string;
    description?: string;
    dueDate?: string;
    fundingNeeded?: number; // Raw $
    peopleRequired?: number; // Count
    skills?: string; // Comma separated
    weatherSensitive?: boolean;
    weatherImpact?: number; // 0-100 from weather.ts
    projectSeason?: 'Spring' | 'Summer' | 'Autumn' | 'Winter';
    currentSeason?: 'Spring' | 'Summer' | 'Autumn' | 'Winter';
}

export const calculateUrgency = (factors: UrgencyFactors): number => {
    // 1. Time Factor (Dominant - 35%)
    const timeScore = calculateTimeFactor(factors.dueDate);

    // 2. Financial Factor (Lower Weight - 10%)
    const money = factors.fundingNeeded || 0;
    const financialScore = Math.min(100, (money / 5000) * 100);

    // 3. People Factor (Lower Weight - 10%)
    const people = factors.peopleRequired || 1;
    const peopleScore = Math.min(100, ((people - 1) / 9) * 100);

    // 4. Skills Analysis & Critical Keywords (20%)
    const skillList = factors.skills ? factors.skills.toLowerCase().split(',').map(s => s.trim()) : [];
    const skillsScore = Math.min(100, (skillList.length / 5) * 100);

    // "Trump" Keywords
    const criticalKeywords = ['repair', 'farming', 'farm', 'harvest', 'fix', 'emergency', 'leak', 'broken', 'maintenance'];
    const hasCriticalKeyword = skillList.some(s => criticalKeywords.some(k => s.includes(k)));
    const criticalScore = hasCriticalKeyword ? 100 : 0;
    const recurringDutyKeywords = [
        'daily',
        'weekly',
        'routine',
        'recurring',
        'milk',
        'feeding',
        'feed',
        'open shop',
        'store opening',
        'nursery shop',
        'livestock',
        'barn',
        'cleaning round'
    ];
    const textBlob = `${factors.title || ''} ${factors.description || ''} ${factors.skills || ''}`.toLowerCase();
    const recurringDutyScore = recurringDutyKeywords.some((token) => textBlob.includes(token)) ? 100 : 0;

    // 5. Weather Factor (25%)
    let weatherScore = factors.weatherSensitive ? (factors.weatherImpact || 0) : 0;

    // Season Alignment Boost
    if (factors.weatherSensitive && factors.projectSeason && factors.currentSeason) {
        if (factors.projectSeason === factors.currentSeason) {
            weatherScore = Math.min(100, weatherScore + 40);
        }
    }

    // --- CRITICAL OVERRIDES TRUMP LOGIC ---
    // If it's a critical task (Repair/Farming) AND Weather Sensitive, it trumps Funding
    if (hasCriticalKeyword && factors.weatherSensitive) {
        weatherScore = 100;
    }

    // Weighted Sum 
    const weighted = (
        (timeScore * 0.35) +
        (weatherScore * 0.25) +
        (criticalScore * 0.20) +
        (recurringDutyScore * 0.05) +
        (financialScore * 0.10) +
        (peopleScore * 0.10) +
        (skillsScore * 0.05)
    );

    // --- FINAL STRICT OVERRIDES ---
    let finalScore = weighted;

    // 1. IMMINENT DEADLINES TRUMP FUNDING
    // "No matter the funding amounts"
    if (timeScore >= 90) {
        finalScore = Math.max(95, finalScore);
    }

    // 2. WEATHER SENSITIVITY TRUMPS FUNDING/SKILLS
    // "Always adjust... to give greater weight... no matter funding/skills"
    if (factors.weatherSensitive) {
        if (hasCriticalKeyword) {
            finalScore = Math.max(98, finalScore); // Critical + Weather = Max
        } else {
            finalScore = Math.max(88, finalScore); // Just Weather = High
        }
    }
    // 3. Critical Keyword alone
    else if (hasCriticalKeyword) {
        finalScore = Math.max(80, finalScore);
    }
    if (recurringDutyScore > 0) {
        finalScore = Math.max(85, finalScore + 8);
    }

    return Math.min(100, Math.round(finalScore));
};
