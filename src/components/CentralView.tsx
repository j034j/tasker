import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { api } from '@/lib/axios';
import { DraggableModalWrapper } from './ui/DraggableModalWrapper';
import { useLanguage } from '@/contexts/LanguageContext';
import { Building2, LayoutGrid, List, Layers, Edit3 } from 'lucide-react';

interface CentralViewProps {
    orgId: string;
    onClose: () => void;
    isFullPage?: boolean;
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
    review?: string | null;
}

interface CentralColumn {
    id: string;
    title: string;
    tasks: CentralTask[];
}

interface CentralBoardData {
    id: string;
    name: string;
    created_at?: string;
    department_id?: string | null;
    department_name?: string | null;
}

interface CentralBoard {
    board?: CentralBoardData;
    id?: string;
    name?: string;
    created_at?: string;
    department_id?: string | null;
    department_name?: string | null;
    columns: CentralColumn[];
}

export function CentralView({ orgId, onClose, isFullPage = false }: CentralViewProps) {
    const { t } = useLanguage();
    const { fetchBoard } = useStore();
    const [allBoards, setAllBoards] = useState<CentralBoard[]>([]);
    const [boards, setBoards] = useState<CentralBoard[]>([]);
    const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
    const [selectedBoard, setSelectedBoard] = useState<string>('all');
    const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
    const [editingReview, setEditingReview] = useState<string | null>(null);
    const [reviewText, setReviewText] = useState<string>('');
    const [savingReview, setSavingReview] = useState(false);

    useEffect(() => {
        if (selectedDepartment === 'all' && selectedBoard === 'all') {
            setViewMode('kanban');
        }
    }, [selectedDepartment, selectedBoard]);

    useEffect(() => {
        if (!orgId) return;
        setLoading(true);
        console.log(`[CentralView] Loading central view for org ${orgId}, dept: ${selectedDepartment}`);

        const fetchAll = async () => {
            try {
                const [deptRes, centralRes] = await Promise.all([
                    api.get(`/orgs/${orgId}/departments`),
                    api.get(`/orgs/${orgId}/central-view`)
                ]);
                
                const deptData = deptRes.data.departments || [];
                const centralData = centralRes.data.boards || [];
                
                console.log('[CentralView] Departments loaded:', deptData.length);
                console.log('[CentralView] Boards loaded from API:', centralData.length);
                
                setDepartments(deptData);
                setAllBoards(centralData);
                
                if (selectedDepartment !== 'all') {
                    const filteredBoards = centralData.filter((b: any) => {
                        const boardInfo = b.board || b;
                        return boardInfo.department_id === selectedDepartment;
                    });
                    setBoards(filteredBoards);
                } else {
                    setBoards(centralData);
                }
            } catch (err) {
                console.error('[CentralView] Failed to load central view:', err);
                setDepartments([]);
                setBoards([]);
                setAllBoards([]);
            } finally {
                setLoading(false);
            }
        };

        fetchAll();
    }, [orgId, selectedDepartment]);

    const refreshData = () => {
        if (!orgId) return;
        setLoading(true);
        
        Promise.all([
            api.get(`/orgs/${orgId}/departments`),
            api.get(`/orgs/${orgId}/central-view`)
        ]).then(([deptRes, centralRes]) => {
            const deptData = deptRes.data.departments || [];
            const centralData = centralRes.data.boards || [];
            
            setDepartments(deptData);
            setAllBoards(centralData);
            setBoards(selectedDepartment !== 'all' 
                ? centralData.filter((b: any) => (b.board || b).department_id === selectedDepartment)
                : centralData
            );
        }).catch(console.error)
          .finally(() => setLoading(false));
    };

    const allTasks = boards.flatMap((boardWrapper) => {
        const board = boardWrapper.board || boardWrapper;
        if (selectedBoard !== 'all' && board.id !== selectedBoard) {
            return [];
        }
        const columns = boardWrapper.columns || [];
        return columns.flatMap((col: any) =>
            (col.tasks || []).map((task: any) => ({
                ...task,
                boardId: board.id,
                boardName: board.name || 'Unknown',
                boardCreatedAt: board.created_at,
                departmentName: board.department_name || 'Unassigned'
            }))
        );
    });

    const tasksByColumn = new Map<string, typeof allTasks>();
    ['To Do', 'In Progress', 'Done', 'Review'].forEach(col => tasksByColumn.set(col, []));
    for (const task of allTasks) {
        const colName = normalizeColumn(task.column_title);
        if (tasksByColumn.has(colName)) {
            tasksByColumn.get(colName)!.push(task);
        } else {
            if (!tasksByColumn.has('Other')) {
                tasksByColumn.set('Other', []);
            }
            tasksByColumn.get('Other')!.push(task);
        }
    }

    console.log('[CentralView] Task distribution:', Array.from(tasksByColumn.entries()).map(([col, tasks]) => `${col}: ${tasks.length}`).join(', '));

    const totalTaskCount = allTasks.length;
    const totalBoardCount = boards.length;

    const handleTaskClick = async (task: CentralTask & { boardId: string; boardCreatedAt?: string }) => {
        await fetchBoard(task.boardId);
        window.location.href = `/?board=${task.boardId}&task=${task.id}`;
    };

    const handleEditReview = (task: CentralTask) => {
        setEditingReview(task.id);
        setReviewText(task.review || '');
    };

    const handleSaveReview = async (taskId: string) => {
        if (!orgId) return;
        setSavingReview(true);
        try {
            await api.put(`/tasks/${taskId}`, { review: reviewText });
            setBoards(boards.map(b => ({
                ...b,
                columns: b.columns.map(col => ({
                    ...col,
                    tasks: col.tasks.map(t => t.id === taskId ? { ...t, review: reviewText } : t)
                }))
            })));
            setEditingReview(null);
            setReviewText('');
        } catch (err) {
            console.error('Failed to save review:', err);
        } finally {
            setSavingReview(false);
        }
    };

    const handleCancelReview = () => {
        setEditingReview(null);
        setReviewText('');
    };

    const renderKanbanColumn = (colName: string, colTasks: typeof allTasks) => {
        const colColors: Record<string, string> = {
            'To Do': 'from-blue-500 to-blue-600',
            'In Progress': 'from-amber-500 to-amber-600',
            'Done': 'from-green-500 to-green-600',
            'Review': 'from-purple-500 to-purple-600',
            'Other': 'from-zinc-500 to-zinc-600'
        };

        return (
            <div key={colName} className="flex flex-col bg-zinc-100/70 dark:bg-zinc-900/70 rounded-xl border border-zinc-200 dark:border-zinc-800 flex-shrink-0 w-72">
                <div className="shrink-0 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/50 rounded-t-xl">
                    <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${colColors[colName] || 'bg-zinc-500'}`} />
                        <h3 className="font-bold text-zinc-700 dark:text-zinc-300">{colName}</h3>
                        <span className="ml-auto rounded-full bg-zinc-200 dark:bg-zinc-700 px-2.5 py-0.5 text-xs font-bold text-zinc-600 dark:text-zinc-300">
                            {colTasks.length}
                        </span>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3 max-h-[calc(100vh-200px)]">
                    {colName === 'Review' && (
                        <div className="mb-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                            <div className="flex items-center gap-2 mb-2">
                                <Edit3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                <span className="text-xs font-bold text-purple-700 dark:text-purple-300">Add Review Notes</span>
                            </div>
                            <textarea
                                placeholder="Enter review notes for tasks in this column..."
                                className="w-full px-3 py-2 text-sm rounded-lg border border-purple-200 dark:border-purple-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                                rows={2}
                                onChange={(e) => {
                                    const note = e.target.value;
                                    if (colTasks.length > 0 && editingReview === null) {
                                        setEditingReview(colTasks[0].id);
                                        setReviewText(note);
                                    } else if (editingReview) {
                                        setReviewText(note);
                                    }
                                }}
                            />
                        </div>
                    )}
                    {colTasks.map((task) => (
                        <div
                            key={task.id}
                            onClick={() => handleTaskClick(task as CentralTask & { boardId: string; boardCreatedAt?: string })}
                            className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 cursor-pointer hover:border-indigo-400 hover:shadow-lg transition-all group"
                        >
                            <div className="flex items-start gap-3">
                                <div className={`shrink-0 w-3 h-3 rounded-full mt-1 ${
                                    task.urgency >= 80 ? 'bg-red-500 animate-pulse' :
                                    task.urgency >= 50 ? 'bg-orange-500' :
                                    'bg-blue-400'
                                }`} />
                                <div className="min-w-0 flex-1">
                                    <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                        {task.title}
                                    </h4>
                                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
                                        <span className="rounded bg-zinc-100 dark:bg-zinc-700 px-1.5 py-0.5 font-medium">
                                            {task.boardName}
                                        </span>
                                        <span className="rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 font-medium">
                                            {task.departmentName}
                                        </span>
                                    </div>
                                    {task.due_date && (
                                        <div className="mt-2 flex items-center gap-1 text-[11px] text-zinc-500">
                                            <span className="font-medium">Due:</span>
                                            <span className={new Date(task.due_date) < new Date() ? 'text-red-500 font-bold' : ''}>
                                                {new Date(task.due_date).toLocaleDateString()}
                                            </span>
                                        </div>
                                    )}
                                    {task.priority_score > 0 && (
                                        <div className="mt-1.5 flex items-center gap-1">
                                            <div className="flex-1 h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${task.priority_score >= 80 ? 'bg-red-500' : task.priority_score >= 50 ? 'bg-orange-500' : 'bg-blue-500'}`}
                                                    style={{ width: `${Math.min(100, task.priority_score)}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] text-zinc-400 font-medium">{task.priority_score}</span>
                                        </div>
                                    )}
                                    {colName === 'Review' && (
                                        <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700" onClick={(e) => e.stopPropagation()}>
                                            {editingReview === task.id ? (
                                                <div className="space-y-2">
                                                    <textarea
                                                        value={reviewText}
                                                        onChange={(e) => setReviewText(e.target.value)}
                                                        placeholder="Enter review notes..."
                                                        className="w-full px-2 py-1.5 text-xs rounded border border-purple-300 dark:border-purple-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 resize-none focus:outline-none focus:ring-1 focus:ring-purple-500"
                                                        rows={2}
                                                    />
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => handleSaveReview(task.id)}
                                                            disabled={savingReview}
                                                            className="px-2 py-1 text-xs font-bold rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                                                        >
                                                            {savingReview ? 'Saving...' : 'Save'}
                                                        </button>
                                                        <button
                                                            onClick={handleCancelReview}
                                                            className="px-2 py-1 text-xs font-bold rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleEditReview(task)}
                                                    className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                                                >
                                                    <Edit3 className="w-3 h-3" />
                                                    {task.review ? 'Edit Review' : 'Add Review'}
                                                </button>
                                            )}
                                            {task.review && editingReview !== task.id && (
                                                <div className="mt-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded text-xs text-purple-800 dark:text-purple-200 italic">
                                                    "{task.review}"
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    {colTasks.length === 0 && (
                        <div className="text-center py-8 text-xs text-zinc-400 italic">
                            No tasks in this column
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderListView = () => (
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
    );

    const renderContent = () => {
        if (loading) {
            return (
                <div className="flex items-center justify-center h-full">
                    <div className="text-zinc-500">Loading...</div>
                </div>
            );
        }

        if (allTasks.length === 0) {
            return (
                <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                        <div className="w-16 h-16 mx-auto mb-4 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                            <LayoutGrid className="w-8 h-8 text-zinc-400" />
                        </div>
                        <p className="text-zinc-500">{t('no_tasks_in_dept')}</p>
                    </div>
                </div>
            );
        }

        if (viewMode === 'kanban') {
            const columns = [...['To Do', 'In Progress', 'Done', 'Review'], ...(tasksByColumn.has('Other') ? ['Other'] : [])];
            const colColors: Record<string, string> = {
                'To Do': 'from-blue-500 to-blue-600',
                'In Progress': 'from-amber-500 to-amber-600',
                'Done': 'from-green-500 to-green-600',
                'Review': 'from-purple-500 to-purple-600',
                'Other': 'from-zinc-500 to-zinc-600'
            };
            
            if (isFullPage) {
                return (
                    <div className="flex flex-1 gap-4 p-4 min-h-0" style={{ height: 'calc(100vh - 180px)' }}>
                        {columns.map((colName) => {
                            const colTasks = tasksByColumn.get(colName) || [];
                            return (
                                <div key={colName} className="flex flex-col flex-1 min-w-0 bg-zinc-100/70 dark:bg-zinc-900/70 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                    <div className="shrink-0 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/50 rounded-t-xl">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${colColors[colName] || 'bg-zinc-500'}`} />
                                            <h3 className="font-bold text-zinc-700 dark:text-zinc-300">{colName}</h3>
                                            <span className="ml-auto rounded-full bg-zinc-200 dark:bg-zinc-700 px-2.5 py-0.5 text-xs font-bold text-zinc-600 dark:text-zinc-300">
                                                {colTasks.length}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                                        {colName === 'Review' && (
                                            <div className="mb-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Edit3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                                    <span className="text-xs font-bold text-purple-700 dark:text-purple-300">Add Review Notes</span>
                                                </div>
                                                <textarea
                                                    placeholder="Enter review notes for tasks in this column..."
                                                    className="w-full px-3 py-2 text-sm rounded-lg border border-purple-200 dark:border-purple-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                    rows={2}
                                                    onChange={(e) => {
                                                        const note = e.target.value;
                                                        if (colTasks.length > 0 && editingReview === null) {
                                                            setEditingReview(colTasks[0].id);
                                                            setReviewText(note);
                                                        } else if (editingReview) {
                                                            setReviewText(note);
                                                        }
                                                    }}
                                                />
                                            </div>
                                        )}
                                        {colTasks.map((task) => (
                                            <div
                                                key={task.id}
                                                onClick={() => handleTaskClick(task as CentralTask & { boardId: string; boardCreatedAt?: string })}
                                                className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 cursor-pointer hover:border-indigo-400 hover:shadow-lg transition-all group"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={`shrink-0 w-3 h-3 rounded-full mt-1 ${
                                                        task.urgency >= 80 ? 'bg-red-500 animate-pulse' :
                                                        task.urgency >= 50 ? 'bg-orange-500' :
                                                        'bg-blue-400'
                                                    }`} />
                                                    <div className="min-w-0 flex-1">
                                                        <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                                            {task.title}
                                                        </h4>
                                                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
                                                            <span className="rounded bg-zinc-100 dark:bg-zinc-700 px-1.5 py-0.5 font-medium">
                                                                {task.boardName}
                                                            </span>
                                                            <span className="rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 font-medium">
                                                                {task.departmentName}
                                                            </span>
                                                        </div>
                                                        {task.due_date && (
                                                            <div className="mt-2 flex items-center gap-1 text-[11px] text-zinc-500">
                                                                <span className="font-medium">Due:</span>
                                                                <span className={new Date(task.due_date) < new Date() ? 'text-red-500 font-bold' : ''}>
                                                                    {new Date(task.due_date).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {task.priority_score > 0 && (
                                                            <div className="mt-1.5 flex items-center gap-1">
                                                                <div className="flex-1 h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                                                                    <div
                                                                        className={`h-full rounded-full ${task.priority_score >= 80 ? 'bg-red-500' : task.priority_score >= 50 ? 'bg-orange-500' : 'bg-blue-500'}`}
                                                                        style={{ width: `${Math.min(100, task.priority_score)}%` }}
                                                                    />
                                                                </div>
                                                                <span className="text-[10px] text-zinc-400 font-medium">{task.priority_score}</span>
                                                            </div>
                                                        )}
                                                        {colName === 'Review' && (
                                                            <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700" onClick={(e) => e.stopPropagation()}>
                                                                {editingReview === task.id ? (
                                                                    <div className="space-y-2">
                                                                        <textarea
                                                                            value={reviewText}
                                                                            onChange={(e) => setReviewText(e.target.value)}
                                                                            placeholder="Enter review notes..."
                                                                            className="w-full px-2 py-1.5 text-xs rounded border border-purple-300 dark:border-purple-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 resize-none focus:outline-none focus:ring-1 focus:ring-purple-500"
                                                                            rows={2}
                                                                        />
                                                                        <div className="flex gap-1">
                                                                            <button
                                                                                onClick={() => handleSaveReview(task.id)}
                                                                                disabled={savingReview}
                                                                                className="px-2 py-1 text-xs font-bold rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                                                                            >
                                                                                {savingReview ? 'Saving...' : 'Save'}
                                                                            </button>
                                                                            <button
                                                                                onClick={handleCancelReview}
                                                                                className="px-2 py-1 text-xs font-bold rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600"
                                                                            >
                                                                                Cancel
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => handleEditReview(task)}
                                                                        className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                                                                    >
                                                                        <Edit3 className="w-3 h-3" />
                                                                        {task.review ? 'Edit Review' : 'Add Review'}
                                                                    </button>
                                                                )}
                                                                {task.review && editingReview !== task.id && (
                                                                    <div className="mt-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded text-xs text-purple-800 dark:text-purple-200 italic">
                                                                        "{task.review}"
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {colTasks.length === 0 && (
                                            <div className="text-center py-8 text-xs text-zinc-400 italic">
                                                No tasks in this column
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                );
            }
            
            return (
                <div className="flex gap-4 overflow-x-auto pb-4">
                    {columns.map((colName) => {
                        const colTasks = tasksByColumn.get(colName) || [];
                        return renderKanbanColumn(colName, colTasks);
                    })}
                </div>
            );
        }

        return renderListView();
    };

    const renderHeader = () => (
        <div className="shrink-0 border-b border-zinc-200 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-zinc-900 dark:to-indigo-900/20 px-6 py-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        {t('central_board')}
                        {selectedDepartment === 'all' && selectedBoard === 'all' && (
                            <span className="text-sm font-normal text-indigo-600 dark:text-indigo-400">(All Departments Combined)</span>
                        )}
                        {selectedDepartment !== 'all' && (
                            <span className="text-sm font-normal text-indigo-600 dark:text-indigo-400">
                                ({departments.find(d => d.id === selectedDepartment)?.name || 'Department'})
                            </span>
                        )}
                    </h2>
                    <p className="text-sm text-zinc-500">
                        {viewMode === 'kanban' ? '📋 Kanban Board' : '📝 List View'} • {totalTaskCount} tasks • {totalBoardCount} boards
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {!isFullPage && (
                        <button onClick={onClose} className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-sm font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700">
                            Close
                        </button>
                    )}
                </div>
            </div>
        </div>
    );

    const renderFilters = () => (
        <div className="shrink-0 border-b border-zinc-200 bg-zinc-50/50 dark:bg-zinc-900/50 px-6 py-3">
            <div className="flex flex-wrap items-center gap-4">
                <button
                    onClick={() => {
                        setSelectedDepartment('all');
                        setSelectedBoard('all');
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                        selectedDepartment === 'all' && selectedBoard === 'all'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/50'
                    }`}
                >
                    <Layers className="w-4 h-4" />
                    {t('combine_all') || 'Combine All'}
                </button>

                <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-zinc-500" />
                    <select
                        value={selectedDepartment}
                        onChange={(e) => {
                            setSelectedDepartment(e.target.value);
                            setSelectedBoard('all');
                        }}
                        className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200 focus:outline-none focus:border-indigo-500"
                    >
                        <option value="all">{t('all_departments_label') || 'All Departments'}</option>
                        {departments.map((dept) => (
                            <option key={dept.id} value={dept.id}>{dept.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4 text-zinc-500" />
                    <select
                        value={selectedBoard}
                        onChange={(e) => setSelectedBoard(e.target.value)}
                        className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200 focus:outline-none focus:border-indigo-500"
                    >
                        <option value="all">All Boards</option>
                        {allBoards.map((b) => {
                            const boardInfo = b.board || b;
                            return (
                                <option key={boardInfo.id} value={boardInfo.id}>
                                    {boardInfo.name} ({boardInfo.department_name || 'No Dept'})
                                </option>
                            );
                        })}
                    </select>
                </div>

                {selectedDepartment === 'all' && selectedBoard === 'all' && (
                    <div className="flex flex-wrap items-center gap-2">
                        {departments.map((dept) => {
                            const deptBoards = allBoards.filter(b => {
                                const boardInfo = b.board || b;
                                return boardInfo.department_id === dept.id;
                            });
                            const deptTasks = deptBoards.reduce((sum, b) => {
                                const cols = b.columns || [];
                                return sum + cols.reduce((s: number, c: any) => s + (c.tasks?.length || 0), 0);
                            }, 0);
                            return (
                                <span key={dept.id} className="rounded-full bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 text-[10px] font-semibold text-indigo-600 dark:text-indigo-300">
                                    {dept.name}: {deptTasks} tasks
                                </span>
                            );
                        })}
                    </div>
                )}

                <div className="flex items-center gap-2 ml-auto">
                    <div className="px-3 py-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                        {viewMode === 'kanban' ? '📋 Kanban' : '📝 List'}
                    </div>
                    <button
                        onClick={refreshData}
                        className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors"
                    >
                        🔄 Refresh
                    </button>
                    <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
                        <button
                            onClick={() => setViewMode('kanban')}
                            className={`p-2 rounded-md transition-colors ${viewMode === 'kanban' ? 'bg-indigo-500 text-white shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
                            title="Kanban View"
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-indigo-500 text-white shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
                            title="List View"
                        >
                            <List className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="text-xs font-semibold text-zinc-500">
                    {totalTaskCount} {t('tasks_count')} | {totalBoardCount} {t('boards_in_dept')}
                </div>
            </div>
        </div>
    );

    if (isFullPage) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
                {renderHeader()}
                {renderFilters()}
                <div className="flex-1 overflow-auto p-6">
                    {renderContent()}
                </div>
            </div>
        );
    }

    return (
        <DraggableModalWrapper isOpen={true} onClose={onClose} className="w-[96vw] max-w-7xl bg-white dark:bg-zinc-900 max-h-[90vh]">
            <div className="flex flex-col max-h-[90vh]">
                {renderHeader()}
                {renderFilters()}
                <div className="flex-1 overflow-auto p-6">
                    {renderContent()}
                </div>
            </div>
        </DraggableModalWrapper>
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
