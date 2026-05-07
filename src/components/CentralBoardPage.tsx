import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { api } from '@/lib/axios';
import { useLanguage } from '@/contexts/LanguageContext';
import { ArrowLeft, Building2, LayoutGrid, List } from 'lucide-react';

interface CentralBoardPageProps {
    onBack: () => void;
    onViewTask: (taskId: string, boardId: string, boardCreatedAt?: string) => void;
}

interface Department {
    id: string;
    name: string;
    admin_user_id?: string | null;
}

interface CentralTask {
    id: string;
    title: string;
    description?: string | null;
    due_date?: string | null;
    completed_at?: string | null;
    created_at?: string | null;
    urgency: number;
    priority_score: number;
    column_title: string;
}

interface CentralColumn {
    id: string;
    title: string;
    tasks: CentralTask[];
}

interface CentralBoard {
    id: string;
    name: string;
    created_at?: string;
    department_id?: string | null;
    department_name?: string | null;
    columns: CentralColumn[];
}

export function CentralBoardPage({ onBack, onViewTask }: CentralBoardPageProps) {
    const { t } = useLanguage();
    const { orgId, currentUser, fetchBoard } = useStore();
    const [boards, setBoards] = useState<CentralBoard[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
    const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

    const canViewAll = currentUser?.role === 'admin' || currentUser?.role === 'org_super_admin' || currentUser?.role === 'super_admin' || currentUser?.role === 'dept_admin';

    useEffect(() => {
        if (!orgId) return;
        setLoading(true);
        const deptPromise = api.get(`/orgs/${orgId}/departments`).then(({ data }) => data.departments || []);
        const boardPromise = api.get(`/orgs/${orgId}/central-view${selectedDepartment !== 'all' ? `?departmentId=${selectedDepartment}` : ''}`).then(({ data }) => data.boards || []);

        Promise.all([deptPromise, boardPromise])
            .then(([deptData, boardData]) => {
                setDepartments(deptData);
                setBoards(boardData);
            })
            .catch((err) => {
                console.error('Failed to load central view:', err);
                setDepartments([]);
                setBoards([]);
            })
            .finally(() => setLoading(false));
    }, [orgId, selectedDepartment]);

    const allTasks = useMemo(() => (
        boards.flatMap((board) =>
            board.columns.flatMap((col) =>
                col.tasks.map((task) => ({
                    ...task,
                    boardId: board.id,
                    boardName: board.name,
                    boardCreatedAt: board.created_at,
                    departmentName: board.department_name || 'Unassigned'
                }))
            )
        )
    ), [boards]);

    const tasksByColumn = useMemo(() => {
        const cols = new Map<string, typeof allTasks>();
        cols.set('To Do', []);
        cols.set('In Progress', []);
        cols.set('Review', []);
        cols.set('Done', []);
        for (const task of allTasks) {
            const colName = normalizeColumn(task.column_title);
            if (cols.has(colName)) {
                cols.get(colName)!.push(task);
            }
        }
        return cols;
    }, [allTasks]);

    const handleTaskClick = async (task: CentralTask & { boardId: string; boardCreatedAt?: string }) => {
        await fetchBoard(task.boardId);
        onViewTask(task.id, task.boardId, task.boardCreatedAt);
    };

    if (!canViewAll) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <p className="text-zinc-500">You do not have access to the Central Board.</p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-white dark:bg-zinc-950 overflow-hidden">
            {/* Header */}
            <div className="shrink-0 border-b border-zinc-200 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-zinc-900 dark:to-indigo-900/20 px-6 py-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span className="text-sm font-bold">Back</span>
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50">{t('central_board')}</h1>
                        <p className="text-sm text-zinc-500">{t('central_board_desc')}</p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="shrink-0 border-b border-zinc-200 bg-zinc-50/50 dark:bg-zinc-900/50 px-6 py-3">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-zinc-500" />
                        <select
                            value={selectedDepartment}
                            onChange={(e) => setSelectedDepartment(e.target.value)}
                            className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200 focus:outline-none focus:border-indigo-500"
                        >
                            <option value="all">{t('all_departments_label')}</option>
                            {departments.map((dept) => (
                                <option key={dept.id} value={dept.id}>{dept.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">View:</span>
                        <button
                            onClick={() => setViewMode('kanban')}
                            className={`p-2 rounded-lg transition-colors ${viewMode === 'kanban' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800'}`}
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800'}`}
                        >
                            <List className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="text-xs font-semibold text-zinc-500">
                        {allTasks.length} {t('tasks_count')} | {boards.length} {t('boards_in_dept')}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-zinc-500">Loading...</div>
                    </div>
                ) : allTasks.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                            <div className="w-16 h-16 mx-auto mb-4 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                                <LayoutGrid className="w-8 h-8 text-zinc-400" />
                            </div>
                            <p className="text-zinc-500">{t('no_tasks_in_dept')}</p>
                        </div>
                    </div>
                ) : viewMode === 'kanban' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {['To Do', 'In Progress', 'Review', 'Done'].map((colName) => {
                            const colTasks = tasksByColumn.get(colName) || [];
                            return (
                                <div key={colName} className="flex flex-col bg-zinc-100/50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                    <div className="shrink-0 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-800/50 rounded-t-xl">
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-bold text-zinc-700 dark:text-zinc-300">{colName}</h3>
                                            <span className="rounded-full bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 text-xs font-bold text-zinc-600 dark:text-zinc-300">
                                                {colTasks.length}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[calc(100vh-320px)]">
                                        {colTasks.map((task) => (
                                            <div
                                                key={task.id}
                                                onClick={() => handleTaskClick(task as CentralTask & { boardId: string; boardCreatedAt?: string })}
                                                className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all"
                                            >
                                                <div className="flex items-start gap-2">
                                                    <div className={`shrink-0 w-2 h-2 rounded-full mt-2 ${
                                                        task.urgency >= 80 ? 'bg-red-500' :
                                                        task.urgency >= 50 ? 'bg-orange-500' :
                                                        'bg-blue-500'
                                                    }`} />
                                                    <div className="min-w-0 flex-1">
                                                        <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm line-clamp-2">
                                                            {task.title}
                                                        </h4>
                                                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                                                            <span className="rounded bg-zinc-100 dark:bg-zinc-700 px-1.5 py-0.5">
                                                                {task.boardName}
                                                            </span>
                                                            <span className="rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5">
                                                                {task.departmentName}
                                                            </span>
                                                        </div>
                                                        {task.due_date && (
                                                            <div className="mt-1.5 text-xs text-zinc-500">
                                                                Due: {new Date(task.due_date).toLocaleDateString()}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {colTasks.length === 0 && (
                                            <div className="text-center py-8 text-xs text-zinc-400">
                                                No tasks
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {allTasks.map((task) => (
                            <div
                                key={task.id}
                                onClick={() => handleTaskClick(task as CentralTask & { boardId: string; boardCreatedAt?: string })}
                                className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`shrink-0 w-3 h-3 rounded-full ${
                                        task.urgency >= 80 ? 'bg-red-500' :
                                        task.urgency >= 50 ? 'bg-orange-500' :
                                        'bg-blue-500'
                                    }`} />
                                    <div className="min-w-0 flex-1">
                                        <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">{task.title}</h4>
                                        {task.description && (
                                            <p className="text-xs text-zinc-500 mt-1 line-clamp-1">{task.description}</p>
                                        )}
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <div className="text-xs text-zinc-500">{task.column_title}</div>
                                        <div className="text-xs font-semibold text-zinc-600">{task.boardName}</div>
                                    </div>
                                    <div className="shrink-0 rounded-full bg-indigo-100 dark:bg-indigo-900/30 px-2 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                                        {task.departmentName}
                                    </div>
                                    {task.due_date && (
                                        <div className="shrink-0 text-xs text-zinc-500">
                                            {new Date(task.due_date).toLocaleDateString()}
                                        </div>
                                    )}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleTaskClick(task as CentralTask & { boardId: string; boardCreatedAt?: string });
                                        }}
                                        className="shrink-0 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors"
                                    >
                                        {t('view_task')}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function normalizeColumn(title: string): string {
    const normalized = title.trim().toLowerCase();
    if (normalized.includes('done') || normalized.includes('complete') || normalized.includes('finished')) return 'Done';
    if (normalized.includes('review') || normalized.includes('testing')) return 'Review';
    if (normalized.includes('progress') || normalized.includes('doing') || normalized.includes('working')) return 'In Progress';
    if (normalized.includes('todo') || normalized.includes('backlog') || normalized.includes('new') || normalized.includes('open')) return 'To Do';
    return title;
}
