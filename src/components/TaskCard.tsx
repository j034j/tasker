import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Tag, Archive, RotateCcw, X, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getWeatherIcon } from '@/lib/weatherService';
import { useStore, type Task } from '@/lib/store';

interface TaskCardProps {
    task: Task;
    isHighlighted?: boolean;
    onEdit?: () => void;
    onQuickMove?: (taskId: string) => void;
    showQuickAction?: boolean;
    quickActionLabel?: string;
}

export function TaskCard({ task, isHighlighted = false, onEdit, onQuickMove, showQuickAction, quickActionLabel }: TaskCardProps) {
    const { t } = useLanguage();
    const { deleteTask, toggleArchiveTask, toggleTaskInterest, currentUser } = useStore();
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

    const effectiveUrgency = task.admin_override_urgency ?? ((task.admin_override_priority || 0) > 0 ? Math.max(task.urgency, 80) : task.urgency);
    const priority = getPriorityDetails(effectiveUrgency);
    const hasAdminOverride = (task.admin_override_priority || 0) > 0 || task.admin_override_urgency !== null && task.admin_override_urgency !== undefined;

    // Format Date
    const formatDate = (dateUnparsed?: string) => {
        if (!dateUnparsed) return 'No Date';
        try {
            const date = new Date(dateUnparsed);
            return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
        } catch {
            return dateUnparsed;
        }
    };

    // Deduplicate Tags
    const tags = task.skills ? Array.from(new Set(task.skills.split(',').map(s => s.trim()).filter(Boolean))) : [];

    // Interest Check
    const interestedIds = task.interested_users ? task.interested_users.split(',').filter(Boolean) : [];
    const isInterested = currentUser && interestedIds.includes(currentUser.id);

    const getInterestText = () => {
        if (interestedIds.length === 0) return null;
        if (isInterested) {
            if (interestedIds.length === 1) return t('interest_you_only') || 'You are interested';
            return `${t('interest_you') || 'You'} + ${interestedIds.length - 1} ${t('interest_others') || 'others'}`;
        }
        return `${interestedIds.length} ${t('interest_people') || 'people interested'}`;
    };

    return (
        <div
            ref={setNodeRef}
            data-task-id={task.id}
            style={style}
            {...attributes}
            {...listeners}
            onClick={onEdit}
            className={`group relative mb-4 w-full max-w-full overflow-hidden rounded-xl bg-card text-card-foreground shadow-sm border transition-all duration-300 cursor-grab active:cursor-grabbing px-4 pt-4 pb-0 flex flex-col gap-0.5 ${isHighlighted
                ? 'border-indigo-500 ring-2 ring-indigo-200 shadow-lg shadow-indigo-200/60 dark:ring-indigo-900/60'
                : 'border-border/50 hover:shadow-md hover:border-primary/50'
                }`}
        >
            {/* Header: Priority and Trend */}
            <div className="flex justify-between items-start">
                <div className="flex flex-wrap gap-2">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${priority.bg} ${priority.text} border border-current/10`}>
                        {priority.label}
                    </span>
                    {hasAdminOverride && (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            ADMIN OVERRIDE
                        </span>
                    )}
                    {!!task.weather_sensitive && (
                        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800" title={t('weather_sensitive')}>
                            🌦️
                        </span>
                    )}
                    {task.blocked_by && task.blocked_by.length > 0 && (
                        <span 
                            className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center gap-1"
                            title={`Blocked by: ${task.blocked_by.map(b => b.title).join(', ')}`}
                        >
                            <AlertCircle className="w-3 h-3" /> BLOCKED
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
                    <p className="text-sm text-muted-foreground line-clamp-2 break-words">
                        {task.description}
                    </p>
                )}
            </div>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent w-full my-1" />

            {/* Footer: Date, Tags */}
            <div className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium min-w-0">
                    <div className="flex items-start gap-2 min-w-0 flex-wrap">
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

                {/* Bottom Row: Tags + Actions */}
                <div className="flex flex-wrap items-end justify-between gap-1 pb-1">
                    <div className="flex flex-wrap gap-1.5">
                        {tags.length > 0 ? (
                            tags.map((tag, i) => (
                                <span key={i} className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-1 rounded flex items-center gap-1">
                                    <Tag className="w-3 h-3" />
                                    {tag}
                                </span>
                            ))
                        ) : (
                            <span className="text-[10px] text-muted-foreground italic">No tags</span>
                        )}
                    </div>

                    <div className="flex items-center gap-1.5 ml-auto">
                        <div className="flex items-center gap-1 mr-2">
                            {interestedIds.length > 0 && (
                                <span className="text-[10px] text-muted-foreground font-medium hidden sm:inline-block">
                                    {getInterestText()}
                                </span>
                            )}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleTaskInterest(task.id);
                                }}
                                className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border transition-all font-bold ${isInterested
                                    ? 'bg-pink-50 text-pink-600 border-pink-200 hover:bg-pink-100'
                                    : 'bg-transparent text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                                    }`}
                                title={isInterested ? "Not interested" : "I'm Interested"}
                            >
                                <span className={isInterested ? 'scale-110' : 'grayscale opacity-50'}>❤️</span>
                                {isInterested ? 'Interested' : 'Interest'}
                            </button>
                        </div>

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
