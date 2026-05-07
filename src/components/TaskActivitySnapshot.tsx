import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/axios';
import { useLanguage } from '@/contexts/LanguageContext';

const DAY_COUNT = 28;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const NEW_TASK_WINDOW_DAYS = 7;
const MAX_DAY_TILES = 10;

interface TaskActivitySnapshotProps {
    orgId: string;
    refreshKey?: string;
    onSelectTask: (selection: { boardId: string; taskId: string; boardCreatedAt?: string }) => void;
}

interface SnapshotTask {
    id: string;
    title: string;
    due_date?: string | null;
    completed_at?: string | null;
    created_at?: string | null;
    archived?: number | boolean | null;
    priority_score?: number | string | null;
    urgency?: number | string | null;
    column_title: string;
}

interface SnapshotColumn {
    id: string;
    title: string;
    tasks: SnapshotTask[];
}

interface SnapshotBoard {
    board: {
        id: string;
        name: string;
        created_at?: string;
        department_id?: string | null;
        department_name?: string | null;
    };
    columns: SnapshotColumn[];
}

interface SnapshotTaskEntry {
    id: string;
    title: string;
    boardId: string;
    boardName: string;
    boardCreatedAt?: string;
    departmentName: string;
    createdAt: string | null;
    completedAt: string | null;
    columnTitle: string;
    urgency: number;
    priorityScore: number;
}

const toDayKey = (value: Date | string) => {
    const date = value instanceof Date ? value : new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const parseDate = (value?: string | null) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const startOfToday = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const isDoneColumnTitle = (value: string) => {
    const normalized = value.trim().toLowerCase();
    return normalized === 'done' || normalized === 'completed' || normalized === 'complete';
};

const isTodoColumnTitle = (value: string) => {
    const normalized = value.trim().toLowerCase();
    return normalized === 'to do' || normalized === 'todo' || normalized === 'not started';
};

const getTaskSignals = (task: SnapshotTaskEntry) => {
    const createdDate = parseDate(task.createdAt);
    const daysSinceCreated = createdDate
        ? Math.floor((startOfToday().getTime() - new Date(createdDate.getFullYear(), createdDate.getMonth(), createdDate.getDate()).getTime()) / MS_PER_DAY)
        : Number.POSITIVE_INFINITY;
    const isCompleted = Boolean(task.completedAt) || isDoneColumnTitle(task.columnTitle);
    const isNew = !isCompleted && daysSinceCreated >= 0 && daysSinceCreated < NEW_TASK_WINDOW_DAYS;
    const isUrgent = !isCompleted && Math.max(task.priorityScore, task.urgency) >= 80;
    const isInProgress = !isCompleted && !isTodoColumnTitle(task.columnTitle);
    return { isCompleted, isNew, isUrgent, isInProgress };
};

const getTaskToneStyle = (task: SnapshotTaskEntry) => {
    const { isCompleted, isNew, isUrgent, isInProgress } = getTaskSignals(task);

    if (isCompleted) {
        return {
            background: 'linear-gradient(135deg, #ffffff 0%, #f4f4f5 100%)',
            borderColor: '#d4d4d8'
        };
    }

    const colors: string[] = [];
    if (isNew) colors.push('#22c55e');
    if (isInProgress) colors.push('#facc15');
    if (isUrgent) colors.push('#ef4444');
    if (colors.length === 0) colors.push('#94a3b8');

    const background = colors.length === 1
        ? colors[0]
        : colors.length === 2
            ? `linear-gradient(135deg, ${colors[0]} 0 50%, ${colors[1]} 50% 100%)`
            : `linear-gradient(135deg, ${colors[0]} 0 33%, ${colors[1]} 33% 66%, ${colors[2]} 66% 100%)`;

    return {
        background,
        borderColor: isUrgent ? '#fca5a5' : isNew ? '#86efac' : isInProgress ? '#fde68a' : '#cbd5e1'
    };
};

const formatDayLabel = (dayKey: string) => {
    const date = new Date(`${dayKey}T00:00:00`);
    return {
        weekday: date.toLocaleDateString('en-US', { weekday: 'short' }),
        shortDay: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    };
};

export function TaskActivitySnapshot({ orgId, refreshKey, onSelectTask }: TaskActivitySnapshotProps) {
    const [boards, setBoards] = useState<SnapshotBoard[]>([]);
    const [loading, setLoading] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedDepartment, setSelectedDepartment] = useState('all');
    const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
    const { t } = useLanguage();

    useEffect(() => {
        if (!orgId) return;

        let cancelled = false;
        let rateLimitCount = 0;
        const loadSnapshot = async () => {
            if (rateLimitCount >= 3) {
                console.log('[Snapshot] Rate limited, skipping...');
                return;
            }
            setLoading(true);
            try {
                const { data } = await api.get(`/orgs/${orgId}/central-view`);
                if (!cancelled) {
                    setBoards(Array.isArray(data?.boards) ? data.boards : []);
                    rateLimitCount = 0;
                }
            } catch (error: any) {
                if (error?.code === 'ERR_CANCELED' || error?.message?.includes('canceled') || error?.message?.includes('aborted')) {
                    return;
                }
                if (error?.response?.status === 429) {
                    rateLimitCount++;
                    console.log('[Snapshot] Rate limited, count:', rateLimitCount);
                }
                if (!cancelled) {
                    setBoards([]);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadSnapshot().catch(console.error);
        const intervalId = window.setInterval(() => {
            if (rateLimitCount < 3) {
                loadSnapshot().catch(console.error);
            }
        }, 120000);

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
        };
    }, [orgId, refreshKey]);

    const flattenedTasks = useMemo<SnapshotTaskEntry[]>(() => (
        boards.flatMap((entry) => (
            entry.columns.flatMap((column) => (
                column.tasks
                    .filter((task) => !(task.archived === true || task.archived === 1))
                    .map((task) => ({
                        id: task.id,
                        title: task.title,
                        boardId: entry.board.id,
                        boardName: entry.board.name,
                        boardCreatedAt: entry.board.created_at,
                        departmentName: entry.board.department_name || 'Unassigned',
                        createdAt: task.created_at || null,
                        completedAt: task.completed_at || null,
                        columnTitle: task.column_title || column.title,
                        urgency: Number(task.urgency) || 0,
                        priorityScore: Number(task.priority_score) || 0
                    }))
            ))
        ))
    ), [boards]);

    const departmentOptions = useMemo(() => (
        Array.from(new Set(flattenedTasks.map((task) => task.departmentName))).sort((left, right) => left.localeCompare(right))
    ), [flattenedTasks]);

    const filteredTasks = useMemo(() => (
        selectedDepartment === 'all'
            ? flattenedTasks
            : flattenedTasks.filter((task) => task.departmentName === selectedDepartment)
    ), [flattenedTasks, selectedDepartment]);

    const dayKeys = useMemo(() => {
        const today = startOfToday();
        return Array.from({ length: DAY_COUNT }, (_, index) => {
            const date = new Date(today.getTime() - (DAY_COUNT - 1 - index) * MS_PER_DAY);
            return toDayKey(date);
        });
    }, []);

    const tasksByDay = useMemo(() => {
        const bucket = new Map<string, SnapshotTaskEntry[]>();
        for (const task of filteredTasks) {
            if (!task.createdAt) continue;
            const dayKey = toDayKey(task.createdAt);
            if (!dayKeys.includes(dayKey)) continue;
            const existing = bucket.get(dayKey) || [];
            existing.push(task);
            bucket.set(dayKey, existing);
        }

        for (const [dayKey, tasks] of bucket.entries()) {
            bucket.set(dayKey, tasks.sort((left, right) => {
                const leftSignals = getTaskSignals(left);
                const rightSignals = getTaskSignals(right);
                return Number(rightSignals.isUrgent) - Number(leftSignals.isUrgent)
                    || Number(rightSignals.isInProgress) - Number(leftSignals.isInProgress)
                    || Number(rightSignals.isNew) - Number(leftSignals.isNew)
                    || right.priorityScore - left.priorityScore
                    || left.title.localeCompare(right.title);
            }));
        }

        return bucket;
    }, [dayKeys, filteredTasks]);

    useEffect(() => {
        if (selectedDayKey && dayKeys.includes(selectedDayKey)) {
            return;
        }

        const latestDayWithTasks = [...dayKeys].reverse().find((dayKey) => (tasksByDay.get(dayKey)?.length || 0) > 0);
        setSelectedDayKey(latestDayWithTasks || dayKeys[dayKeys.length - 1] || null);
    }, [dayKeys, selectedDayKey, tasksByDay]);

    const selectedDayTasks = selectedDayKey ? tasksByDay.get(selectedDayKey) || [] : [];
    const taskTotals = useMemo(() => (
        filteredTasks.reduce((totals, task) => {
            const signals = getTaskSignals(task);
            if (signals.isCompleted) totals.completed += 1;
            else {
                if (signals.isNew) totals.newTasks += 1;
                if (signals.isInProgress) totals.inProgress += 1;
                if (signals.isUrgent) totals.urgent += 1;
            }
            return totals;
        }, { newTasks: 0, inProgress: 0, urgent: 0, completed: 0 })
    ), [filteredTasks]);
    const previewDayKeys = useMemo(() => dayKeys.slice(-8), [dayKeys]);
    const previewActivityCount = useMemo(
        () => previewDayKeys.reduce((total, dayKey) => total + (tasksByDay.get(dayKey)?.length || 0), 0),
        [previewDayKeys, tasksByDay]
    );
    const latestActiveDayLabel = useMemo(() => {
        const latestActiveDay = [...dayKeys].reverse().find((dayKey) => (tasksByDay.get(dayKey)?.length || 0) > 0);
        return latestActiveDay ? formatDayLabel(latestActiveDay).shortDay : 'No recent activity';
    }, [dayKeys, tasksByDay]);
    const statusLabel = isExpanded ? 'Open' : 'Collapsed';
    const totalsLabel = `New ${taskTotals.newTasks}, Ongoing ${taskTotals.inProgress}, Urgent ${taskTotals.urgent}, Completed ${taskTotals.completed}`;

    return (
        <section className="mb-4 rounded-3xl border border-zinc-200 bg-white/95 p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/90">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-2 dark:border-zinc-800 dark:bg-zinc-950/40">
                <div className="flex flex-col gap-2 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-black tracking-tight text-zinc-900 dark:text-zinc-50">{t('task_activity_snapshot')}</h3>
                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                            {statusLabel}
                        </span>
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                            {previewActivityCount} {t('recent_signals')}
                        </span>
                    </div>
                    <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                        {isExpanded
                            ? t('expand_snapshot')
                            : `${t('latest_activity')}: ${latestActiveDayLabel}. ${t('expand_snapshot')}`}
                    </p>
                    </div>

                    <div className="flex flex-col gap-2 xl:items-end">
                    <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                        <span className="rounded-full border border-zinc-300 bg-white px-2 py-0.5 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                            {totalsLabel}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsExpanded((currentValue) => !currentValue)}
                        aria-expanded={isExpanded}
                        className="inline-flex items-center gap-2 self-start rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-sm font-bold text-indigo-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-zinc-900 dark:text-indigo-300 dark:hover:border-indigo-700 dark:hover:bg-indigo-900/20 xl:self-auto"
                    >
                        <span>{isExpanded ? t('hide_snapshot') : t('open_snapshot')}</span>
                        <span className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>v</span>
                    </button>
                    </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                    {previewDayKeys.map((dayKey) => {
                        const dayTasks = tasksByDay.get(dayKey) || [];
                        const labels = formatDayLabel(dayKey);
                        return (
                            <button
                                key={dayKey}
                                type="button"
                                onClick={() => {
                                    setSelectedDayKey(dayKey);
                                    setIsExpanded(true);
                                }}
                                className={`min-w-[68px] rounded-xl border px-2 py-1.5 text-left transition-all ${selectedDayKey === dayKey && isExpanded
                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                                    : 'border-zinc-200 bg-zinc-50 hover:border-indigo-300 dark:border-zinc-800 dark:bg-zinc-950/40 dark:hover:border-indigo-700'
                                    }`}
                            >
                                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">{labels.weekday}</div>
                                <div className="mt-0.5 text-sm font-bold text-zinc-800 dark:text-zinc-100">{labels.shortDay}</div>
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                    {dayTasks.slice(0, 4).map((task) => (
                                        <span
                                            key={task.id}
                                            className="h-3 w-3 rounded-[4px] border shadow-sm"
                                            style={getTaskToneStyle(task)}
                                        />
                                    ))}
                                    {dayTasks.length === 0 && <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{t('no_activity')}</span>}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {isExpanded && (
                <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                        <span className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-800">{t('green_new')}</span>
                        <span className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-800">{t('yellow_progress')}</span>
                        <span className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-800">{t('red_urgent')}</span>
                        <span className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-800">{t('white_done')}</span>
                        <span className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-800">{t('multi_color')}</span>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                        <select
                            value={selectedDepartment}
                            onChange={(e) => setSelectedDepartment(e.target.value)}
                            className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 focus:outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                        >
                            <option value="all">{t('all_departments')}</option>
                            {departmentOptions.map((departmentName) => (
                                <option key={departmentName} value={departmentName}>{departmentName}</option>
                            ))}
                        </select>
                        {loading && <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{t('refreshing')}</span>}
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                            <div className="overflow-x-auto">
                                <div className="grid min-w-[720px] grid-cols-7 gap-2">
                                {dayKeys.map((dayKey) => {
                                    const dayTasks = tasksByDay.get(dayKey) || [];
                                    const labels = formatDayLabel(dayKey);
                                    return (
                                        <div
                                            key={dayKey}
                                            onClick={() => setSelectedDayKey(dayKey)}
                                            className={`min-h-[102px] cursor-pointer rounded-2xl border p-2 text-left transition-all ${selectedDayKey === dayKey
                                                ? 'border-indigo-500 bg-white shadow-sm dark:bg-zinc-900'
                                                : 'border-zinc-200 bg-white/90 hover:border-indigo-300 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-indigo-700'
                                                }`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">{labels.weekday}</div>
                                                    <div className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{labels.shortDay}</div>
                                                </div>
                                                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                                                    {dayTasks.length}
                                                </span>
                                            </div>

                                            <div className="mt-3 flex flex-wrap gap-1.5">
                                                {dayTasks.slice(0, MAX_DAY_TILES).map((task) => (
                                                    <button
                                                        key={task.id}
                                                        type="button"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            onSelectTask({
                                                                boardId: task.boardId,
                                                                taskId: task.id,
                                                                boardCreatedAt: task.boardCreatedAt
                                                            });
                                                        }}
                                                        title={`${task.title} | ${task.boardName} | ${task.departmentName}`}
                                                        className="h-4 w-4 rounded-[5px] border shadow-sm transition-transform hover:scale-110"
                                                        style={getTaskToneStyle(task)}
                                                    />
                                                ))}
                                                {dayTasks.length > MAX_DAY_TILES && (
                                                    <span className="inline-flex items-center rounded-md bg-zinc-100 px-1.5 text-[10px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                                                        +{dayTasks.length - MAX_DAY_TILES}
                                                    </span>
                                                )}
                                                {!loading && dayTasks.length === 0 && (
                                                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{t('no_activity')}</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <h4 className="text-sm font-black uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">{t('day_focus')}</h4>
                                    <p className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                                        {selectedDayKey ? formatDayLabel(selectedDayKey).shortDay : t('no_day_selected')}
                                    </p>
                                </div>
                                {loading && <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{t('refreshing')}</span>}
                            </div>

                            <div className="mt-4 space-y-2">
                                {selectedDayTasks.map((task) => (
                                    <button
                                        key={task.id}
                                        type="button"
                                        onClick={() => onSelectTask({ boardId: task.boardId, taskId: task.id, boardCreatedAt: task.boardCreatedAt })}
                                        className="flex w-full items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-left transition-all hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-zinc-800 dark:bg-zinc-950/40 dark:hover:border-indigo-700 dark:hover:bg-indigo-900/10"
                                    >
                                        <span className="mt-0.5 h-4 w-4 shrink-0 rounded-[5px] border shadow-sm" style={getTaskToneStyle(task)} />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-bold text-zinc-900 dark:text-zinc-100">{task.title}</span>
                                            <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                                                {task.boardName} | {task.departmentName} | {task.columnTitle}
                                            </span>
                                        </span>
                                        <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-black text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                                            {Math.max(task.priorityScore, task.urgency)}
                                        </span>
                                    </button>
                                ))}
                                {!loading && selectedDayTasks.length === 0 && (
                                    <p className="rounded-2xl border border-dashed border-zinc-200 px-3 py-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                                        No tasks were created on this day for the current department filter.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}

export default TaskActivitySnapshot;
