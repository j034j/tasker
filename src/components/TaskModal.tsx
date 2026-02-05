
import { useState, useRef, useEffect } from 'react';
import { Tag } from 'lucide-react';
import { api } from '@/lib/axios';
import { useStore } from '@/lib/store';
import { useLanguage } from '@/contexts/LanguageContext';

// We reuse the interface but now include new fields
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
}

interface TaskModalProps {
    task?: Task | null; // If null, we are creating
    columnId?: string; // Required if creating
    onClose: () => void;
    onSave: () => void;
}

export function TaskModal({ task, columnId, onClose, onSave }: TaskModalProps) {
    const { weatherImpact, fetchWeatherImpact, currentSeason } = useStore();
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

    const [saving, setSaving] = useState(false);

    // Draggable state (kept from previous implementation)
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Fetch weather impact when modal opens
        fetchWeatherImpact();
    }, [fetchWeatherImpact]);

    // Auto-Calculate Urgency based on factors
    useEffect(() => {
        const runCalculation = async () => {
            const { calculateUrgency } = await import('@/lib/rankingEngine');

            const score = calculateUrgency({
                dueDate,
                fundingNeeded,
                peopleRequired,
                skills,
                weatherSensitive,
                weatherImpact,
                projectSeason: season as any,
                currentSeason
            });

            setUrgency(score);
        };
        runCalculation();
    }, [dueDate, fundingNeeded, peopleRequired, weatherSensitive, weatherImpact, skills, season, currentSeason]);

    const handleAutoTag = async () => {
        const { generateTags } = await import('@/lib/autoTag');
        const tags = generateTags(`${title} ${description}`);
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
                const generated = generateTags(`${title} ${description}`);
                if (generated.length > 0) {
                    finalSkills = generated.join(', ');
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



    // Mouse Handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('.modal-header')) {
            e.preventDefault();
            setIsDragging(true);
            setDragStart({
                x: e.clientX - position.x,
                y: e.clientY - position.y
            });
        }
    };

    // Touch Handlers
    const handleTouchStart = (e: React.TouchEvent) => {
        if ((e.target as HTMLElement).closest('.modal-header')) {
            // e.preventDefault(); // adhere to passive if needed, but usually we want to block scroll
            setIsDragging(true);
            const touch = e.touches[0];
            setDragStart({
                x: touch.clientX - position.x,
                y: touch.clientY - position.y
            });
        }
    };

    useEffect(() => {
        if (!isDragging) return;

        // Mouse Move/Up
        const handleMouseMove = (e: MouseEvent) => {
            e.preventDefault();
            setPosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        // Touch Move/End
        const handleTouchMove = (e: TouchEvent) => {
            e.preventDefault(); // Stop scrolling
            const touch = e.touches[0];
            setPosition({
                x: touch.clientX - dragStart.x,
                y: touch.clientY - dragStart.y
            });
        };

        const handleTouchEnd = () => {
            setIsDragging(false);
        };

        // Attach global listeners
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('touchmove', handleTouchMove, { passive: false });
        window.addEventListener('touchend', handleTouchEnd);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
        };
    }, [isDragging, dragStart]);

    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                ref={modalRef}
                className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 relative z-[60]"
                style={{
                    left: position.x,
                    top: position.y,
                    position: 'relative',
                    backgroundColor: 'white' // Forced opacity
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header with gradient bar */}
                <div className="relative">
                    <div className={`h-1.5 rounded-t-2xl bg-gradient-to-r ${getUrgencyColor(urgency)}`} />
                    <div
                        className="modal-header px-6 py-5 border-b border-zinc-200 dark:border-zinc-700 cursor-grab active:cursor-grabbing bg-white dark:bg-zinc-900 rounded-t-2xl touch-none"
                        onMouseDown={handleMouseDown}
                        onTouchStart={handleTouchStart}
                    >
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
                <div className="px-6 py-5 space-y-5 max-h-[calc(100vh-16rem)] overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-2 uppercase tracking-wide">
                                {t('title_label')} *
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full px-4 py-2.5 border-2 border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
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
                                className="w-full px-4 py-2.5 border-2 border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none shadow-sm"
                                placeholder={t('desc_label')}
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

                        {/* Additional Fields Row 1 */}
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
                            <label className="block text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-2 uppercase tracking-wide">
                                💰 {t('funding_label')}
                            </label>
                            <input
                                type="number"
                                value={fundingNeeded}
                                onChange={(e) => setFundingNeeded(parseInt(e.target.value) || 0)}
                                className="w-full px-4 py-2.5 border-2 border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
                                placeholder="0"
                            />
                        </div>

                        {/* Season Selection */}
                        <div className="col-span-2">
                            <label className="block text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-2 uppercase tracking-wide">
                                🍂 {t('season_label')}
                            </label>
                            <select
                                value={season || ''}
                                onChange={(e) => setSeason(e.target.value as any)}
                                className="w-full px-4 py-2.5 border-2 border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm cursor-pointer"
                            >
                                <option value="">{t('season_flexible')}</option>
                                <option value="Winter">❄️ {t('season_winter')}</option>
                                <option value="Spring">🌱 {t('season_spring')}</option>
                                <option value="Summer">☀️ {t('season_summer')}</option>
                                <option value="Autumn">🍂 {t('season_autumn')}</option>
                            </select>
                        </div>

                        {/* Special Skills Field */}
                        <div className="col-span-2">
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
                            {skills && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {skills.split(',').map(s => s.trim()).filter(Boolean).map((s, i) => (
                                        <span key={i} className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-1 rounded flex items-center gap-1">
                                            <Tag className="w-3 h-3" />
                                            {s}
                                        </span>
                                    ))}
                                </div>
                            )}
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


                        <div className="col-span-2">
                            <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700">
                                <input
                                    type="checkbox"
                                    id="weatherSensitive"
                                    checked={weatherSensitive}
                                    onChange={(e) => setWeatherSensitive(e.target.checked)}
                                    className="w-5 h-5 rounded border-zinc-400 text-blue-600 focus:ring-2 focus:ring-blue-500"
                                />
                                <label htmlFor="weatherSensitive" className="text-sm font-bold text-zinc-700 dark:text-zinc-300 cursor-pointer flex-1">
                                    🌦️ {t('weather_sensitive_label')}
                                </label>
                                {weatherSensitive && weatherImpact > 0 && (
                                    <span className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded-full font-bold">
                                        +{weatherImpact} {t('weather_impact_msg')}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer with actions */}
                <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 rounded-b-2xl">
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
            </div>
        </div>
    );
}
