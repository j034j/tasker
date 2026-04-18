import { useStore } from '@/lib/store';
import { type RankingWeights } from '@/lib/rankingEngine';
import { useLanguage } from '@/contexts/LanguageContext';

export function RankingConfigPanel() {
    const { rankingWeights, setRankingWeights, board, currentUser } = useStore();
    const { t } = useLanguage();

    // Use a slightly different state for safe fallback if no board/user loaded yet
    // If we assume admin if creator is null (legacy boards), we can do:
    // const canEdit = !board?.created_by || board.created_by === currentUser?.id;
    // But user asked for "ONLY Creator has access", so:
    const canEdit = board && currentUser && board.created_by === currentUser.id;

    const handleWeightChange = (key: keyof RankingWeights, value: number) => {
        if (!canEdit) return; // double safety
        setRankingWeights({
            ...rankingWeights,
            [key]: value
        });
    };

    return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    🎛️ Ranking Configuration
                </h3>
                {/* The reset button is removed in the new code */}
                {/* <button
                    onClick={handleReset}
                    className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 underline"
                >
                    Reset Defaults
                </button> */}
            </div>

            {/* The entire content of the panel is replaced with the new structure */}
            <div className="space-y-6">
                <div>
                    <h3 className="text-lg font-bold mb-1">🎯 {t('algo_config')}</h3>
                    <p className="text-xs text-muted-foreground">
                        {t('algo_desc')}
                    </p>
                    {!canEdit && (
                        <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 text-xs rounded border border-yellow-200 dark:border-yellow-800">
                            🔒 Only the Board Creator can adjust urgency weights.
                        </div>
                    )}
                </div>

                <div className={`space-y-5 ${!canEdit ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-semibold flex items-center gap-2">
                                📅 {t('w_due_date')}
                            </label>
                            <span className="text-xs font-mono bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-zinc-600 dark:text-zinc-400">{rankingWeights.timeFactorWeight}</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="5"
                            step="0.1"
                            value={rankingWeights.timeFactorWeight}
                            onChange={(e) => handleWeightChange('timeFactorWeight', Number(e.target.value))}
                            disabled={!canEdit}
                            className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                    </div>

                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-semibold flex items-center gap-2">
                                ⛈️ {t('w_weather')}
                            </label>
                            <span className="text-xs font-mono bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-zinc-600 dark:text-zinc-400">{rankingWeights.weatherIndexWeight}</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="5"
                            step="0.1"
                            value={rankingWeights.weatherIndexWeight}
                            onChange={(e) => handleWeightChange('weatherIndexWeight', Number(e.target.value))}
                            disabled={!canEdit}
                            className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                    </div>

                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-semibold flex items-center gap-2">
                                💰 {t('w_funding')}
                            </label>
                            <span className="text-xs font-mono bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-zinc-600 dark:text-zinc-400">{rankingWeights.fundingFactorWeight}</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="5"
                            step="0.1"
                            value={rankingWeights.fundingFactorWeight}
                            onChange={(e) => handleWeightChange('fundingFactorWeight', Number(e.target.value))}
                            disabled={!canEdit}
                            className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                    </div>

                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-semibold flex items-center gap-2">
                                🛠️ {t('w_skills')}
                            </label>
                            <span className="text-xs font-mono bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-zinc-600 dark:text-zinc-400">{rankingWeights.skillAvailabilityWeight}</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="5"
                            step="0.1"
                            value={rankingWeights.skillAvailabilityWeight}
                            onChange={(e) => handleWeightChange('skillAvailabilityWeight', Number(e.target.value))}
                            disabled={!canEdit}
                            className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                    </div>
                </div>

                <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Ranking Simulation</h4>
                    <div className="bg-zinc-100 dark:bg-zinc-800 p-3 rounded text-xs space-y-1 text-zinc-600 dark:text-zinc-400">
                        <p>Current Algorithm:</p>
                        <code className="block bg-black/5 p-1 rounded font-mono mt-1 text-[10px]">
                            Score = ({rankingWeights.timeFactorWeight} * due) + ({rankingWeights.weatherIndexWeight} * weather) + ...
                        </code>
                    </div>
                </div>
            </div>
        </div>
    );
}
