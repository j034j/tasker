import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { calculateTaskScore } from '@/lib/rankingEngine';
import { api } from '@/lib/axios';
import { DraggableModalWrapper } from './ui/DraggableModalWrapper';
import { Button } from './ui/Button';

export function CentralView({ orgId, onClose }: { orgId: string; onClose: () => void }) {
    const { rankingWeights } = useStore();
    const [boards, setBoards] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!orgId) return;
        (async () => {
            setLoading(true);
            try {
                const { data } = await api.get(`/orgs/${orgId}/central-view`);
                // Data shape: { success: true, boards: [{ board, columns: [{ id,title, tasks: [...] }] }] }
                const mapped = Array.isArray(data?.boards) ? data.boards.map((b: any) => ({
                    board: b.board,
                    columns: Array.isArray(b.columns) ? b.columns.map((c: any) => ({
                        ...c,
                        tasks: Array.isArray(c.tasks) ? c.tasks.map((t: any) => ({
                            ...t,
                            priority_score: calculateTaskScore(t, rankingWeights as any)
                        })) : []
                    })) : []
                })) : [];
                setBoards(mapped);
            } catch (err) {
                console.error('Failed to load central view', err);
            } finally {
                setLoading(false);
            }
        })();
    }, [orgId, rankingWeights]);

    return (
        <DraggableModalWrapper isOpen={true} onClose={onClose} className="w-[96vw] max-w-6xl bg-white dark:bg-zinc-900">
            <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold">Organization Central View</h2>
                    <div className="flex items-center gap-2">
                        <Button onClick={onClose} variant="ghost">Close</Button>
                    </div>
                </div>

                {loading && <p>Loading...</p>}

                <div className="space-y-6">
                    {boards.map(b => (
                        <div key={b.board.id} className="rounded-xl border p-4 bg-zinc-50 dark:bg-zinc-800/30">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <div className="font-semibold">{b.board.name} <span className="text-xs text-zinc-500">({b.board.id})</span></div>
                                    <div className="text-xs text-zinc-500">Department: {b.board.department_id || '—'}</div>
                                </div>
                                <div className="text-sm text-zinc-500">Columns: {b.columns.length}</div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {b.columns.map((c: any) => (
                                    <div key={c.id} className="p-2 bg-white dark:bg-zinc-900 rounded-lg border">
                                        <div className="font-semibold text-sm mb-2">{c.title}</div>
                                        <div className="space-y-2">
                                            {c.tasks.map((t: any) => (
                                                <div key={t.id} className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <div className="font-medium">{t.title}</div>
                                                            <div className="text-xs text-zinc-500">Assigned: {t.assigned_to || '—'}</div>
                                                        </div>
                                                        <div className="text-sm font-bold text-indigo-600">{Math.round(Number(t.priority_score) || 0)}</div>
                                                    </div>
                                                    <div className="text-xs text-zinc-500 mt-1">{t.project_location || ''}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    {!loading && boards.length === 0 && <p className="text-zinc-500">No boards found.</p>}
                </div>
            </div>
        </DraggableModalWrapper>
    );
}

export default CentralView;
