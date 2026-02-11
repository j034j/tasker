
// Context-Aware Auto-Tagging Engine
// Simulates "Word2Vec" associations using weighted keyword scoring and bigram detection.

type TagCategory = 'Farming' | 'Construction' | 'Mechanic' | 'Plumber' | 'Electrician' | 'Carpenter' | 'Cook' | 'Marketing' | 'Frontend' | 'Backend' | 'Design' | 'Urgent' | 'General';

interface KeywordRule {
    tag: TagCategory;
    score: number;
}

// Map of single keywords to tags
const KEYWORD_RULES: Record<string, KeywordRule[]> = {
    // Farming
    'farm': [{ tag: 'Farming', score: 1 }],
    'harvest': [{ tag: 'Farming', score: 2 }],
    'crop': [{ tag: 'Farming', score: 2 }],
    'tractor': [{ tag: 'Farming', score: 2 }, { tag: 'Mechanic', score: 0.5 }], // Tractors need mechanics too
    'seed': [{ tag: 'Farming', score: 1 }],
    'plant': [{ tag: 'Farming', score: 1 }],
    'irrigation': [{ tag: 'Farming', score: 2 }, { tag: 'Plumber', score: 1 }],
    'livestock': [{ tag: 'Farming', score: 2 }],
    'cow': [{ tag: 'Farming', score: 2 }],
    'chicken': [{ tag: 'Farming', score: 2 }],
    'field': [{ tag: 'Farming', score: 0.5 }], // Ambiguous

    // Construction - General
    'build': [{ tag: 'Construction', score: 1 }],
    'construct': [{ tag: 'Construction', score: 1 }],
    'site': [{ tag: 'Construction', score: 0.5 }],
    'cement': [{ tag: 'Construction', score: 2 }],
    'concrete': [{ tag: 'Construction', score: 2 }],
    'blueprint': [{ tag: 'Construction', score: 2 }],
    'foundation': [{ tag: 'Construction', score: 2 }],
    'roof': [{ tag: 'Construction', score: 1.5 }],

    // Carpenter
    'wood': [{ tag: 'Carpenter', score: 2 }],
    'lumber': [{ tag: 'Carpenter', score: 2 }],
    'saw': [{ tag: 'Carpenter', score: 1.5 }],
    'table': [{ tag: 'Carpenter', score: 1 }],
    'chair': [{ tag: 'Carpenter', score: 1 }],
    'cabinet': [{ tag: 'Carpenter', score: 2 }],
    'deck': [{ tag: 'Carpenter', score: 2 }],
    'frame': [{ tag: 'Carpenter', score: 1 }, { tag: 'Construction', score: 1 }],

    // Mechanic
    'car': [{ tag: 'Mechanic', score: 2 }],
    'truck': [{ tag: 'Mechanic', score: 2 }],
    'engine': [{ tag: 'Mechanic', score: 2 }],
    'motor': [{ tag: 'Mechanic', score: 2 }],
    'oil': [{ tag: 'Mechanic', score: 1.5 }, { tag: 'Cook', score: 0.5 }], // Context matters!
    'brake': [{ tag: 'Mechanic', score: 2 }],
    'transmission': [{ tag: 'Mechanic', score: 3 }],
    'tire': [{ tag: 'Mechanic', score: 2 }],
    'diesel': [{ tag: 'Mechanic', score: 2 }],

    // Plumber
    'pipe': [{ tag: 'Plumber', score: 2 }],
    'leak': [{ tag: 'Plumber', score: 2 }],
    'faucet': [{ tag: 'Plumber', score: 3 }],
    'sink': [{ tag: 'Plumber', score: 2 }],
    'toilet': [{ tag: 'Plumber', score: 3 }],
    'drain': [{ tag: 'Plumber', score: 2 }],
    'clog': [{ tag: 'Plumber', score: 2 }],
    'water': [{ tag: 'Plumber', score: 0.5 }, { tag: 'Farming', score: 0.5 }],

    // Electrician
    'wire': [{ tag: 'Electrician', score: 2 }],
    'electric': [{ tag: 'Electrician', score: 2 }],
    'light': [{ tag: 'Electrician', score: 1 }],
    'power': [{ tag: 'Electrician', score: 1 }],
    'circuit': [{ tag: 'Electrician', score: 2 }],
    'outlet': [{ tag: 'Electrician', score: 2 }],
    'volt': [{ tag: 'Electrician', score: 2 }],

    // Tech
    'react': [{ tag: 'Frontend', score: 3 }],
    'node': [{ tag: 'Backend', score: 3 }],
    'api': [{ tag: 'Backend', score: 2 }, { tag: 'Frontend', score: 1 }],
    'design': [{ tag: 'Design', score: 2 }],
    'css': [{ tag: 'Frontend', score: 3 }],
    'database': [{ tag: 'Backend', score: 3 }],

    // General
    'urgent': [{ tag: 'Urgent', score: 5 }],
    'asap': [{ tag: 'Urgent', score: 5 }],
    'fix': [{ tag: 'General', score: 0.1 }], // Too generic, barely counts
    'repair': [{ tag: 'General', score: 0.1 }],
};

// Bigram Rules - Logic for "Word2Vec" style context
// "word1 word2": [{ tag, score }]
const BIGRAM_RULES: Record<string, KeywordRule[]> = {
    // Context: Wood vs Mechanic
    'repair window': [{ tag: 'Carpenter', score: 4 }],
    'fix window': [{ tag: 'Carpenter', score: 3 }],
    'repair engine': [{ tag: 'Mechanic', score: 4 }],
    'fix engine': [{ tag: 'Mechanic', score: 3 }],
    'change oil': [{ tag: 'Mechanic', score: 3 }], // Not cooking oil
    'cooking oil': [{ tag: 'Cook', score: 3 }],

    // Context: Construction vs Tech
    'build site': [{ tag: 'Construction', score: 3 }],
    'build website': [{ tag: 'Frontend', score: 3 }],

    // Farming specific
    'harvest wheat': [{ tag: 'Farming', score: 3 }],
    'plant corn': [{ tag: 'Farming', score: 3 }],
    'feed animal': [{ tag: 'Farming', score: 3 }],
};

export const generateTags = (text: string): string[] => {
    const normalize = (str: string) => str.toLowerCase().replace(/[^\w\s]/g, '');
    const cleanText = normalize(text);
    const words = cleanText.split(/\s+/);

    // Score accumulator
    const scores: Record<string, number> = {};

    // 1. Check Bigrams (Context)
    for (let i = 0; i < words.length - 1; i++) {
        const bigram = `${words[i]} ${words[i + 1]}`;
        if (BIGRAM_RULES[bigram]) {
            BIGRAM_RULES[bigram].forEach(rule => {
                scores[rule.tag] = (scores[rule.tag] || 0) + rule.score;
            });
        }
    }

    // 2. Check Single Keywords
    words.forEach(word => {
        if (KEYWORD_RULES[word]) {
            KEYWORD_RULES[word].forEach(rule => {
                scores[rule.tag] = (scores[rule.tag] || 0) + rule.score;
            });
        }

        // Also check if the tag itself is mentioned
        const capitalizedWord = word.charAt(0).toUpperCase() + word.slice(1);
        // @ts-ignore
        if (['Farming', 'Construction', 'Mechanic', 'Plumber', 'Carpenter', 'Electrician', 'Frontend', 'Backend'].includes(capitalizedWord)) {
            // @ts-ignore
            scores[capitalizedWord] = (scores[capitalizedWord] || 0) + 3;
        }
    });

    // 3. Filter results
    const THRESHOLD = 1.0;
    return Object.entries(scores)
        .filter(([_, score]) => score >= THRESHOLD)
        .sort((a, b) => b[1] - a[1]) // Sort by score descending
        .map(([tag]) => tag)
        .slice(0, 5); // Start with top 5 max
};
