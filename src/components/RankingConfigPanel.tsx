import { useStore } from '@/lib/store';
import { DEFAULT_WEIGHTS, type RankingWeights } from '@/lib/rankingEngine';

export function RankingConfigPanel() {
    const { rankingWeights, setRankingWeights } = useStore();

    const handleWeightChange = (key: keyof RankingWeights, value: number) => {
        setRankingWeights({
            ...rankingWeights,
            [key]: value,
        });
    };

    const handleReset = () => {
        setRankingWeights(DEFAULT_WEIGHTS);
    };

    return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    🎛️ Ranking Configuration
                </h3>
                <button
                    onClick={handleReset}
                    className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 underline"
                >
                    Reset Defaults
                </button>
            </div>

            <div className="space-y-6">
                <WeightSlider
                    label="🔥 Urgency Weight"
                    value={rankingWeights.urgencyWeight}
                    onChange={(v) => handleWeightChange('urgencyWeight', v)}
                    color="text-red-500"
                />
                <WeightSlider
                    label="⏳ Time Factor Weight"
                    value={rankingWeights.timeFactorWeight}
                    onChange={(v) => handleWeightChange('timeFactorWeight', v)}
                    color="text-orange-500"
                />
                <WeightSlider
                    label="⛈️ Weather Index Weight"
                    value={rankingWeights.weatherIndexWeight}
                    onChange={(v) => handleWeightChange('weatherIndexWeight', v)}
                    color="text-blue-500"
                />
                <WeightSlider
                    label="💰 Funding Factor Weight"
                    value={rankingWeights.fundingFactorWeight}
                    onChange={(v) => handleWeightChange('fundingFactorWeight', v)}
                    color="text-green-500"
                />
                <WeightSlider
                    label="👥 Labor Availability Weight"
                    value={rankingWeights.skillAvailabilityWeight}
                    onChange={(v) => handleWeightChange('skillAvailabilityWeight', v)}
                    color="text-indigo-500"
                />
            </div>
        </div>
    );
}

function WeightSlider({
    label,
    value,
    onChange,
    color
}: {
    label: string;
    value: number;
    onChange: (val: number) => void;
    color: string;
}) {
    return (
        <div>
            <div className="flex justify-between text-sm mb-2">
                <span className={`font-semibold ${color}`}>{label}</span>
                <span className="font-mono text-zinc-600 dark:text-zinc-400">{value.toFixed(1)}x</span>
            </div>
            <input
                type="range"
                min="0"
                max="5"
                step="0.1"
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-zinc-900 dark:accent-zinc-100"
            />
        </div>
    );
}
