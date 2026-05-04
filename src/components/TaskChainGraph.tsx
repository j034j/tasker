import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { ArrowRight, BellRing, CheckCircle2, Circle, Link as LinkIcon, Loader2, X, Layers } from 'lucide-react';

interface TaskNode {
    id: string;
    title: string;
    is_done: boolean;
    board_name: string;
    department_name?: string | null;
    estimated_duration_label?: string | null;
    priority_score?: number;
}

interface Edge {
    id: string;
    from: string;
    to: string;
}

export function TaskChainGraph({ taskId, onClose }: { taskId: string; onClose?: () => void }) {
    const { fetchTaskChain, alertTaskChainDepartments } = useStore();
    const [data, setData] = useState<{ tasks: TaskNode[], edges: Edge[], departments?: { name: string; taskCount: number }[], estimatedTotalLabel?: string | null, missingDurationTaskIds?: string[] } | null>(null);
    const [loading, setLoading] = useState(true);
    const [alerting, setAlerting] = useState(false);

    useEffect(() => {
        const load = async () => {
            if (!taskId) return;
            try {
                setLoading(true);
                const res = await fetchTaskChain(taskId);
                setData(res);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [taskId, fetchTaskChain]);

    const handleAlertDepartments = async () => {
        if (!taskId) return;
        setAlerting(true);
        try {
            await alertTaskChainDepartments(taskId);
        } finally {
            setAlerting(false);
        }
    };

    if (loading) return (
        <div className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm border border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl p-8 flex flex-col items-center justify-center animate-pulse mb-6">
            <Layers className="w-8 h-8 text-zinc-300 mb-2" />
            <span className="text-sm font-medium text-zinc-400">Loading task chain...</span>
        </div>
    );

    if (!data || data.tasks.length <= 1) return null;

    // Build a horizontal sequence
    const taskMap = new Map(data.tasks.map(t => [t.id, t]));
    const sortedTasks: TaskNode[] = [];
    const visited = new Set<string>();

    // Find roots (tasks with no incoming edges in THIS set)
    const incomingCount = new Map<string, number>();
    data.tasks.forEach(t => incomingCount.set(t.id, 0));
    data.edges.forEach(e => {
        incomingCount.set(e.to, (incomingCount.get(e.to) || 0) + 1);
    });

    const roots = data.tasks.filter(t => incomingCount.get(t.id) === 0).map(t => t.id);
    if (roots.length === 0 && data.tasks.length > 0) roots.push(data.tasks[0].id);

    const queue = [...roots];
    while (queue.length > 0) {
        const id = queue.shift()!;
        if (visited.has(id)) continue;
        visited.add(id);
        const task = taskMap.get(id);
        if (task) sortedTasks.push(task);

        const next = data.edges.filter(e => e.from === id).map(e => e.to);
        queue.push(...next);
    }

    return (
        <div className="relative bg-gradient-to-br from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-2xl mb-8 overflow-hidden group/graph animate-in slide-in-from-top-4 duration-500">
            {/* Background Decorative Element */}
            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl group-hover/graph:bg-indigo-500/10 transition-colors" />
            
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg">
                        <LinkIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-black tracking-tight text-zinc-900 dark:text-zinc-100">
                            Workflow Daisy-Chain
                        </h3>
                        <p className="text-xs text-zinc-500 font-medium">
                            Cross-departmental task dependencies{data.estimatedTotalLabel ? ` | ETA ${data.estimatedTotalLabel}` : ''}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleAlertDepartments}
                        disabled={alerting}
                        className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 transition-all hover:border-indigo-300 hover:bg-indigo-100 disabled:opacity-60 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300"
                        title="Alert all connected department admins and task participants"
                    >
                        {alerting ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
                        Alert chain
                    </button>
                    {onClose && (
                        <button 
                            onClick={onClose} 
                            className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-all text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {!!data.departments?.length && (
                <div className="mb-5 flex flex-wrap gap-2">
                    {data.departments.map((department) => (
                        <span key={department.name} className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                            {department.name} ({department.taskCount})
                        </span>
                    ))}
                    {!!data.missingDurationTaskIds?.length && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                            {data.missingDurationTaskIds.length} task estimates missing
                        </span>
                    )}
                </div>
            )}
            
            <div className="flex items-center gap-0 overflow-x-auto pb-6 pt-2 px-2 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800">
                {sortedTasks.map((task, index) => (
                    <div key={task.id} className="flex items-center shrink-0">
                        <div className={`relative flex flex-col items-center p-5 rounded-2xl border-2 transition-all duration-300 ${
                            task.id === taskId 
                                ? 'bg-white dark:bg-zinc-800 border-indigo-500 shadow-xl shadow-indigo-500/10 scale-105 z-10' 
                                : 'bg-zinc-100/50 dark:bg-zinc-800/40 border-transparent hover:border-zinc-300 dark:hover:border-zinc-700'
                        }`}>
                            {task.id === taskId && (
                                <div className="absolute -top-3 px-3 py-0.5 bg-indigo-500 text-white text-[10px] font-black rounded-full shadow-lg animate-bounce">
                                    CURRENT
                                </div>
                            )}
                            
                            <div className="flex items-center gap-2 mb-3">
                                {task.is_done ? (
                                    <div className="bg-green-100 dark:bg-green-900/30 p-1 rounded-full">
                                        <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                                    </div>
                                ) : (
                                    <div className="bg-zinc-200 dark:bg-zinc-700 p-1 rounded-full">
                                        <Circle className="w-4 h-4 text-zinc-400" />
                                    </div>
                                )}
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
                                    {task.department_name || task.board_name}
                                </span>
                            </div>
                            
                            <span className={`text-sm font-bold max-w-[150px] text-center line-clamp-2 leading-snug ${
                                task.id === taskId ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-600 dark:text-zinc-400'
                            }`}>
                                {task.title}
                            </span>
                            <span className="mt-2 text-[10px] font-semibold text-zinc-500">
                                {task.estimated_duration_label || 'No estimate'} | P{Math.round(Number(task.priority_score) || 0)}
                            </span>

                            {/* Connection Dots */}
                            {index > 0 && (
                                <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 rounded-full" />
                            )}
                            {index < sortedTasks.length - 1 && (
                                <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 rounded-full" />
                            )}
                        </div>
                        
                        {index < sortedTasks.length - 1 && (
                            <div className="w-12 h-0.5 bg-gradient-to-r from-zinc-200 via-indigo-300 to-zinc-200 dark:from-zinc-800 dark:via-indigo-900 dark:to-zinc-800 relative">
                                <ArrowRight className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 dark:text-indigo-600" />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
