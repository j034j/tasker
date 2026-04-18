import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/Button';

interface OrgSuperAdminAccessPageProps {
    weekStart: string;
}

export function OrgSuperAdminAccessPage({ weekStart }: OrgSuperAdminAccessPageProps) {
    const {
        orgId,
        orgMembersOverview,
        fetchOrgMembersOverview,
        requestOrgSuperAdminPromotion,
        confirmOrgSuperAdminPromotion
    } = useStore();

    const [targetUserId, setTargetUserId] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [requestId, setRequestId] = useState('');
    const [approvalCode, setApprovalCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        if (!orgId) return;
        fetchOrgMembersOverview(orgId, weekStart).catch(console.error);
    }, [orgId, weekStart, fetchOrgMembersOverview]);

    const eligibleMembers = orgMembersOverview.filter(
        (member) => member.role !== 'org_super_admin' && member.role !== 'super_admin'
    );

    const handleRequest = async () => {
        if (!orgId || !targetUserId || !currentPassword) return;
        setLoading(true);
        setErrorMessage(null);
        setStatusMessage(null);
        try {
            const result = await requestOrgSuperAdminPromotion(orgId, targetUserId, currentPassword);
            setRequestId(result.requestId);
            setStatusMessage('Approval code sent to your notifications. Enter it to confirm.');
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string } } };
            setErrorMessage(err?.response?.data?.error || 'Failed to request super admin change.');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async () => {
        if (!orgId || !requestId || !approvalCode) return;
        setLoading(true);
        setErrorMessage(null);
        setStatusMessage(null);
        try {
            await confirmOrgSuperAdminPromotion(orgId, requestId, approvalCode);
            setStatusMessage('Organization super admin updated successfully.');
            setCurrentPassword('');
            setApprovalCode('');
            setRequestId('');
            await fetchOrgMembersOverview(orgId, weekStart);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string } } };
            setErrorMessage(err?.response?.data?.error || 'Failed to confirm super admin change.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-zinc-50 dark:bg-zinc-950">
            <div>
                <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100">Organization Super Admin Access</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Secure workflow: password re-authentication + one-time approval code.
                </p>
            </div>

            <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 space-y-4">
                <h3 className="font-bold">Step 1: Choose Active Member and Request Approval Code</h3>
                <select
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                >
                    <option value="">Select active member...</option>
                    {eligibleMembers.map((member) => (
                        <option key={member.id} value={member.id}>
                            {member.name} ({member.role}) - {member.skills || 'No skills listed'}
                        </option>
                    ))}
                </select>
                <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                />
                <Button onClick={handleRequest} disabled={loading || !targetUserId || !currentPassword}>
                    Request Approval Code
                </Button>
            </section>

            <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 space-y-4">
                <h3 className="font-bold">Step 2: Confirm with One-Time Approval Code</h3>
                <input
                    type="text"
                    value={requestId}
                    onChange={(e) => setRequestId(e.target.value)}
                    placeholder="Request ID"
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                />
                <input
                    type="text"
                    value={approvalCode}
                    onChange={(e) => setApprovalCode(e.target.value)}
                    placeholder="6-digit approval code"
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                />
                <Button onClick={handleConfirm} disabled={loading || !requestId || !approvalCode}>
                    Confirm Super Admin Transfer
                </Button>
                {statusMessage && <p className="text-sm text-green-600">{statusMessage}</p>}
                {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
            </section>

            <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
                <h3 className="font-bold mb-2">Organization Members: Full Profiles and Weekly Workload</h3>
                <div className="space-y-3">
                    {orgMembersOverview.map((member) => (
                        <div key={member.id} className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 bg-zinc-50/60 dark:bg-zinc-800/40">
                            <div className="grid md:grid-cols-2 gap-3 text-sm">
                                <div>
                                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">{member.name}</p>
                                    <p className="text-zinc-500">{member.email}</p>
                                    <p className="text-zinc-500">{member.phone_number || 'No phone'}</p>
                                </div>
                                <div>
                                    <p><span className="font-semibold">Role:</span> {member.role}</p>
                                    <p><span className="font-semibold">Skills:</span> {member.skills || '-'}</p>
                                    <p><span className="font-semibold">Location:</span> {member.location || '-'}</p>
                                    <p><span className="font-semibold">Recurring duties:</span> {member.recurring_duties?.length || 0}</p>
                                    <p><span className="font-semibold">Duty active now:</span> {member.recurring_duties_active_now?.length || 0}</p>
                                </div>
                            </div>

                            <div className="mt-3 text-xs text-zinc-600 dark:text-zinc-300">
                                <span className="font-semibold">Boards following:</span>{' '}
                                {member.followed_boards.length > 0
                                    ? member.followed_boards.map((board) => board.name).join(', ')
                                    : 'None'}
                            </div>

                            <div className="mt-4 grid md:grid-cols-3 gap-3">
                                <div className="rounded-md border border-zinc-200 dark:border-zinc-700 p-2 bg-white/80 dark:bg-zinc-900/60">
                                    <p className="text-xs font-semibold mb-1">Active right now ({member.current_tasks_now.length})</p>
                                    <div className="space-y-1">
                                        {member.current_tasks_now.slice(0, 6).map((task) => (
                                            <p key={task.id} className="text-xs">{task.title} • {task.status}</p>
                                        ))}
                                        {member.current_tasks_now.length === 0 && <p className="text-xs text-zinc-500">No active tasks</p>}
                                    </div>
                                </div>
                                <div className="rounded-md border border-zinc-200 dark:border-zinc-700 p-2 bg-white/80 dark:bg-zinc-900/60">
                                    <p className="text-xs font-semibold mb-1">Assigned this week ({member.assigned_tasks_week.length})</p>
                                    <div className="space-y-1">
                                        {member.assigned_tasks_week.slice(0, 6).map((task) => (
                                            <p key={task.id} className="text-xs">{task.title} • {task.board_name}</p>
                                        ))}
                                        {member.assigned_tasks_week.length === 0 && <p className="text-xs text-zinc-500">No assigned tasks</p>}
                                    </div>
                                </div>
                                <div className="rounded-md border border-zinc-200 dark:border-zinc-700 p-2 bg-white/80 dark:bg-zinc-900/60">
                                    <p className="text-xs font-semibold mb-1">Participating this week ({member.interested_tasks_week.length})</p>
                                    <div className="space-y-1">
                                        {member.interested_tasks_week.slice(0, 6).map((task) => (
                                            <p key={task.id} className="text-xs">{task.title} • {task.board_name}</p>
                                        ))}
                                        {member.interested_tasks_week.length === 0 && <p className="text-xs text-zinc-500">No participation tasks</p>}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 grid md:grid-cols-2 gap-3">
                                <div className="rounded-md border border-zinc-200 dark:border-zinc-700 p-2 bg-white/80 dark:bg-zinc-900/60">
                                    <p className="text-xs font-semibold mb-1">Recurring duties schedule</p>
                                    <div className="space-y-1">
                                        {(member.recurring_duties || []).slice(0, 6).map((duty) => (
                                            <p key={duty.id} className="text-xs">
                                                {duty.title} • {duty.cadence === 'weekly' ? `D${duty.dayOfWeek}` : 'Daily'} • {duty.startTime}-{duty.endTime} • {duty.location || 'No location'}
                                            </p>
                                        ))}
                                        {(member.recurring_duties || []).length === 0 && <p className="text-xs text-zinc-500">No recurring duties</p>}
                                    </div>
                                </div>
                                <div className="rounded-md border border-zinc-200 dark:border-zinc-700 p-2 bg-white/80 dark:bg-zinc-900/60">
                                    <p className="text-xs font-semibold mb-1">On duty now</p>
                                    <div className="space-y-1">
                                        {(member.recurring_duties_active_now || []).slice(0, 6).map((duty) => (
                                            <p key={duty.id} className="text-xs">
                                                {duty.title} • {duty.startTime}-{duty.endTime} • {duty.location || 'No location'}
                                            </p>
                                        ))}
                                        {(member.recurring_duties_active_now || []).length === 0 && <p className="text-xs text-zinc-500">No active duty in current time window</p>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    {orgMembersOverview.length === 0 && (
                        <div className="p-3 text-zinc-500 text-sm">No members found.</div>
                    )}
                </div>
            </section>
        </div>
    );
}
