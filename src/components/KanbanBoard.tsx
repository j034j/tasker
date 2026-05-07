import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { DndContext, type DragEndEvent, DragOverlay, type DragStartEvent, MouseSensor, TouchSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

import { TaskCard } from './TaskCard';
import { type Task, useStore } from '@/lib/store';
import { TaskModal } from './TaskModal';
import { TaskChainGraph } from './TaskChainGraph';
import { calculateTaskScore } from '@/lib/rankingEngine';
import { Tag, Archive, Building2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { api } from '@/lib/axios';

function DroppableColumn({ column, children }: { column: { id: string; title: string; tasks: Task[] }; children: React.ReactNode }) {
    const { setNodeRef } = useDroppable({
        id: column.id,
    });

    return (
        <div ref={setNodeRef} className="flex h-full min-h-[calc(100vh-12rem)] min-w-0 flex-col rounded-xl bg-muted/30 border border-border/50 backdrop-blur-sm overflow-hidden">
            {children}
        </div>
    );
}

interface KanbanBoardProps {
    sortByUrgency: boolean;
    setSortByUrgency: Dispatch<SetStateAction<boolean>>;
    focusedTaskId?: string | null;
    onFocusedTaskHandled?: () => void;
}

export function KanbanBoard({ sortByUrgency, setSortByUrgency, focusedTaskId = null, onFocusedTaskHandled }: KanbanBoardProps) {
    const { board, moveTask, fetchBoard, rankingWeights, showArchived, setShowArchived, updateBoard, currentUser } = useStore();
    const { t } = useLanguage();
    const [activeId, setActiveId] = useState<string | null>(null);
    const closedModalState = { isOpen: false, mode: 'create' as const };

    // Board Renaming State
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [titleInput, setTitleInput] = useState('');
    const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
    const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
    const [departmentInput, setDepartmentInput] = useState('');

    // Unified Modal State
    const [modalState, setModalState] = useState<{
        isOpen: boolean;
        mode: 'create' | 'edit';
        columnId?: string; // For create
        task?: Task; // For edit
    }>({ isOpen: false, mode: 'create' });
    const [tagFilter, setTagFilter] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(MouseSensor, {
            activationConstraint: {
                distance: 10,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 250,
                tolerance: 5,
            },
        })
    );

    useEffect(() => {
        if (board) {
            setSelectedDepartment(board.department_id || null);
            if (board.department_id) {
                setDepartmentInput('');
            }
            (async () => {
                try {
                    const orgId = board.org_id as string;
                    const { data } = await api.get(`/orgs/${orgId}/departments`);
                    setDepartments(Array.isArray(data?.departments) ? data.departments : []);
                } catch (err) {
                    console.error('Failed to load departments', err);
                }
            })();
        }
    }, [board, modalState.isOpen, modalState.mode, modalState.columnId, modalState.task?.id]);

    useEffect(() => {
        if (!board || !focusedTaskId) return;

        // Auto-open the modal if the task exists
        const taskToFocus = board.columns.flatMap(c => c.tasks).find(t => t.id === focusedTaskId);
        if (taskToFocus) {
            setModalState({ isOpen: true, mode: 'edit', task: taskToFocus });
        }

        const scrollTimeout = window.setTimeout(() => {
            const target = document.querySelector<HTMLElement>(`[data-task-id="${focusedTaskId}"]`);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 180);

        const clearTimeoutId = window.setTimeout(() => {
            onFocusedTaskHandled?.();
        }, 2600);

        return () => {
            window.clearTimeout(scrollTimeout);
            window.clearTimeout(clearTimeoutId);
        };
    }, [board, focusedTaskId, onFocusedTaskHandled]);

    if (!board) return <div className="p-8 text-center">Loading Board...</div>;

    const translateColumnTitle = (title: string) => {
        const lower = title.toLowerCase();
        if (lower === 'to do') return t('col_todo');
        if (lower === 'in progress') return t('col_progress');
        if (lower === 'review') return t('col_review');
        if (lower === 'done') return t('col_done');
        if (lower === 'blocked') return t('col_blocked');
        return title;
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        if (activeId === overId) return;

        const isOverColumn = board.columns.some(col => col.id === overId);
        let targetColumnId = '';

        if (isOverColumn) {
            targetColumnId = overId;
        } else {
            const column = board.columns.find(col => col.tasks.some(task => task.id === overId));
            if (column) targetColumnId = column.id;
        }

        if (targetColumnId) {
            moveTask(activeId, targetColumnId);
        }
    };

    const handleAddTask = (columnId: string) => {
        setModalState({ isOpen: true, mode: 'create', columnId });
    };

    const handleEditTask = (task: Task) => {
        setModalState({ isOpen: true, mode: 'edit', task });
    };

    const handleQuickMove = async (taskId: string, targetColumnId: string) => {
        await moveTask(taskId, targetColumnId);
    };

    const getQuickActionForColumn = (columnTitle: string) => {
        const title = columnTitle.toLowerCase();
        if (title.includes('to do') || title.includes('todo')) {
            return { show: true, label: 'Start', targetColumn: 'In Progress' };
        } else if (title.includes('in progress') || title.includes('progress')) {
            return { show: true, label: 'Complete', targetColumn: 'Done' };
        }
        return { show: false, label: '', targetColumn: '' };
    };

    const activeTask = activeId ? board.columns.flatMap(c => c.tasks).find(t => t.id === activeId) : null;

    const canEdit = currentUser?.id === board.created_by || currentUser?.role === 'admin' || currentUser?.role === 'org_super_admin' || currentUser?.role === 'super_admin' || currentUser?.role === 'dept_admin';

    const handleTitleSave = async () => {
        if (!titleInput.trim() || titleInput === board.name) {
            setIsEditingTitle(false);
            return;
        }
        await updateBoard(board.id, { name: titleInput });
        setIsEditingTitle(false);
    };

    const startEditingKey = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleTitleSave();
        if (e.key === 'Escape') setIsEditingTitle(false);
    };

    const handleDepartmentChange = async (deptId: string | null) => {
        if (!board) return;
        setSelectedDepartment(deptId);
        setDepartmentInput('');
        try {
            await updateBoard(board.id, { departmentId: deptId });
            fetchBoard(board.id);
        } catch (err) {
            console.error('Failed to update department', err);
        }
    };

    const handleCreateDepartment = async () => {
        if (!board || !departmentInput.trim()) return;
        if (departments.some(d => d.name.toLowerCase() === departmentInput.trim().toLowerCase())) return;

        try {
            const orgId = board.org_id as string;
            const res = await api.post(`/orgs/${orgId}/departments`, { name: departmentInput.trim() });
            const newDeptId = res.data?.id;
            if (newDeptId) {
                const newDept = { id: newDeptId, name: departmentInput.trim() };
                setDepartments(prev => [...prev, newDept]);
                await handleDepartmentChange(newDeptId);
            }
        } catch (err) {
            console.error('Failed to create department', err);
        }
    };

    return (
        <>
            <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div className="flex flex-col h-full w-full flex-1 min-w-0">
                    <div className="px-6 py-3 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700 flex items-center gap-3 flex-wrap">
                        <div className="flex flex-col">
                            {isEditingTitle ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        autoFocus
                                        value={titleInput}
                                        onChange={(e) => setTitleInput(e.target.value)}
                                        onKeyDown={startEditingKey}
                                        onBlur={handleTitleSave}
                                        className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 rounded px-2 py-1 outline-none border-2 border-indigo-500"
                                    />
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 group/title">
                                    <h2
                                        onClick={() => {
                                            if (canEdit) {
                                                setTitleInput(board.name);
                                                setIsEditingTitle(true);
                                            }
                                        }}
                                        className={`text-2xl font-bold text-zinc-900 dark:text-zinc-100 ${canEdit ? 'cursor-pointer hover:underline decoration-indigo-500/30 underline-offset-4' : ''}`}
                                        title={canEdit ? "Click to rename" : ""}
                                    >
                                        {board.name}
                                    </h2>
                                    {canEdit && (
                                        <button
                                            onClick={() => {
                                                setTitleInput(board.name);
                                                setIsEditingTitle(true);
                                            }}
                                            className="opacity-0 group-hover/title:opacity-100 p-1 text-zinc-400 hover:text-indigo-500 transition-opacity"
                                        >
                                            <Tag className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            )}
                            <div className="flex items-center gap-2 text-xs text-zinc-500">
                                {board.is_public ? (
                                    <span className="flex items-center gap-1 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full">
                                        🌍 Public
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 text-zinc-600 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                                        🔒 Private
                                    </span>
                                )}
                                {canEdit && (
                                    <button
                                        onClick={async () => {
                                            const newIsPublic = !board.is_public;
                                            await updateBoard(board.id, { isPublic: newIsPublic });
                                            fetchBoard(board.id);
                                        }}
                                        className="text-xs px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 text-zinc-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                        title="Toggle visibility"
                                    >
                                        {board.is_public ? 'Make Private' : 'Make Public'}
                                    </button>
                                )}
                                <span>•</span>
                                <span>{board.followers ? board.followers.split(',').filter(Boolean).length : 0} Members</span>
                                {currentUser?.department_id && (
                                    <>
                                        <span>•</span>
                                        <span className="text-indigo-600 dark:text-indigo-400 font-medium">Dept: {departments.find(d => d.id === currentUser.department_id)?.name || '—'}</span>
                                    </>
                                )}
                            </div>
                            {/* Department selector with create option */}
                            <div className="ml-4 flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-zinc-400" />
                                <input
                                    list="kanban-dept-list"
                                    value={departmentInput}
                                    onChange={async (e) => {
                                        setDepartmentInput(e.target.value);
                                        // Check if exact match
                                        const match = departments.find(d => d.name.toLowerCase() === e.target.value.toLowerCase());
                                        if (match) {
                                            setDepartmentInput(match.name);
                                            await handleDepartmentChange(match.id);
                                        }
                                    }}
                                    onKeyDown={async (e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            await handleCreateDepartment();
                                        }
                                    }}
                                    placeholder={selectedDepartment ? departments.find(d => d.id === selectedDepartment)?.name || 'Select department' : 'Assign department'}
                                    className="text-sm rounded px-2 py-1 border bg-white dark:bg-zinc-800 w-40"
                                />
                                <datalist id="kanban-dept-list">
                                    {departments.map(d => <option key={d.id} value={d.name} />)}
                                </datalist>
                                {canEdit && (
                                    <button
                                        onClick={handleCreateDepartment}
                                        disabled={!departmentInput.trim() || departments.some(d => d.name.toLowerCase() === departmentInput.trim().toLowerCase())}
                                        className="text-xs px-2 py-1 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 disabled:opacity-30 disabled:cursor-not-allowed font-medium"
                                        title="Create new department"
                                    >
                                        + New
                                    </button>
                                )}
                                {selectedDepartment && (
                                    <button
                                        onClick={() => handleDepartmentChange(null)}
                                        className="text-xs px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400"
                                        title="Remove department"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                        </div>
                        {tagFilter && (
                            <div className="flex items-center gap-2 ml-auto animate-in fade-in slide-in-from-left-4 duration-300">
                                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                    Filtering: <span className="text-indigo-600 dark:text-indigo-400 font-bold">{tagFilter}</span>
                                </span>
                                <button
                                    onClick={() => setTagFilter(null)}
                                    className="text-xs bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300 px-2 py-1 rounded-full transition-colors flex items-center gap-1"
                                >
                                    ✕ Clear
                                </button>
                            </div>
                        )}
                    </div>
                    {/* Daisy Chain Graph Section */}
                    {(focusedTaskId || tagFilter) && (
                        <div className="px-6">
                            <TaskChainGraph 
                                taskId={focusedTaskId || (tagFilter ? board.columns.flatMap(c => c.tasks).find(t => t.skills?.includes(tagFilter))?.id : null) || ''} 
                            />
                        </div>
                    )}

                    <div className="px-4 pt-2">
                        <div className="flex justify-end gap-2 pr-8 md:pr-10">
                            <button
                                onClick={() => setSortByUrgency((prev) => !prev)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${sortByUrgency
                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600'
                                    }`}
                            >
                                {sortByUrgency ? '🔥 Sorted by Urgency' : '📋 Default Order'}
                            </button>
                            <button
                                onClick={() => setShowArchived(!showArchived)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${showArchived
                                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                                    : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700'}`}
                            >
                                <Archive className="w-4 h-4" />
                                {t('show_archived')}
                            </button>
                        </div>
                    </div>

                    <div 
                        className="grid w-full gap-4 p-4 md:gap-5 md:p-5"
                        style={{ gridTemplateColumns: `repeat(${Math.max(1, board.columns.length)}, 1fr)` }}
                    >
                        {board.columns.map((column) => {
                            const quickAction = getQuickActionForColumn(column.title);
                            const targetColumn = board.columns.find(c => c.title.toLowerCase().includes(quickAction.targetColumn.toLowerCase()));

                            const filteredTasks = tagFilter
                                ? column.tasks.filter(t => t.skills && t.skills.split(',').map(s => s.trim()).includes(tagFilter))
                                : column.tasks;

                            const tasksWithScores = filteredTasks.map(task => ({
                                ...task,
                                priority_score: calculateTaskScore(task, rankingWeights)
                            }));

                            const sortedTasks = sortByUrgency
                                ? [...tasksWithScores].sort((a, b) => {
                                    if (b.priority_score !== a.priority_score) {
                                        return b.priority_score - a.priority_score;
                                    }
                                    return a.id.localeCompare(b.id);
                                })
                                : filteredTasks;

                            return (
                                <DroppableColumn key={column.id} column={column}>
                                    <div className="flex flex-col min-w-0">
                                        <div className="relative z-20 p-4 font-semibold text-sm flex justify-between items-center group/header bg-white/95 dark:bg-zinc-900/95 shrink-0">
                                            <div className="flex items-center justify-between flex-1 mr-4">
                                                <span className="font-bold">{translateColumnTitle(column.title)}</span>
                                                <span className="text-xs bg-zinc-200 dark:bg-zinc-700 px-2.5 py-1 rounded-full text-zinc-700 dark:text-zinc-300 font-semibold min-w-[24px] text-center">{column.tasks.length}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleAddTask(column.id);
                                                }}
                                                className="pointer-events-auto h-8 w-8 shrink-0 rounded-full border border-zinc-300 dark:border-zinc-600 flex items-center justify-center text-zinc-600 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-700 bg-white dark:bg-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all opacity-100 cursor-pointer shadow-sm"
                                                title={t('task_new')}
                                            >
                                                <span className="text-lg leading-none mb-0.5">+</span>
                                            </button>
                                        </div>

                                        <div className="relative z-0 p-3">
                                            <SortableContext items={sortedTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                                                {sortedTasks.map((task) => (
                                                    <TaskCard
                                                        key={task.id}
                                                        task={task}
                                                        isHighlighted={task.id === focusedTaskId}
                                                        onEdit={() => handleEditTask(task)}
                                                        onQuickMove={targetColumn ? (taskId) => handleQuickMove(taskId, targetColumn.id) : undefined}
                                                        showQuickAction={quickAction.show && !!targetColumn}
                                                        quickActionLabel={quickAction.label}
                                                    />
                                                ))}
                                            </SortableContext>
                                        </div>
                                    </div>
                                </DroppableColumn>
                            );
                        })}
                    </div>
                </div>
                <DragOverlay>
                    {activeTask ? (
                        <div className="opacity-90 rotate-2 cursor-grabbing scale-105 pointer-events-none">
                            <TaskCard task={activeTask} />
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>

            {modalState.isOpen && (
                <TaskModal
                    key={modalState.mode === 'edit' ? `edit-${modalState.task?.id}` : `create-${modalState.columnId}`}
                    task={modalState.mode === 'edit' ? modalState.task : null}
                    columnId={modalState.columnId}
                    onClose={() => setModalState(closedModalState)}
                    onSave={() => {
                        if (board) fetchBoard(board.id);
                    }}
                />
            )}
        </>
    );
}
