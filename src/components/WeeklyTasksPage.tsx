import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/lib/store';

interface WeeklyTasksPageProps {
    weekStart: string;
    onWeekChange: (weekStart: string) => void;
}

const toDateString = (date: Date) => date.toISOString().slice(0, 10);
const parseIsoDate = (value: string) => new Date(`${value}T00:00:00.000Z`);
const toMonthKey = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
const weekOfMonth = (date: Date) => Math.min(4, Math.max(1, Math.floor((date.getUTCDate() - 1) / 7) + 1));
const weekLabel = (week: number) => `Week ${week}`;
const weekStartFromMonthWeek = (monthKey: string, week: number) => {
    const [year, month] = monthKey.split('-').map(Number);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return '';
    const day = ((week - 1) * 7) + 1;
    return toDateString(new Date(Date.UTC(year, (month - 1), day)));
};

export function WeeklyTasksPage({ weekStart, onWeekChange }: WeeklyTasksPageProps) {
    const { orgId, reportingOverview, fetchReportingOverview, fetchWeeklyObjective, saveWeeklyObjective, fetchWeeklyObjectiveHistory, currentUser } = useStore();
    const [statusFilter, setStatusFilter] = useState<'all' | 'not_started' | 'in_progress' | 'completed'>('all');
    const [personFilter, setPersonFilter] = useState('all');
    const [locationFilter, setLocationFilter] = useState('all');
    const [selectedMonth, setSelectedMonth] = useState(() => toMonthKey(parseIsoDate(weekStart)));
    const [selectedWeek, setSelectedWeek] = useState<number>(() => weekOfMonth(parseIsoDate(weekStart)));
    const [weeklyObjective, setWeeklyObjective] = useState('');
    const [objectiveUpdatedAt, setObjectiveUpdatedAt] = useState<string | null>(null);
    const [objectiveUpdatedByName, setObjectiveUpdatedByName] = useState<string | null>(null);
    const [objectiveHistory, setObjectiveHistory] = useState<{
        id: string;
        previous_objective_text: string | null;
        objective_text: string;
        changed_at: string;
        changed_by_name: string | null;
    }[]>([]);
    const [objectiveStatus, setObjectiveStatus] = useState<string | null>(null);
    const [objectiveSaving, setObjectiveSaving] = useState(false);
    const canEditObjective = currentUser?.role === 'admin' || currentUser?.role === 'org_super_admin' || currentUser?.role === 'super_admin';

    useEffect(() => {
        if (!orgId) return;
        fetchReportingOverview(orgId, weekStart).catch(console.error);
    }, [orgId, weekStart, fetchReportingOverview]);

    useEffect(() => {
        const date = parseIsoDate(weekStart);
        if (Number.isNaN(date.getTime())) return;
        setSelectedMonth(toMonthKey(date));
        setSelectedWeek(weekOfMonth(date));
    }, [weekStart]);

    useEffect(() => {
        const calculatedWeekStart = weekStartFromMonthWeek(selectedMonth, selectedWeek);
        if (calculatedWeekStart && calculatedWeekStart !== weekStart) {
            onWeekChange(calculatedWeekStart);
        }
    }, [selectedMonth, selectedWeek, weekStart, onWeekChange]);

    useEffect(() => {
        if (!orgId) return;
        Promise.all([
            fetchWeeklyObjective(orgId, selectedMonth, selectedWeek),
            fetchWeeklyObjectiveHistory(orgId, selectedMonth, selectedWeek)
        ])
            .then(([result, history]) => {
                setWeeklyObjective(result.objective || '');
                setObjectiveUpdatedAt(result.updated_at);
                setObjectiveUpdatedByName(result.updated_by_name);
                setObjectiveHistory(history);
                setObjectiveStatus(null);
            })
            .catch(() => {
                setWeeklyObjective('');
                setObjectiveUpdatedAt(null);
                setObjectiveUpdatedByName(null);
                setObjectiveHistory([]);
                setObjectiveStatus('Failed to load weekly objective.');
            });
    }, [orgId, selectedMonth, selectedWeek, fetchWeeklyObjective, fetchWeeklyObjectiveHistory]);

    const weeklyTasks = reportingOverview?.weekly_tasks ?? [];

    const peopleOptions = useMemo(() => {
        const people = new Set<string>();
        for (const task of weeklyTasks) {
            for (const person of task.participants) people.add(person);
        }
        return Array.from(people).sort((a, b) => a.localeCompare(b));
    }, [weeklyTasks]);

    const locationOptions = useMemo(() => {
        const locations = new Set<string>();
        for (const task of weeklyTasks) {
            if (task.location) locations.add(task.location);
        }
        return Array.from(locations).sort((a, b) => a.localeCompare(b));
    }, [weeklyTasks]);

    const filteredTasks = useMemo(() => {
        return weeklyTasks.filter((task) => {
            const statusMatch = statusFilter === 'all' || task.status === statusFilter;
            const personMatch = personFilter === 'all' || task.participants.includes(personFilter);
            const locationMatch = locationFilter === 'all' || task.location === locationFilter;
            return statusMatch && personMatch && locationMatch;
        });
    }, [weeklyTasks, statusFilter, personFilter, locationFilter]);

    const today = new Date();
    const currentMonth = toMonthKey(today);
    const currentWeek = weekOfMonth(today);
    const viewingCurrentCalendarWeek = currentMonth === selectedMonth && currentWeek === selectedWeek;

    if (!reportingOverview) {
        return <div className="p-6 text-sm text-zinc-500">Loading weekly task overview...</div>;
    }

    return (
        <div className="flex-1 overflow-y-auto p-6 bg-zinc-50 dark:bg-zinc-950 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100">Weekly Task Overview</h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Who is doing what and where</p>
                    <p className={`text-xs mt-1 font-semibold ${viewingCurrentCalendarWeek ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500 dark:text-zinc-400'}`}>
                        Calendar says this week is {weekLabel(currentWeek)} of {currentMonth}. {viewingCurrentCalendarWeek ? 'You are viewing the current week.' : `You are viewing ${weekLabel(selectedWeek)} of ${selectedMonth}.`}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                    />
                    <select
                        value={selectedWeek}
                        onChange={(e) => setSelectedWeek(Number(e.target.value))}
                        className="px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                    >
                        <option value={1}>Week 1</option>
                        <option value={2}>Week 2</option>
                        <option value={3}>Week 3</option>
                        <option value={4}>Week 4</option>
                    </select>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as 'all' | 'not_started' | 'in_progress' | 'completed')}
                        className="px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                    >
                        <option value="all">All status</option>
                        <option value="not_started">Not started</option>
                        <option value="in_progress">In progress</option>
                        <option value="completed">Completed</option>
                    </select>
                    <select
                        value={personFilter}
                        onChange={(e) => setPersonFilter(e.target.value)}
                        className="px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                    >
                        <option value="all">All people</option>
                        {peopleOptions.map((person) => (
                            <option key={person} value={person}>{person}</option>
                        ))}
                    </select>
                    <select
                        value={locationFilter}
                        onChange={(e) => setLocationFilter(e.target.value)}
                        className="px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                    >
                        <option value="all">All locations</option>
                        {locationOptions.map((location) => (
                            <option key={location} value={location}>{location}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 space-y-2">
                <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{weekLabel(selectedWeek)} Objective</h3>
                    <button
                        onClick={async () => {
                            if (!orgId || !canEditObjective) return;
                            setObjectiveSaving(true);
                            setObjectiveStatus(null);
                            try {
                                await saveWeeklyObjective(orgId, selectedMonth, selectedWeek, weeklyObjective);
                                setObjectiveStatus('Objective saved for organization.');
                                const [result, history] = await Promise.all([
                                    fetchWeeklyObjective(orgId, selectedMonth, selectedWeek),
                                    fetchWeeklyObjectiveHistory(orgId, selectedMonth, selectedWeek)
                                ]);
                                setObjectiveUpdatedAt(result.updated_at);
                                setObjectiveUpdatedByName(result.updated_by_name);
                                setObjectiveHistory(history);
                            } catch {
                                setObjectiveStatus('Failed to save objective.');
                            } finally {
                                setObjectiveSaving(false);
                            }
                        }}
                        disabled={!canEditObjective || objectiveSaving}
                        className="px-3 py-1.5 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {objectiveSaving ? 'Saving...' : 'Save Objective'}
                    </button>
                </div>
                <textarea
                    value={weeklyObjective}
                    onChange={(e) => setWeeklyObjective(e.target.value)}
                    placeholder="Describe weekly objectives to guide board and task creation (e.g. complete roof repairs, finish electrical inspections, schedule mechanic maintenance)."
                    rows={3}
                    disabled={!canEditObjective}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {canEditObjective ? 'This objective is shared across your organization for the selected week.' : 'View-only objective. Admin or Org Super Admin can edit.'}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Last updated: {objectiveUpdatedAt ? new Date(objectiveUpdatedAt).toLocaleString() : 'Never'}{objectiveUpdatedByName ? ` by ${objectiveUpdatedByName}` : ''}
                </p>
                {objectiveStatus && (
                    <p className={`text-xs ${objectiveStatus.includes('Failed') ? 'text-red-600' : 'text-emerald-600'}`}>{objectiveStatus}</p>
                )}

                {objectiveHistory.length > 0 && (
                    <div className="pt-2">
                        <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Objective history</p>
                        <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                            {objectiveHistory.map((entry) => (
                                <div key={entry.id} className="text-xs text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 rounded-md px-2 py-1">
                                    <span className="font-semibold">{new Date(entry.changed_at).toLocaleString()}</span>
                                    {entry.changed_by_name ? ` by ${entry.changed_by_name}` : ''}
                                    <div className="mt-1">{entry.objective_text || '(empty objective)'}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="bg-zinc-100 dark:bg-zinc-800">
                        <tr className="text-left text-zinc-700 dark:text-zinc-200">
                            <th className="p-3">Task</th>
                            <th className="p-3">Board</th>
                            <th className="p-3">Status</th>
                            <th className="p-3">Who</th>
                            <th className="p-3">Where</th>
                            <th className="p-3">Due</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredTasks.map((task) => (
                            <tr key={task.id} className="border-t border-zinc-200 dark:border-zinc-700">
                                <td className="p-3 font-medium">{task.title}</td>
                                <td className="p-3">{task.board_name}</td>
                                <td className="p-3">{task.status.replace('_', ' ')}</td>
                                <td className="p-3">{task.participants.join(', ') || 'Unassigned'}</td>
                                <td className="p-3">{task.location || 'No location'}</td>
                                <td className="p-3">{task.due_date || '-'}</td>
                            </tr>
                        ))}
                        {filteredTasks.length === 0 && (
                            <tr>
                                <td className="p-4 text-zinc-500" colSpan={6}>No tasks match the selected filters.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
