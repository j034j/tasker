import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Tag, Archive, RotateCcw, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getWeatherIcon } from '@/lib/weatherService';
import { useStore } from '@/lib/store';

interface Task {
    id: string;
    title: string;
    description?: string;
    urgency: number;
    people_required?: number;
    skills?: string;
    due_date?: string;
    priority_score: number;
    weather_sensitive?: boolean;
    archived?: boolean;
    project_duration?: string;
    project_location?: string;
    weather_code?: number;
}

interface TaskCardProps {
    task: Task;
    onEdit?: () => void;
    onQuickMove?: (taskId: string) => void;
    showQuickAction?: boolean;
    quickActionLabel?: string;
}

export function TaskCard({ task, onEdit, onQuickMove, showQuickAction, quickActionLabel }: TaskCardProps) {
    const { t } = useLanguage();
    const { deleteTask, toggleArchiveTask } = useStore();
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: task.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        touchAction: 'none',
    };

    // Helper for Priority Badge
    const getPriorityDetails = (urgency: number) => {
        if (urgency >= 80) return { label: t('high'), bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-400' };
        if (urgency >= 50) return { label: t('medium'), bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400' };
        return { label: t('low'), bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400' };
    };

    const priority = getPriorityDetails(task.urgency);

    // Format Date
    const formatDate = (dateUnparsed?: string) => {
        if (!dateUnparsed) return 'No Date';
        try {
            const date = new Date(dateUnparsed);
            return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
        } catch (e) {
            return dateUnparsed;
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={onEdit}
            className="group relative mb-4 rounded-xl bg-card text-card-foreground shadow-sm border border-border/50 hover:shadow-md hover:border-primary/50 transition-all duration-300 cursor-grab active:cursor-grabbing p-5 flex flex-col gap-3"
        >
            {/* Header: Priority and Trend */}
            <div className="flex justify-between items-start">
                <div className="flex flex-wrap gap-2">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${priority.bg} ${priority.text} border border-current/10`}>
                        {priority.label}
                    </span>
                    {!!task.weather_sensitive && (
                        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800" title={t('weather_sensitive')}>
                            🌦️
                        </span>
                    )}
                </div>
            </div>

            {/* Body: Title and Description */}
            <div>
                <h3 className="font-bold text-base mb-1 leading-snug group-hover:text-primary transition-colors">
                    {task.title}
                </h3>
                {task.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                        {task.description}
                    </p>
                )}
            </div>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent w-full my-1" />

            {/* Footer: Date, Tags */}
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                    <div className="flex items-start gap-4">
                        <div className="flex items-start gap-2">
                            <span className="opacity-70 mt-1">📅</span>
                            <div className="flex flex-col">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground/70 leading-tight">{t('due_date_label')}</span>
                                <span className="font-medium leading-tight">{formatDate(task.due_date)}</span>
                            </div>
                        </div>
                        {task.project_duration && (
                            <div className="flex items-start gap-2">
                                <span className="opacity-70 mt-1">⏳</span>
                                <div className="flex flex-col">
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground/70 leading-tight">Duration</span>
                                    <span className="font-medium leading-tight">{task.project_duration}</span>
                                </div>
                            </div>
                        )}
                        {task.project_location && (
                            <div className="flex items-start gap-2">
                                <span className="opacity-70 mt-1">
                                    {task.weather_code !== undefined && task.weather_code !== null
                                        ? getWeatherIcon(task.weather_code)
                                        : '📍'
                                    }
                                </span>
                                <div className="flex flex-col">
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground/70 leading-tight">Location</span>
                                    <span className="font-medium leading-tight flex items-center gap-1">
                                        {task.project_location}
                                        {task.weather_code !== undefined && task.weather_code !== null && (
                                            <span>{getWeatherIcon(task.weather_code)}</span>
                                        )}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                    {task.skills?.split(',').map(s => s.trim()).filter(Boolean).map((tag, i) => (
                        <span key={i} className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-1 rounded flex items-center gap-1">
                            <Tag className="w-3 h-3" />
                            {tag}
                        </span>
                    ))}

                    <div className="ml-auto flex items-center gap-1.5">
                        {/* Quick Move (Mini) */}
                        {showQuickAction && onQuickMove && !task.archived && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onQuickMove(task.id);
                                }}
                                className="mr-1 text-[10px] px-2 py-1 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200 hover:bg-zinc-200 transition-colors font-bold shadow-sm"
                                title={t('move_action')}
                            >
                                {quickActionLabel || '→'}
                            </button>
                        )}

                        {/* Archive / Restore */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleArchiveTask(task.id, !task.archived);
                            }}
                            className={`p-1.5 rounded-full transition-colors ${task.archived
                                ? 'bg-green-100 text-green-600 hover:bg-green-200'
                                : 'bg-transparent text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800'
                                }`}
                            title={task.archived ? t('restore_action') : t('archive_action')}
                        >
                            {task.archived ? <RotateCcw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                        </button>

                        {/* Delete - RED X */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(t('delete_confirm'))) {
                                    deleteTask(task.id);
                                }
                            }}
                            className="p-1.5 rounded-full bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 dark:bg-red-900/10 dark:text-red-400 dark:hover:text-red-300 transition-colors border border-red-100 dark:border-red-900/30"
                            title="Delete"
                        >
                            <X className="w-3.5 h-3.5 stroke-[3px]" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
