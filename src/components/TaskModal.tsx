import { useState, useEffect } from 'react';
import { Tag } from 'lucide-react';
import { api } from '@/lib/axios';
import { useStore } from '@/lib/store';
import { useLanguage } from '@/contexts/LanguageContext';
import { DraggableModalWrapper } from './ui/DraggableModalWrapper';

interface Task {
    id: string;
    title: string;
    description?: string;
    urgency: number;
    due_date?: string;
    weather_sensitive?: boolean;
    funding_needed?: number;
    people_required?: number;
    skills?: string;
    weather_index?: number;
    funding_factor?: number;
    skill_availability?: number;
    season?: 'Spring' | 'Summer' | 'Autumn' | 'Winter';
    project_duration?: string;
    project_location?: string;
    weather_code?: number;
    admin_override_urgency?: number | null;
    admin_override_priority?: number;
}

interface TaskModalProps {
    task?: Task | null; // If null, we are creating
    columnId?: string; // Required if creating
    onClose: () => void;
    onSave: () => void;
}

interface TaskOverrideHistoryEntry {
    id: string;
    previous_admin_override_urgency: number | null;
    new_admin_override_urgency: number | null;
    previous_admin_override_priority: number;
    new_admin_override_priority: number;
    changed_by_name?: string | null;
    changed_at: string;
}

export function TaskModal({ task, columnId, onClose, onSave }: TaskModalProps) {
    const { weatherImpact, fetchWeatherImpact, currentSeason, currentUser } = useStore();
    const { t } = useLanguage();

    // Form State
    const [title, setTitle] = useState(task?.title || '');
    const [description, setDescription] = useState(task?.description || '');
    const [urgency, setUrgency] = useState(task?.urgency || 50);
    const [dueDate, setDueDate] = useState(task?.due_date || '');
    const [weatherSensitive, setWeatherSensitive] = useState(task?.weather_sensitive || false);
    const [fundingNeeded, setFundingNeeded] = useState(task?.funding_needed || 0);
    const [peopleRequired, setPeopleRequired] = useState(task?.people_required || 1);
    const [skills, setSkills] = useState(task?.skills || '');
    const [season, setSeason] = useState(task?.season || '');
    const [projectDuration, setProjectDuration] = useState(task?.project_duration || '');
    const [projectLocation, setProjectLocation] = useState(task?.project_location || '');
    const [localWeatherImpact, setLocalWeatherImpact] = useState<number | null>(null);
    const [weatherCode, setWeatherCode] = useState<number | undefined>(task?.weather_code);
    const [adminOverrideUrgency, setAdminOverrideUrgency] = useState<number | null>(
        task?.admin_override_urgency !== undefined ? task.admin_override_urgency : null
    );
    const canOverrideRanking = currentUser?.role === 'org_super_admin' || currentUser?.role === 'super_admin';
    const [overrideHistory, setOverrideHistory] = useState<TaskOverrideHistoryEntry[]>([]);
    const [overrideHistoryLoading, setOverrideHistoryLoading] = useState(false);
    const [overrideHistoryError, setOverrideHistoryError] = useState<string | null>(null);

    const [saving, setSaving] = useState(false);

    useEffect(() => {
        // Fetch global weather impact when modal opens if no location set
        if (!projectLocation) {
            fetchWeatherImpact();
        } else {
            // Trigger local check if location exists
            handleLocationBlur();
        }
    }, []);

    useEffect(() => {
        if (!task?.id || !canOverrideRanking) return;
        const fetchOverrideHistory = async () => {
            setOverrideHistoryLoading(true);
            setOverrideHistoryError(null);
            try {
                const { data } = await api.get(`/tasks/${task.id}/override-history?limit=12`);
                setOverrideHistory(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error('Failed to load task override history', err);
                setOverrideHistoryError('Failed to load override history');
                setOverrideHistory([]);
            } finally {
                setOverrideHistoryLoading(false);
            }
        };
        fetchOverrideHistory();
    }, [task?.id, canOverrideRanking]);

    // Auto-Calculate Urgency based on factors
    useEffect(() => {
        const runCalculation = async () => {
            const { calculateUrgency } = await import('@/lib/rankingEngine');

            const score = calculateUrgency({
                title,
                description,
                dueDate,
                fundingNeeded,
                peopleRequired,
                skills,
                weatherSensitive,
                weatherImpact: localWeatherImpact !== null ? localWeatherImpact : weatherImpact,
                projectSeason: (season && ['Winter', 'Spring', 'Summer', 'Autumn'].includes(season) ? season : undefined) as 'Winter' | 'Spring' | 'Summer' | 'Autumn' | undefined,
                currentSeason
            });

            setUrgency(score);
        };
        runCalculation();
    }, [title, description, dueDate, fundingNeeded, peopleRequired, weatherSensitive, weatherImpact, localWeatherImpact, skills, season, currentSeason]);

    const handleLocationBlur = async () => {
        if (!projectLocation) return;
        const { getCoordinates, fetchWeather, getWeatherImpact } = await import('@/lib/weatherService');
        const coords = await getCoordinates(projectLocation);
        if (coords) {
            // Update location name to be pretty (Optional, maybe annoying if user typed specific thing)
            // setProjectLocation(`${coords.name}, ${coords.country}`);
            const weather = await fetchWeather(coords.latitude, coords.longitude);
            const impact = getWeatherImpact(weather);
            setLocalWeatherImpact(impact);
            setWeatherCode(weather.conditionCode);
            if (weather.season) setSeason(weather.season); // Auto-set season
        }
    };

    const handleAutoTag = async () => {
        const { generateTags } = await import('@/lib/autoTag');
        const tags = generateTags(`${title} ${description} ${projectLocation}`);
        if (tags.length > 0) {
            const currentSkills = skills ? skills.split(',').map(s => s.trim()) : [];
            const newSkills = Array.from(new Set([...currentSkills, ...tags])).join(', ');
            setSkills(newSkills);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Smart Auto-Tagging on Save if empty
            let finalSkills = skills;
            if (!finalSkills || finalSkills.trim() === '') {
                const { generateTags } = await import('@/lib/autoTag');
                // Use current Title and Description for auto-tagging
                const generated = generateTags(`${title} ${description} ${projectLocation}`);
                if (generated.length > 0) {
                    finalSkills = generated.join(', ');
                } else {
                    // Fallback to "General" if absolutely nothing matches but we need something?
                    // Or just leave empty. User asked to "generate a relevant tag even when the user forgets".
                    // If no keywords match, maybe we don't force it.
                }
            }

            const payload = {
                title,
                description,
                urgency,
                dueDate: dueDate || null,
                weatherSensitive,
                fundingNeeded,
                peopleRequired,
                skills: finalSkills,
                season,
                projectDuration,
                projectLocation,
                weatherCode,
                adminOverrideUrgency: canOverrideRanking ? adminOverrideUrgency : undefined,
                columnId // Only needed for create, ignored by update usually
            };

            if (task) {
                // Update
                await api.put(`/tasks/${task.id}`, payload);
            } else {
                // Create
                if (!columnId) throw new Error("Column ID required for new task");
                await api.post('/tasks', payload);
            }
            onSave();
            onClose();
        } catch (e) {
            console.error('Failed to save task', e);
            alert('Failed to save task');
        } finally {
            setSaving(false);
        }
    };

    const getUrgencyColor = (urgency: number) => {
        if (urgency >= 80) return 'from-red-500 to-orange-500';
        if (urgency >= 50) return 'from-orange-500 to-yellow-500';
        return 'from-blue-500 to-cyan-500';
    };

    return (
        <DraggableModalWrapper isOpen={true} onClose={onClose} className="w-full max-w-[590px] sm:max-w-[590px] min-h-[60vh] max-h-[90vh] flex flex-col">
            <div className="relative shrink-0">
                {/* Header with gradient bar */}
                <div className={`h-1.5 rounded-t-2xl bg-gradient-to-r ${getUrgencyColor(urgency)}`} />

                {/* Handle */}
                <div className="modal-handle cursor-move px-6 py-5 border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-t-2xl">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                            {task ? t('task_edit') : t('task_new')}
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-red-600 hover:text-red-800 dark:text-red-500 dark:hover:text-red-400 transition-colors p-2 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full"
                            aria-label="Close"
                        >
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Form content */}
            <div className="px-6 py-5 space-y-5 flex-1 overflow-y-auto bg-white dark:bg-zinc-900 min-h-0">
                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="block text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-2 uppercase tracking-wide">
                            {t('title_label')} *
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-[calc(100%-2px)] px-4 py-2.5 border-2 border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
                            placeholder={t('title_label')}
                            autoFocus={!task}
                            onBlur={() => !skills && handleAutoTag()}
                        />
                    </div>

                    <div className="col-span-2">
                        <label className="block text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-2 uppercase tracking-wide">
                            {t('desc_label')}
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            onBlur={() => !skills && handleAutoTag()}
                            rows={3}
                            className="w-[calc(100%-2px)] px-4 py-2.5 border-2 border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none shadow-sm"
                            placeholder={t('desc_label')}
                        />
                        <div className="flex justify-end mt-2">
                            <button
                                type="button"
                                onClick={async () => {
                                    if (!title && !description) return;
                                    setSaving(true); // Reuse saving state for loading spinner effect or create new one
                                    try {
                                        const targetLang = localStorage.getItem('app_language') === 'de' ? 'de' : 'en';
                                        const sourceLang = targetLang === 'en' ? 'de' : 'en'; // Simple toggle for now

                                        if (title) {
                                            const res = await api.post('/translate', { text: title, sourceLang, targetLang });
                                            if (res.data.translatedText) setTitle(res.data.translatedText);
                                        }
                                        if (description) {
                                            const res = await api.post('/translate', { text: description, sourceLang, targetLang });
                                            if (res.data.translatedText) setDescription(res.data.translatedText);
                                        }
                                    } catch (e) {
                                        console.error(e);
                                    } finally {
                                        setSaving(false);
                                    }
                                }}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 8 5-5 5 5" /><path d="m12 13 5 5 5-5" /><path d="M2 12h20" /><path d="M2 19h20" /></svg>
                                {t('translate_btn')}
                            </button>
                        </div>
                    </div>

                    {/* Project Location */}
                    <div className="col-span-2">
                        <label className="block text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-2 uppercase tracking-wide">
                            📍 {t('location_label') || 'Location'}
                        </label>
                        <input
                            type="text"
                            value={projectLocation}
                            onChange={(e) => setProjectLocation(e.target.value)}
                            onBlur={handleLocationBlur}
                            className="w-[calc(100%-2px)] px-4 py-2.5 border-2 border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
                            placeholder="e.g. Durnau, Berlin"
                        />
                    </div>

                    {/* Calculated Urgency Display */}
                    <div className="col-span-2 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                                ⚡ {t('urgency_label')}
                            </span>
                            <span className={`text-xl font-black ${urgency >= 80 ? 'text-red-600' :
                                urgency >= 50 ? 'text-orange-500' :
                                    'text-blue-500'
                                }`}>
                                {urgency}%
                            </span>
                        </div>
                        <div className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                            <div
                                className={`h-full bg-gradient-to-r ${getUrgencyColor(urgency)} transition-all duration-500`}
                                style={{ width: `${urgency}%` }}
                            />
                        </div>
                        <p className="text-xs text-zinc-500 mt-2">
                            {t('urgency_expl')}
                        </p>
                    </div>

                    {canOverrideRanking && (
                        <div className="col-span-2 p-4 bg-rose-50/70 dark:bg-rose-900/20 rounded-lg border border-rose-200 dark:border-rose-800">
                            <h3 className="text-sm font-black uppercase tracking-wide text-rose-700 dark:text-rose-300 mb-3">
                                Admin Urgency Override
                            </h3>
                            <div>
                                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                                    Override Urgency ({adminOverrideUrgency ?? 'Auto'})
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={adminOverrideUrgency ?? urgency}
                                    onChange={(e) => setAdminOverrideUrgency(Number(e.target.value))}
                                    className="w-[calc(100%-2px)] pr-2"
                                />
                                <button
                                    type="button"
                                    onClick={() => setAdminOverrideUrgency(null)}
                                    className="mt-2 text-xs font-bold text-rose-600 hover:text-rose-800"
                                >
                                    Reset to objective urgency
                                </button>
                                <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                                    Any urgency override is treated as a top-priority admin decision.
                                </p>
                            </div>
                            {task && (
                                <div className="mt-4 border-t border-rose-200 dark:border-rose-800 pt-3">
                                    <h4 className="text-xs font-black uppercase tracking-wide text-rose-700 dark:text-rose-300 mb-2">
                                        Override History
                                    </h4>
                                    {overrideHistoryLoading && (
                                        <p className="text-xs text-zinc-600 dark:text-zinc-400">Loading history...</p>
                                    )}
                                    {!overrideHistoryLoading && overrideHistoryError && (
                                        <p className="text-xs text-red-600 dark:text-red-400">{overrideHistoryError}</p>
                                    )}
                                    {!overrideHistoryLoading && !overrideHistoryError && overrideHistory.length === 0 && (
                                        <p className="text-xs text-zinc-600 dark:text-zinc-400">No override changes yet.</p>
                                    )}
                                    {!overrideHistoryLoading && !overrideHistoryError && overrideHistory.length > 0 && (
                                        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                            {overrideHistory.map((entry) => (
                                                <div key={entry.id} className="text-xs bg-white/80 dark:bg-zinc-900/60 border border-rose-200 dark:border-rose-800 rounded-md p-2">
                                                    <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                                                        {entry.changed_by_name || 'Unknown admin'} | {new Date(entry.changed_at).toLocaleString()}
                                                    </div>
                                                    <div className="text-zinc-600 dark:text-zinc-400">
                                                        Urgency: {entry.previous_admin_override_urgency ?? 'Auto'} {' -> '} {entry.new_admin_override_urgency ?? 'Auto'}
                                                    </div>
                                                    <div className="text-zinc-600 dark:text-zinc-400">
                                                        Priority: {entry.previous_admin_override_priority} {' -> '} {entry.new_admin_override_priority}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Row: People & Skills */}
                    <div>
                        <label className="block text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-2 uppercase tracking-wide">
                            👥 {t('people_label')}
                        </label>
                        <input
                            type="number"
                            min="1"
                            value={peopleRequired}
                            onChange={(e) => setPeopleRequired(parseInt(e.target.value) || 1)}
                            className="w-full px-4 py-2.5 border-2 border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
                        />
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wide">
                                🛠️ {t('skills_label')}
                            </label>
                            <button
                                type="button"
                                onClick={handleAutoTag}
                                className="text-xs bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-2 py-1 rounded transition-colors"
                            >
                                ✨ {t('auto_generate')}
                            </button>
                        </div>
                        <input
                            type="text"
                            value={skills}
                            onChange={(e) => setSkills(e.target.value)}
                            className="w-full px-4 py-2.5 border-2 border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
                            placeholder="e.g. Carpenter, Mechanic, Cook"
                        />
                    </div>
                    {skills && (
                        <div className="col-span-2 flex flex-wrap gap-2 -mt-2 mb-2">
                            {skills.split(',').map(s => s.trim()).filter(Boolean).map((s, i) => (
                                <span key={i} className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-1 rounded flex items-center gap-1">
                                    <Tag className="w-3 h-3" />
                                    {s}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Row: Funding */}
                    <div className="col-span-2">
                        <label className="block text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-2 uppercase tracking-wide">
                            💰 {t('funding_label')}
                        </label>
                        <input
                            type="number"
                            value={fundingNeeded}
                            onChange={(e) => setFundingNeeded(parseInt(e.target.value) || 0)}
                            className="w-[calc(100%-2px)] px-4 py-2.5 border-2 border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
                            placeholder="0"
                        />
                    </div>

                    {/* Row: Weather & Season */}
                    <div className="col-span-2 grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700 min-h-[82px]">
                            <input
                                type="checkbox"
                                id="weatherSensitive"
                                checked={weatherSensitive}
                                onChange={(e) => setWeatherSensitive(e.target.checked)}
                                className="w-5 h-5 rounded border-zinc-400 text-blue-600 focus:ring-2 focus:ring-blue-500"
                            />
                            <div className="flex-1">
                                <label htmlFor="weatherSensitive" className="text-sm font-bold text-zinc-700 dark:text-zinc-300 cursor-pointer block">
                                    🌦️ {t('weather_sensitive_label')}
                                </label>
                                {weatherSensitive && weatherImpact > 0 && (
                                    <span className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded-full font-bold">
                                        +{(localWeatherImpact !== null ? localWeatherImpact : weatherImpact)} {t('weather_impact_msg')}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-2 uppercase tracking-wide">
                                🍂 {t('season_label')}
                            </label>
                            <select
                                value={season || ''}
                                onChange={(e) => setSeason(e.target.value)}
                                className="w-full px-4 py-2.5 border-2 border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm cursor-pointer"
                            >
                                <option value="">{t('season_flexible')}</option>
                                <option value="Winter">❄️ {t('season_winter')}</option>
                                <option value="Spring">🌱 {t('season_spring')}</option>
                                <option value="Summer">☀️ {t('season_summer')}</option>
                                <option value="Autumn">🍂 {t('season_autumn')}</option>
                            </select>
                        </div>
                    </div>

                    {/* Row: Project Duration & Due Date */}
                    <div>
                        <label className="block text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-2 uppercase tracking-wide">
                            ⏳ Duration
                        </label>
                        <input
                            type="text"
                            value={projectDuration}
                            onChange={(e) => setProjectDuration(e.target.value)}
                            className="w-full px-4 py-2.5 border-2 border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
                            placeholder="e.g. 2 weeks"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-2 uppercase tracking-wide">
                            {t('due_date_label')}
                        </label>
                        <input
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            className="w-full px-4 py-2.5 border-2 border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Footer with actions */}
            <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 rounded-b-2xl shrink-0">
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 rounded-lg font-bold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border-2 border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all"
                    >
                        {t('cancel')}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || !title}
                        className="flex-1 px-4 py-2.5 rounded-lg font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/30"
                    >
                        {saving ? `💾 ${t('saving')}` : (task ? `✅ ${t('save')}` : `✨ ${t('creating')}`)}
                    </button>
                </div>
            </div>
        </DraggableModalWrapper>
    );
}
