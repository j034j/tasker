import { useEffect, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { api } from '@/lib/axios';
import { Button } from '@/components/ui/Button';

type JsPdfModule = typeof import('jspdf');
type JsPdfInstance = InstanceType<JsPdfModule['jsPDF']>;

const loadJsPdf = () => import('jspdf');

interface ReportingSystemPageProps {
    weekStart: string;
    onWeekChange: (weekStart: string) => void;
    onOpenWeeklyTasks: () => void;
    onOpenBoardsOverview: () => void;
}

export function ReportingSystemPage({
    weekStart,
    onWeekChange,
    onOpenWeeklyTasks,
    onOpenBoardsOverview
}: ReportingSystemPageProps) {
    const { orgId, orgName, reportingOverview, fetchReportingOverview, orgMembersOverview, fetchOrgMembersOverview, currentUser } = useStore();
    const canViewMembers = currentUser?.role === 'admin' || currentUser?.role === 'org_super_admin' || currentUser?.role === 'super_admin' || currentUser?.role === 'dept_admin';

    const analytics = useMemo(() => {
        if (!reportingOverview) {
            return {
                totalProjects: 0,
                activeProjects: 0,
                completedProjects: 0,
                throughputCompletedTasks: 0,
                overdueOpenTasks: 0,
                onTimeCompletionRate: 0,
                averagePriority: 0,
                statusCounts: { not_started: 0, in_progress: 0, completed: 0 },
                boardPipeline: [] as { name: string; todo: number; inProgress: number; done: number; total: number }[],
                memberLoad: [] as { name: string; activeNow: number; assignedWeek: number; interestedWeek: number }[],
                locationDistribution: [] as { location: string; count: number }[],
                recurringDutyTotal: 0,
                recurringDutyActiveNow: 0,
                membersWithRecurringDuties: 0
            };
        }

        const weeklyTasks = reportingOverview.weekly_tasks || [];
        const today = new Date().toISOString().slice(0, 10);
        const completedTasks = weeklyTasks.filter((task) => task.status === 'completed');
        const completedWithDueDate = completedTasks.filter((task) => Boolean(task.due_date));
        const completedOnTime = completedWithDueDate.filter((task) => Boolean(task.completed_at && task.due_date && task.completed_at <= task.due_date));
        const overdueOpenTasks = weeklyTasks.filter((task) => task.status !== 'completed' && Boolean(task.due_date && task.due_date < today)).length;
        const totalPriority = weeklyTasks.reduce((sum, task) => sum + (Number(task.priority_score) || 0), 0);

        const statusCounts = weeklyTasks.reduce((acc, task) => {
            if (task.status === 'completed') acc.completed += 1;
            else if (task.status === 'in_progress') acc.in_progress += 1;
            else acc.not_started += 1;
            return acc;
        }, { not_started: 0, in_progress: 0, completed: 0 });

        const boardPipeline = (reportingOverview.board_overview || [])
            .map((board) => ({
                name: board.name,
                todo: Number(board.todo_tasks) || 0,
                inProgress: Number(board.in_progress_tasks) || 0,
                done: Number(board.done_tasks) || 0,
                total: Number(board.total_tasks) || 0
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 8);

        const memberLoad = (orgMembersOverview || [])
            .map((member) => ({
                name: member.name,
                activeNow: member.current_tasks_now?.length || 0,
                assignedWeek: member.assigned_tasks_week?.length || 0,
                interestedWeek: member.interested_tasks_week?.length || 0
            }))
            .sort((a, b) => b.activeNow - a.activeNow)
            .slice(0, 10);

        const locationMap = new Map<string, number>();
        for (const task of weeklyTasks) {
            const key = (task.location || 'Unspecified').trim() || 'Unspecified';
            locationMap.set(key, (locationMap.get(key) || 0) + 1);
        }
        const locationDistribution = Array.from(locationMap.entries())
            .map(([location, count]) => ({ location, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8);

        const recurringDutyTotal = orgMembersOverview.reduce((sum, member) => sum + (member.recurring_duties?.length || 0), 0);
        const recurringDutyActiveNow = orgMembersOverview.reduce((sum, member) => sum + (member.recurring_duties_active_now?.length || 0), 0);
        const membersWithRecurringDuties = orgMembersOverview.filter((member) => (member.recurring_duties?.length || 0) > 0).length;

        return {
            totalProjects: reportingOverview.board_overview?.length || 0,
            activeProjects: reportingOverview.active_projects?.length || 0,
            completedProjects: reportingOverview.completed_projects_week?.length || 0,
            throughputCompletedTasks: completedTasks.length,
            overdueOpenTasks,
            onTimeCompletionRate: completedWithDueDate.length > 0
                ? Math.round((completedOnTime.length / completedWithDueDate.length) * 100)
                : 0,
            averagePriority: weeklyTasks.length > 0 ? Math.round(totalPriority / weeklyTasks.length) : 0,
            statusCounts,
            boardPipeline,
            memberLoad,
            locationDistribution,
            recurringDutyTotal,
            recurringDutyActiveNow,
            membersWithRecurringDuties
        };
    }, [reportingOverview, orgMembersOverview]);

    const buildReportLines = () => {
        if (!reportingOverview) return [] as string[];
        const lines: string[] = [];
        lines.push('Tasker Reporting System');
        lines.push(`Week window: ${reportingOverview.week_start} to ${reportingOverview.week_end}`);
        lines.push('');
        lines.push('Executive KPI Summary');
        lines.push(`- Total projects: ${analytics.totalProjects}`);
        lines.push(`- Active projects: ${analytics.activeProjects}`);
        lines.push(`- Completed projects (week): ${analytics.completedProjects}`);
        lines.push(`- Completed tasks throughput: ${analytics.throughputCompletedTasks}`);
        lines.push(`- Overdue open tasks: ${analytics.overdueOpenTasks}`);
        lines.push(`- On-time completion rate: ${analytics.onTimeCompletionRate}%`);
        lines.push(`- Average priority score: ${analytics.averagePriority}`);
        lines.push('');
        lines.push('Task Status Distribution');
        lines.push(`- Not started: ${analytics.statusCounts.not_started}`);
        lines.push(`- In progress: ${analytics.statusCounts.in_progress}`);
        lines.push(`- Completed: ${analytics.statusCounts.completed}`);
        lines.push('');
        lines.push('Board Pipeline Overview');
        for (const board of analytics.boardPipeline) {
            lines.push(`- ${board.name}: To Do ${board.todo}, In Progress ${board.inProgress}, Completed ${board.done}`);
        }
        lines.push('');
        lines.push('Workload Snapshot');
        for (const member of analytics.memberLoad) {
            lines.push(`- ${member.name}: Active now ${member.activeNow}, Assigned week ${member.assignedWeek}, Interested week ${member.interestedWeek}`);
        }
        lines.push('');
        lines.push('Location Distribution');
        for (const location of analytics.locationDistribution) {
            lines.push(`- ${location.location}: ${location.count} tasks`);
        }
        lines.push('');
        lines.push('Recurring Operations');
        lines.push(`- Total recurring duties: ${analytics.recurringDutyTotal}`);
        lines.push(`- Duties active now: ${analytics.recurringDutyActiveNow}`);
        lines.push(`- Members with recurring duties: ${analytics.membersWithRecurringDuties}`);
        lines.push('');
        lines.push('Active Projects');
        for (const project of reportingOverview.active_projects) {
            lines.push(`- ${project.name} | Progress ${project.done_tasks}/${project.total_tasks} | People: ${project.participants.join(', ') || 'Unassigned'} | Where: ${project.locations.join(', ') || 'No location'}`);
        }
        lines.push('');
        lines.push('Yet To Start Projects (Priority Ranked)');
        for (const project of reportingOverview.not_started_projects) {
            lines.push(`- #${project.rank} ${project.name} | ${project.priority_explanation || ''}`);
        }
        lines.push('');
        lines.push('Completed Projects (This Week)');
        for (const project of reportingOverview.completed_projects_week) {
            lines.push(`- ${project.name} | Completed on: ${project.completed_on || 'N/A'}`);
        }
        if (canViewMembers) {
            lines.push('');
            lines.push('Organization Members');
            for (const member of orgMembersOverview) {
                lines.push(`- ${member.name} (${member.role}) | Skills: ${member.skills || '-'} | Location: ${member.location || '-'} | Recurring: ${member.recurring_duties?.length || 0} | Duty now: ${member.recurring_duties_active_now?.length || 0} | Active now: ${member.current_tasks_now?.length || 0}`);
            }
        }
        return lines;
    };

    const buildReportDocHtml = () => {
        if (!reportingOverview) return '';
        const generatedAt = new Date().toLocaleString();
        const reportId = `TR-${reportingOverview.week_start}-${reportingOverview.week_end}`;
        const memberRows = canViewMembers
            ? orgMembersOverview.map((member) => `
                <tr>
                    <td>${member.name}</td>
                    <td>${member.role}</td>
                    <td>${member.skills || '-'}</td>
                    <td>${member.location || '-'}</td>
                    <td>${member.recurring_duties?.length || 0}</td>
                    <td>${member.recurring_duties_active_now?.length || 0}</td>
                    <td>${member.current_tasks_now?.length || 0}</td>
                </tr>
            `).join('')
            : '';

        return `
            <html>
            <head>
                <meta charset="utf-8">
                <title>Tasker Report</title>
                <style>
                    body { font-family: Arial, sans-serif; color: #111827; line-height: 1.4; }
                    h1, h2, h3 { margin: 0 0 8px; }
                    .section { margin-top: 18px; }
                    .kpi-grid { display: table; width: 100%; table-layout: fixed; }
                    .kpi-cell { display: table-cell; border: 1px solid #d1d5db; padding: 10px; vertical-align: top; }
                    .kpi-label { font-size: 12px; color: #4b5563; }
                    .kpi-value { font-size: 20px; font-weight: 700; margin-top: 4px; }
                    table { border-collapse: collapse; width: 100%; margin-top: 8px; }
                    th, td { border: 1px solid #d1d5db; padding: 6px; font-size: 12px; text-align: left; }
                    th { background: #f3f4f6; }
                    ul { margin: 6px 0 0 18px; padding: 0; }
                    li { margin: 2px 0; font-size: 12px; }
                </style>
            </head>
            <body>
                <h1>Tasker Reporting System</h1>
                <p><strong>Organization:</strong> ${orgName || 'N/A'}</p>
                <p><strong>Report ID:</strong> ${reportId}</p>
                <p><strong>Week window:</strong> ${reportingOverview.week_start} to ${reportingOverview.week_end}</p>
                <p><strong>Generated:</strong> ${generatedAt}</p>

                <div class="section">
                    <h2>Executive KPI Summary</h2>
                    <div class="kpi-grid">
                        <div class="kpi-cell"><div class="kpi-label">Total projects</div><div class="kpi-value">${analytics.totalProjects}</div></div>
                        <div class="kpi-cell"><div class="kpi-label">Active projects</div><div class="kpi-value">${analytics.activeProjects}</div></div>
                        <div class="kpi-cell"><div class="kpi-label">Completed projects</div><div class="kpi-value">${analytics.completedProjects}</div></div>
                        <div class="kpi-cell"><div class="kpi-label">On-time completion</div><div class="kpi-value">${analytics.onTimeCompletionRate}%</div></div>
                    </div>
                </div>

                <div class="section">
                    <h2>Task Status Distribution</h2>
                    <ul>
                        <li>Not started: ${analytics.statusCounts.not_started}</li>
                        <li>In progress: ${analytics.statusCounts.in_progress}</li>
                        <li>Completed: ${analytics.statusCounts.completed}</li>
                    </ul>
                </div>

                <div class="section">
                    <h2>Board Pipeline</h2>
                    <table>
                        <thead><tr><th>Board</th><th>To Do</th><th>In Progress</th><th>Completed</th><th>Total</th></tr></thead>
                        <tbody>
                            ${analytics.boardPipeline.map((board) => `<tr><td>${board.name}</td><td>${board.todo}</td><td>${board.inProgress}</td><td>${board.done}</td><td>${board.total}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>

                <div class="section">
                    <h2>Location Distribution</h2>
                    <table>
                        <thead><tr><th>Location</th><th>Tasks</th></tr></thead>
                        <tbody>
                            ${analytics.locationDistribution.map((location) => `<tr><td>${location.location}</td><td>${location.count}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>

                <div class="section">
                    <h2>Recurring Operations</h2>
                    <ul>
                        <li>Total recurring duties: ${analytics.recurringDutyTotal}</li>
                        <li>Duties active now: ${analytics.recurringDutyActiveNow}</li>
                        <li>Members with recurring duties: ${analytics.membersWithRecurringDuties}</li>
                    </ul>
                </div>

                ${canViewMembers ? `
                <div class="section">
                    <h2>Organization Members Snapshot</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Member</th><th>Role</th><th>Skills</th><th>Location</th><th>Recurring duties</th><th>Duty now</th><th>Active now</th>
                            </tr>
                        </thead>
                        <tbody>${memberRows}</tbody>
                    </table>
                </div>` : ''}

                <div class="section">
                    <h2>Approvals</h2>
                    <table>
                        <thead>
                            <tr><th>Role</th><th>Name</th><th>Signature</th><th>Date</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>Prepared By</td><td></td><td></td><td></td></tr>
                            <tr><td>Reviewed By</td><td></td><td></td><td></td></tr>
                            <tr><td>Approved By</td><td></td><td></td><td></td></tr>
                        </tbody>
                    </table>
                </div>
            </body>
            </html>
        `;
    };

    const handleExportDoc = () => {
        if (!reportingOverview) return;
        const blob = new Blob([buildReportDocHtml()], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `tasker-report-${reportingOverview.week_start}.doc`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleExportPdf = async () => {
        if (!reportingOverview) return;
        const doc = await buildPdfDocument();
        doc.save(`tasker-report-${reportingOverview.week_start}.pdf`);
    };

    const buildPdfDocument = async (): Promise<JsPdfInstance> => {
        const { jsPDF } = await loadJsPdf();
        if (!reportingOverview) {
            return new jsPDF({ unit: 'pt', format: 'a4' });
        }
        const doc = new jsPDF({ unit: 'pt', format: 'a4' });
        const marginLeft = 40;
        const marginTop = 44;
        const lineHeight = 14;
        const maxY = 800;
        const generatedAt = new Date().toLocaleString();
        const reportId = `TR-${reportingOverview.week_start}-${reportingOverview.week_end}`;
        let y = marginTop;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);

        // Cover page
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(26);
        doc.text('Tasker Official Report', marginLeft, 120);
        doc.setFontSize(14);
        doc.text('Reporting System Export', marginLeft, 150);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        doc.text(`Organization: ${orgName || 'N/A'}`, marginLeft, 210);
        doc.text(`Report ID: ${reportId}`, marginLeft, 230);
        doc.text(`Week window: ${reportingOverview.week_start} to ${reportingOverview.week_end}`, marginLeft, 250);
        doc.text(`Generated: ${generatedAt}`, marginLeft, 270);
        doc.text('Prepared for official weekly governance and operations tracking.', marginLeft, 310);
        doc.text('Sign-off fields are provided on the final page.', marginLeft, 328);

        doc.addPage();
        y = marginTop;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        for (const line of buildReportLines()) {
            const wrapped = doc.splitTextToSize(line, 510);
            for (const part of wrapped) {
                if (y > maxY) {
                    doc.addPage();
                    y = marginTop;
                }
                doc.text(part, marginLeft, y);
                y += lineHeight;
            }
        }

        if (y > 690) {
            doc.addPage();
            y = marginTop;
        }
        y += 20;
        doc.setFont('helvetica', 'bold');
        doc.text('Approvals', marginLeft, y);
        y += 24;
        doc.setFont('helvetica', 'normal');
        doc.text('Prepared By: ____________________   Date: ______________', marginLeft, y);
        y += 24;
        doc.text('Reviewed By: ____________________   Date: ______________', marginLeft, y);
        y += 24;
        doc.text('Approved By: ____________________   Date: ______________', marginLeft, y);

        const totalPages = doc.getNumberOfPages();
        for (let page = 1; page <= totalPages; page += 1) {
            doc.setPage(page);
            doc.setFontSize(9);
            doc.setTextColor(110);
            doc.text(`Tasker | ${orgName || 'Organization'} | Report ${reportId}`, marginLeft, 830);
            doc.text(`Generated ${generatedAt}`, 360, 830);
            doc.text(`Page ${page} of ${totalPages}`, 520, 830);
            doc.setTextColor(0);
        }
        return doc;
    };

    const blobToBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result;
            if (typeof result !== 'string') {
                reject(new Error('Failed to encode attachment'));
                return;
            }
            const commaIndex = result.indexOf(',');
            resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
        };
        reader.onerror = () => reject(new Error('Failed to read attachment'));
        reader.readAsDataURL(blob);
    });

    const handleEmailReport = async () => {
        if (!reportingOverview || !orgId) return;
        const recipientsInput = window.prompt('Enter recipient email(s), separated by commas:');
        if (!recipientsInput) return;
        const formatInput = (window.prompt('Attachment format: type "pdf" or "doc"', 'pdf') || 'pdf').trim().toLowerCase();
        const format = formatInput === 'doc' ? 'doc' : 'pdf';

        const fileName = `tasker-report-${reportingOverview.week_start}.${format}`;
        const blob = format === 'pdf'
            ? new Blob([(await buildPdfDocument()).output('arraybuffer')], { type: 'application/pdf' })
            : new Blob([buildReportDocHtml()], { type: 'application/msword' });
        const fileBase64 = await blobToBase64(blob);
        const to = recipientsInput.split(',').map((item) => item.trim()).filter(Boolean);
        if (!to.length) return;

        try {
            await api.post(`/reports/overview/${orgId}/email`, {
                to,
                weekStart: reportingOverview.week_start,
                format,
                fileName,
                fileBase64
            });
            window.alert(`Report emailed successfully to ${to.length} recipient(s).`);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string } } };
            const message = err?.response?.data?.error || 'Failed to email report.';
            window.alert(message);
        }
    };

    useEffect(() => {
        if (!orgId) return;
        fetchReportingOverview(orgId, weekStart).catch(console.error);
    }, [orgId, weekStart, fetchReportingOverview]);

    useEffect(() => {
        if (!orgId || !canViewMembers) return;
        fetchOrgMembersOverview(orgId, weekStart).catch(console.error);
    }, [orgId, weekStart, canViewMembers, fetchOrgMembersOverview]);

    if (!reportingOverview) {
        return <div className="p-6 text-sm text-zinc-500">Loading reporting system...</div>;
    }

    const statusTotal = analytics.statusCounts.completed + analytics.statusCounts.in_progress + analytics.statusCounts.not_started;
    const maxMemberLoad = Math.max(1, ...analytics.memberLoad.map((item) => item.activeNow));
    const maxLocationCount = Math.max(1, ...analytics.locationDistribution.map((item) => item.count));
    const maxBoardTotal = Math.max(1, ...analytics.boardPipeline.map((item) => item.total));

    return (
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-zinc-50 dark:bg-zinc-950">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100">Reporting System</h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        Week window: {reportingOverview.week_start} to {reportingOverview.week_end}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="date"
                        value={weekStart}
                        onChange={(e) => onWeekChange(e.target.value)}
                        className="px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                    />
                    <Button variant="outline" onClick={handleExportDoc}>Export DOC</Button>
                    <Button variant="outline" onClick={handleExportPdf}>Export PDF</Button>
                    <Button variant="outline" onClick={handleEmailReport}>Email Report</Button>
                    <Button variant="outline" onClick={onOpenWeeklyTasks}>Open Weekly Tasks</Button>
                    <Button variant="outline" onClick={onOpenBoardsOverview}>Open Boards Overview</Button>
                </div>
            </div>

            <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-3">Active Projects</h3>
                <div className="grid gap-3 md:grid-cols-2">
                    {reportingOverview.active_projects.map((project) => (
                        <div key={project.id} className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
                            <p className="font-semibold">{project.name}</p>
                            <p className="text-xs text-zinc-500">People: {project.participants.join(', ') || 'Unassigned'}</p>
                            <p className="text-xs text-zinc-500">Where: {project.locations.join(', ') || 'No location'}</p>
                            <p className="text-xs text-zinc-500">Progress: {project.done_tasks}/{project.total_tasks}</p>
                        </div>
                    ))}
                    {reportingOverview.active_projects.length === 0 && (
                        <p className="text-sm text-zinc-500">No active projects in this week window.</p>
                    )}
                </div>
            </section>

            <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-3">Yet To Start Projects (Priority Ranked)</h3>
                <div className="space-y-2">
                    {reportingOverview.not_started_projects.map((project) => (
                        <div key={project.id} className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
                            <p className="font-semibold">#{project.rank} {project.name}</p>
                            <p className="text-xs text-zinc-500">{project.priority_explanation}</p>
                        </div>
                    ))}
                    {reportingOverview.not_started_projects.length === 0 && (
                        <p className="text-sm text-zinc-500">No pending projects waiting to start.</p>
                    )}
                </div>
            </section>

            <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-3">Completed Projects (This Week)</h3>
                <div className="space-y-2">
                    {reportingOverview.completed_projects_week.map((project) => (
                        <div key={project.id} className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
                            <p className="font-semibold">{project.name}</p>
                            <p className="text-xs text-zinc-500">Completed on: {project.completed_on}</p>
                        </div>
                    ))}
                    {reportingOverview.completed_projects_week.length === 0 && (
                        <p className="text-sm text-zinc-500">No completed projects recorded this week.</p>
                    )}
                </div>
            </section>

            {canViewMembers && (
                <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
                    <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-3">Organization Members (Role, Skills, Location - Weekly)</h3>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-zinc-100 dark:bg-zinc-800">
                                <tr className="text-left">
                                    <th className="p-3">Member</th>
                                    <th className="p-3">Role</th>
                                    <th className="p-3">Skills</th>
                                    <th className="p-3">Location</th>
                                    <th className="p-3">Recurring duties</th>
                                    <th className="p-3">Duty now</th>
                                    <th className="p-3">Active now</th>
                                    <th className="p-3">Assigned (week)</th>
                                    <th className="p-3">Interested (week)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orgMembersOverview.map((member) => (
                                    <tr key={member.id} className="border-t border-zinc-200 dark:border-zinc-700">
                                        <td className="p-3 font-medium">{member.name}</td>
                                        <td className="p-3">{member.role}</td>
                                        <td className="p-3">{member.skills || '-'}</td>
                                        <td className="p-3">{member.location || '-'}</td>
                                        <td className="p-3">{member.recurring_duties?.length ?? 0}</td>
                                        <td className="p-3">{member.recurring_duties_active_now?.length ?? 0}</td>
                                        <td className="p-3">{member.current_tasks_now?.length ?? 0}</td>
                                        <td className="p-3">{member.assigned_tasks_week.length}</td>
                                        <td className="p-3">{member.interested_tasks_week.length}</td>
                                    </tr>
                                ))}
                                {orgMembersOverview.length === 0 && (
                                    <tr>
                                        <td className="p-3 text-zinc-500" colSpan={9}>No member data available for the selected week.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-3">Executive KPI Summary</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <KpiCard label="Total Projects" value={analytics.totalProjects} />
                    <KpiCard label="Completed Throughput" value={analytics.throughputCompletedTasks} />
                    <KpiCard label="On-Time Completion" value={`${analytics.onTimeCompletionRate}%`} />
                    <KpiCard label="Overdue Open Tasks" value={analytics.overdueOpenTasks} />
                </div>
            </section>

            <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-3">Task Status Distribution</h3>
                <div className="space-y-3">
                    <StatusBar label="Not Started" value={analytics.statusCounts.not_started} total={statusTotal} color="bg-zinc-400" />
                    <StatusBar label="In Progress" value={analytics.statusCounts.in_progress} total={statusTotal} color="bg-amber-500" />
                    <StatusBar label="Completed" value={analytics.statusCounts.completed} total={statusTotal} color="bg-emerald-500" />
                </div>
            </section>

            <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-3">Board Pipeline Chart</h3>
                <div className="space-y-3">
                    {analytics.boardPipeline.map((board) => {
                        const todoPct = (board.todo / maxBoardTotal) * 100;
                        const inProgressPct = (board.inProgress / maxBoardTotal) * 100;
                        const donePct = (board.done / maxBoardTotal) * 100;
                        return (
                            <div key={board.name} className="space-y-1">
                                <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-300">
                                    <span className="font-semibold">{board.name}</span>
                                    <span>{board.total} tasks</span>
                                </div>
                                <div className="h-3 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden flex">
                                    <div className="bg-zinc-400" style={{ width: `${todoPct}%` }} />
                                    <div className="bg-amber-500" style={{ width: `${inProgressPct}%` }} />
                                    <div className="bg-emerald-500" style={{ width: `${donePct}%` }} />
                                </div>
                            </div>
                        );
                    })}
                    {analytics.boardPipeline.length === 0 && <p className="text-sm text-zinc-500">No board pipeline data available.</p>}
                </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
                    <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-3">Member Workload (Active Now)</h3>
                    <div className="space-y-3">
                        {analytics.memberLoad.map((member) => (
                            <div key={member.name} className="space-y-1">
                                <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-300">
                                    <span>{member.name}</span>
                                    <span>{member.activeNow}</span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                                    <div className="h-2 bg-indigo-500" style={{ width: `${(member.activeNow / maxMemberLoad) * 100}%` }} />
                                </div>
                            </div>
                        ))}
                        {analytics.memberLoad.length === 0 && <p className="text-sm text-zinc-500">No member workload data available.</p>}
                    </div>
                </div>
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
                    <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-3">Location Distribution</h3>
                    <div className="space-y-3">
                        {analytics.locationDistribution.map((location) => (
                            <div key={location.location} className="space-y-1">
                                <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-300">
                                    <span>{location.location}</span>
                                    <span>{location.count}</span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                                    <div className="h-2 bg-emerald-500" style={{ width: `${(location.count / maxLocationCount) * 100}%` }} />
                                </div>
                            </div>
                        ))}
                        {analytics.locationDistribution.length === 0 && <p className="text-sm text-zinc-500">No location data available.</p>}
                    </div>
                </div>
            </section>

            <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-3">Recurring Operations Analytics</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                    <KpiCard label="Recurring Duties" value={analytics.recurringDutyTotal} />
                    <KpiCard label="Duties Active Now" value={analytics.recurringDutyActiveNow} />
                    <KpiCard label="Members With Duties" value={analytics.membersWithRecurringDuties} />
                </div>
            </section>
        </div>
    );
}

function KpiCard({ label, value }: { label: string; value: number | string }) {
    return (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 bg-zinc-50 dark:bg-zinc-800/50">
            <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</p>
            <p className="text-2xl font-black text-zinc-900 dark:text-zinc-100 mt-1">{value}</p>
        </div>
    );
}

function StatusBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
    const width = total > 0 ? (value / total) * 100 : 0;
    return (
        <div className="space-y-1">
            <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-300">
                <span>{label}</span>
                <span>{value}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                <div className={`h-2 ${color}`} style={{ width: `${width}%` }} />
            </div>
        </div>
    );
}
