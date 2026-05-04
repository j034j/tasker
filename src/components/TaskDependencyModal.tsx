import { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { useStore } from '@/lib/store';
import { useLanguage } from '@/contexts/LanguageContext';
import { DraggableModalWrapper } from './ui/DraggableModalWrapper';
import { Link, X, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

interface Task {
    id: string;
    title: string;
    column_id: string;
    board_id: string;
    board_name: string;
}

interface TaskDependency {
    id: string;
    parent_task_id: string;
    child_task_id: string;
    created_at?: string;
    parent_title: string;
    child_title: string;
    parent_board: string;
    child_board: string;
}

interface TaskDependencyModalProps {
    task: Task;
    isOpen: boolean;
    onClose: () => void;
}

export function TaskDependencyModal({ task, isOpen, onClose }: TaskDependencyModalProps) {
    const { orgId } = useStore();
    const { t } = useLanguage();
    const tt = t as (key: string) => string;
    const [dependencies, setDependencies] = useState<TaskDependency[]>([]);
    const [availableTasks, setAvailableTasks] = useState<Task[]>([]);
    const [selectedParentTask, setSelectedParentTask] = useState<string>('');
    const [selectedChildTask, setSelectedChildTask] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadDependencies = async () => {
        if (!task?.id) return;
        try {
            setLoading(true);
            const { fetchTaskDependencies } = useStore.getState();
            const deps = await fetchTaskDependencies(task.id);
            setDependencies(deps);
        } catch (err) {
            console.error('Failed to load dependencies', err);
        } finally {
            setLoading(false);
        }
    };

    const loadAvailableTasks = async () => {
        if (!orgId) return;
        try {
            const { fetchTasksForInvite } = useStore.getState();
            const tasksData = await fetchTasksForInvite(orgId);
            setAvailableTasks(tasksData.map(t => ({
                id: t.id,
                title: t.title,
                column_id: '',
                board_id: t.boardId,
                board_name: t.boardName
            })).filter(t => t.id !== task.id));
        } catch (err) {
            console.error('Failed to load available tasks', err);
        }
    };

    useEffect(() => {
        if (isOpen && task?.id) {
            loadDependencies();
            loadAvailableTasks();
        }
    }, [isOpen, task?.id, orgId]);

    const handleCreateDependency = async () => {
        const parentId = selectedParentTask || task.id;
        const childId = selectedChildTask || task.id;

        if (!parentId || !childId) return;
        if (parentId === childId) {
            setError(tt('dependencies_error_self'));
            return;
        }

        try {
            setCreating(true);
            setError(null);
            const { createTaskDependency } = useStore.getState();
            await createTaskDependency(parentId, childId);
            setSelectedParentTask('');
            setSelectedChildTask('');
            await loadDependencies();
        } catch (err: any) {
            console.error('Failed to create dependency', err);
            const msg = err.response?.data?.error || 'Failed to create dependency';
            setError(msg.includes('Circular') ? tt('dependencies_error_circular') : msg);
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteDependency = async (id: string) => {
        if (!confirm(tt('dependencies_remove_confirm'))) return;
        try {
            const { deleteTaskDependency } = useStore.getState();
            await deleteTaskDependency(id);
            await loadDependencies();
        } catch (err) {
            console.error('Failed to delete dependency', err);
        }
    };

    const getTaskDisplayName = (taskId: string) => {
        if (taskId === task.id) return `${task.title} (${tt('current_badge')})`;
        const taskObj = availableTasks.find(t => t.id === taskId);
        return taskObj ? `${taskObj.title} (${taskObj.board_name})` : taskId;
    };

    if (!isOpen) return null;

    return (
        <DraggableModalWrapper isOpen={isOpen} onClose={onClose} className="w-full max-w-2xl">
            <div className="flex flex-col h-full bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="modal-handle cursor-move px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <Link className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                            {tt('dependencies_title')}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <X className="w-5 h-5 text-zinc-500" />
                    </button>
                </div>

                <div className="p-6 space-y-8 overflow-y-auto max-h-[70vh]">
                    {/* Error Alert */}
                    {error && (
                        <div className="flex items-center gap-3 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 animate-in fade-in slide-in-from-top-2">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <p className="text-sm font-medium">{error}</p>
                        </div>
                    )}

                    {/* Current Dependencies Section */}
                    <section>
                        <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-4">
                            {tt('dependencies_current')}
                        </h3>
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
                                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                                <span className="text-sm font-medium">Loading dependencies...</span>
                            </div>
                        ) : dependencies.length === 0 ? (
                            <div className="text-center py-10 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
                                <Link className="w-10 h-10 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
                                <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">
                                    {tt('dependencies_no_deps')}
                                </p>
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {dependencies.map((dep) => (
                                    <div key={dep.id} className="group flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:border-blue-300 dark:hover:border-blue-800 transition-all">
                                        <div className="flex items-center gap-4 flex-1">
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-bold text-zinc-400 uppercase mb-1">Pre-requisite</div>
                                                <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                                    {getTaskDisplayName(dep.parent_task_id)}
                                                </div>
                                            </div>
                                            <div className="px-2 py-1 bg-zinc-200 dark:bg-zinc-700 rounded-lg">
                                                <ArrowRight className="w-4 h-4 text-zinc-500" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-bold text-zinc-400 uppercase mb-1">Dependent</div>
                                                <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                                    {getTaskDisplayName(dep.child_task_id)}
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteDependency(dep.id)}
                                            className="ml-4 p-2 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Add New Section */}
                    <section className="p-6 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl">
                        <h3 className="text-sm font-black uppercase tracking-widest text-blue-700 dark:text-blue-400 mb-6">
                            {tt('dependencies_add_new')}
                        </h3>
                        <p className="mb-4 text-xs font-semibold text-blue-700/80 dark:text-blue-300/80">
                            Linked tasks need a realistic duration estimate, such as 2 hours, 3 days, or 1 week, so chain timing can be calculated.
                        </p>
                        <div className="grid gap-6">
                            <div className="grid sm:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="block text-xs font-black text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                                        {tt('dependencies_parent_label')}
                                    </label>
                                    <select
                                        value={selectedParentTask}
                                        onChange={(e) => setSelectedParentTask(e.target.value)}
                                        className="w-full p-3 bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    >
                                        <option value="">{tt('dependencies_select_placeholder')}</option>
                                        {availableTasks.map((t) => (
                                            <option key={t.id} value={t.id}>
                                                {t.title} ({t.board_name})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-xs font-black text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                                        {tt('dependencies_child_label')}
                                    </label>
                                    <select
                                        value={selectedChildTask}
                                        onChange={(e) => setSelectedChildTask(e.target.value)}
                                        className="w-full p-3 bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    >
                                        <option value="">{tt('dependencies_select_placeholder')}</option>
                                        {availableTasks.map((t) => (
                                            <option key={t.id} value={t.id}>
                                                {t.title} ({t.board_name})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <Button
                                onClick={handleCreateDependency}
                                disabled={creating || (!selectedParentTask && !selectedChildTask)}
                                className="w-full h-12 text-base font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25 transition-all"
                            >
                                {creating ? (
                                    <div className="flex items-center gap-2">
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span>{tt('dependencies_creating')}</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <Link className="w-5 h-5" />
                                        <span>{tt('dependencies_create_btn')}</span>
                                    </div>
                                )}
                            </Button>
                        </div>
                    </section>
                </div>

                <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex justify-end">
                    <Button variant="outline" onClick={onClose} className="px-8 h-10 font-bold border-2">
                        {tt('cancel')}
                    </Button>
                </div>
            </div>
        </DraggableModalWrapper>
    );
}
