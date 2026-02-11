import { useState } from 'react';
import { DndContext, type DragEndEvent, DragOverlay, type DragStartEvent, MouseSensor, TouchSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

import { TaskCard } from './TaskCard';
import { type Task, useStore } from '@/lib/store';
import { TaskModal } from './TaskModal';
import { calculateTaskScore } from '@/lib/rankingEngine';
import { Tag, Archive } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

function DroppableColumn({ column, children }: { column: { id: string; title: string; tasks: Task[] }; children: React.ReactNode }) {
    const { setNodeRef } = useDroppable({
        id: column.id,
    });

    return (
        <div ref={setNodeRef} className="flex max-h-full flex-1 flex-col rounded-xl bg-muted/30 border border-border/50 min-w-[320px] backdrop-blur-sm">
            {children}
        </div>
    );
}

export function KanbanBoard() {
    const { board, moveTask, fetchBoard, rankingWeights, showArchived, setShowArchived } = useStore();
    const { t } = useLanguage();
    const [activeId, setActiveId] = useState<string | null>(null);

    // Unified Modal State
    const [modalState, setModalState] = useState<{
        isOpen: boolean;
        mode: 'create' | 'edit';
        columnId?: string; // For create
        task?: Task; // For edit
    }>({ isOpen: false, mode: 'create' });

    const [sortByUrgency, setSortByUrgency] = useState(true);
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

    return (
        <>
            <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div className="flex flex-col h-full w-full flex-1">
                    <div className="px-6 py-3 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center">
                        <h2 className="text-lg font-semibold">{t('app_title')} View</h2>
                        <button
                            onClick={() => setSortByUrgency(!sortByUrgency)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${sortByUrgency
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600'
                                }`}
                        >
                            {sortByUrgency ? '🔥 Sorted by Urgency' : '📋 Default Order'}
                        </button>

                        <button
                            onClick={() => setShowArchived(!showArchived)}
                            className={`ml-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${showArchived
                                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                                : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700'}`}
                        >
                            <Archive className="w-4 h-4" />
                            {t('show_archived')}
                        </button>
                        {tagFilter && (
                            <div className="flex items-center gap-2 ml-4 animate-in fade-in slide-in-from-left-4 duration-300">
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

                    <div className="flex h-full w-full gap-6 p-6 overflow-x-auto items-start">
                        {board.columns.map((column) => {
                            const quickAction = getQuickActionForColumn(column.title);
                            const targetColumn = board.columns.find(c => c.title.toLowerCase().includes(quickAction.targetColumn.toLowerCase()));

                            // Filter tasks by tag if selected
                            const filteredTasks = tagFilter
                                ? column.tasks.filter(t => t.skills && t.skills.split(',').map(s => s.trim()).includes(tagFilter))
                                : column.tasks;

                            // Calculate scores dynamically
                            const tasksWithScores = filteredTasks.map(task => ({
                                ...task,
                                priority_score: calculateTaskScore(task, rankingWeights)
                            }));

                            // Sort by Priority Score
                            // If weights change, this re-runs and re-orders
                            const sortedTasks = [...tasksWithScores].sort((a, b) => {
                                // Higher score first
                                if (b.priority_score !== a.priority_score) {
                                    return b.priority_score - a.priority_score;
                                }
                                return a.id.localeCompare(b.id);
                            });

                            return (
                                <DroppableColumn key={column.id} column={column}>
                                    <div className="p-4 font-semibold text-sm flex justify-between items-center group/header">
                                        <div className="flex items-center justify-between flex-1 mr-4">
                                            <span className="font-bold">{translateColumnTitle(column.title)}</span>
                                            <span className="text-xs bg-zinc-200 dark:bg-zinc-700 px-2.5 py-1 rounded-full text-zinc-700 dark:text-zinc-300 font-semibold min-w-[24px] text-center">{column.tasks.length}</span>
                                        </div>
                                        <button
                                            onClick={() => handleAddTask(column.id)}
                                            className="w-6 h-6 rounded-full border border-zinc-300 dark:border-zinc-600 flex items-center justify-center text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-700 bg-white dark:bg-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all opacity-40 group-hover/header:opacity-100"
                                            title={t('task_new')}
                                        >
                                            <span className="text-lg leading-none mb-0.5">+</span>
                                        </button>
                                    </div>

                                    <div className="flex-1 p-3 overflow-y-auto">
                                        <SortableContext items={sortedTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                                            {sortedTasks.map((task) => (
                                                <TaskCard
                                                    key={task.id}
                                                    task={task}
                                                    onEdit={() => handleEditTask(task)}
                                                    onQuickMove={targetColumn ? (taskId) => handleQuickMove(taskId, targetColumn.id) : undefined}
                                                    showQuickAction={quickAction.show && !!targetColumn}
                                                    quickActionLabel={quickAction.label}
                                                />
                                            ))}
                                        </SortableContext>
                                    </div>

                                    <div className="p-3 border-t border-zinc-200 dark:border-zinc-700">
                                        {/* Column Tag Cloud */}
                                        <div className="flex flex-wrap gap-1.5 min-h-[24px]">
                                            {Array.from(new Set(column.tasks.flatMap(t => t.skills ? t.skills.split(',').map(s => s.trim()) : []))).filter(Boolean).map((tag, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => setTagFilter(tag)}
                                                    className={`text-[10px] px-2 py-1 rounded-full border transition-all flex items-center gap-1 ${tagFilter === tag
                                                        ? 'bg-primary/20 text-primary border-primary/50 ring-2 ring-primary/20'
                                                        : 'bg-background hover:bg-muted text-muted-foreground border-border hover:border-primary/50 hover:text-primary'
                                                        }`}
                                                >
                                                    <Tag className="w-3 h-3" />
                                                    {tag}
                                                </button>
                                            ))}
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
                    task={modalState.mode === 'edit' ? modalState.task : null}
                    columnId={modalState.columnId}
                    onClose={() => setModalState({ ...modalState, isOpen: false })}
                    onSave={() => {
                        if (board) fetchBoard(board.id);
                    }}
                />
            )}
        </>
    );
}
