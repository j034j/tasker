import { useEffect } from 'react';
import { useStore } from '@/lib/store';

interface BoardsOverviewPageProps {
    weekStart: string;
}

export function BoardsOverviewPage({ weekStart }: BoardsOverviewPageProps) {
    const { orgId, reportingOverview, fetchReportingOverview } = useStore();

    useEffect(() => {
        if (!orgId) return;
        fetchReportingOverview(orgId, weekStart).catch(console.error);
    }, [orgId, weekStart, fetchReportingOverview]);

    if (!reportingOverview) {
        return <div className="p-6 text-sm text-zinc-500">Loading board overviews...</div>;
    }

    return (
        <div className="flex-1 overflow-y-auto p-6 bg-zinc-50 dark:bg-zinc-950 space-y-6">
            <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
                <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 mb-3">Organization Boards</h2>
                <div className="grid gap-3 md:grid-cols-2">
                    {reportingOverview.board_overview.map((board) => (
                        <div key={board.id} className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
                            <p className="font-semibold">{board.name}</p>
                            <p className="text-xs text-zinc-500">Visibility: {board.visibility}</p>
                            <p className="text-xs text-zinc-500">Tasks: {board.total_tasks} total, {board.done_tasks} done</p>
                            <p className="text-xs text-zinc-500">Participants: {board.participants.join(', ') || 'None'}</p>
                        </div>
                    ))}
                    {reportingOverview.board_overview.length === 0 && (
                        <p className="text-sm text-zinc-500">No boards found for this organization.</p>
                    )}
                </div>
            </section>

            <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
                <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100 mb-3">Public Boards Across Organizations</h3>
                <div className="space-y-2">
                    {reportingOverview.public_boards.map((board) => (
                        <div key={board.id} className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
                            <p className="font-semibold">{board.name}</p>
                            <p className="text-xs text-zinc-500">
                                Org: {board.org_name || board.org_id} | Creator: {board.creator_name || 'Unknown'}
                            </p>
                        </div>
                    ))}
                    {reportingOverview.public_boards.length === 0 && (
                        <p className="text-sm text-zinc-500">No public boards currently available.</p>
                    )}
                </div>
            </section>
        </div>
    );
}
