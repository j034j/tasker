import { useEffect, useState } from 'react';
import { useStore, type Organization, type User } from '@/lib/store';
import { Users, Building, Layers, CheckSquare, Shield, LogOut, type LucideIcon } from 'lucide-react';
import { ManageOrgModal } from './ManageOrgModal';
import { ManageUserModal } from './ManageUserModal';

export function SuperAdminDashboard() {
    const {
        currentUser, systemStats, allOrgs, allUsers,
        fetchSystemStats, fetchAllOrgs, fetchAllUsers, deElevateSuperAdmin, logout
    } = useStore();

    const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
    const [selectedUser, setSelectedUser] = useState<(User & { org_name?: string }) | null>(null);
    const [isSteppingDown, setIsSteppingDown] = useState(false);

    useEffect(() => {
        fetchSystemStats();
        fetchAllOrgs();
        fetchAllUsers();
    }, [fetchAllOrgs, fetchAllUsers, fetchSystemStats]);

    if (!currentUser || currentUser.role !== 'super_admin') {
        return <div className="p-8 text-center text-red-500 font-bold">Access Denied</div>;
    }

    const handleStepDown = async () => {
        const approved = window.confirm('Step down from System Super Admin? You will lose system-wide admin access.');
        if (!approved) return;

        const password = window.prompt('Enter your current password to confirm step-down:');
        if (!password) return;

        const selectedRole = (window.prompt('Set your new role (org_super_admin, admin, member):', 'org_super_admin') || 'org_super_admin').trim();
        if (selectedRole !== 'org_super_admin' && selectedRole !== 'admin' && selectedRole !== 'member') {
            window.alert('Invalid role selected.');
            return;
        }

        try {
            setIsSteppingDown(true);
            await deElevateSuperAdmin(password, selectedRole);
            window.alert(`Role updated to ${selectedRole}.`);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string } } };
            const message = err?.response?.data?.error || 'Failed to step down.';
            window.alert(message);
        } finally {
            setIsSteppingDown(false);
        }
    };

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
            {/* Header */}
            <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-4 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Shield className="w-8 h-8 text-red-600" />
                        <h1 className="text-xl font-black text-zinc-900 dark:text-white">System Governance</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleStepDown}
                            disabled={isSteppingDown}
                            className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                            title="Step down from system super admin role"
                        >
                            {isSteppingDown ? 'Updating...' : 'Step Down'}
                        </button>
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-bold text-zinc-900 dark:text-white">{currentUser.name}</p>
                            <p className="text-xs text-zinc-500 uppercase tracking-wider">Super Admin</p>
                        </div>
                        <button
                            onClick={logout}
                            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 transition-colors"
                            title="Logout"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-7xl mx-auto space-y-8">

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard icon={Users} label="Total Users" value={systemStats?.users} color="blue" />
                        <StatCard icon={Building} label="Organizations" value={systemStats?.orgs} color="indigo" />
                        <StatCard icon={Layers} label="Active Boards" value={systemStats?.boards} color="emerald" />
                        <StatCard icon={CheckSquare} label="Total Tasks" value={systemStats?.tasks} color="amber" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Organizations Table */}
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Organizations</h2>
                                <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-xs font-bold px-2 py-1 rounded-md">
                                    {allOrgs.length}
                                </span>
                            </div>
                            <div className="overflow-x-auto max-h-[500px]">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-zinc-500 uppercase bg-zinc-50 dark:bg-zinc-800/50 sticky top-0">
                                        <tr>
                                            <th className="px-6 py-3 font-bold">Name</th>
                                            <th className="px-6 py-3 font-bold">Users</th>
                                            <th className="px-6 py-3 font-bold">Created</th>
                                            <th className="px-6 py-3 font-bold text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {allOrgs.map((org) => (
                                            <tr key={org.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                                                <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-200">
                                                    {org.name}
                                                </td>
                                                <td className="px-6 py-4 text-zinc-500">{org.user_count}</td>
                                                <td className="px-6 py-4 text-zinc-500">
                                                    {new Date(org.created_at).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => setSelectedOrg(org)}
                                                        className="text-red-500 hover:text-red-700 font-medium text-xs"
                                                    >
                                                        Manage
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Recent Users Table */}
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
                                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Recent Users</h2>
                            </div>
                            <div className="overflow-x-auto max-h-[500px]">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-zinc-500 uppercase bg-zinc-50 dark:bg-zinc-800/50 sticky top-0">
                                        <tr>
                                            <th className="px-6 py-3 font-bold">Name</th>
                                            <th className="px-6 py-3 font-bold">Role</th>
                                            <th className="px-6 py-3 font-bold">Organization</th>
                                            <th className="px-6 py-3 font-bold text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {allUsers.map((user) => (
                                            <tr key={user.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-zinc-900 dark:text-zinc-200">{user.name}</div>
                                                    <div className="text-xs text-zinc-500">{user.email}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-bold ${user.role === 'super_admin' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                        user.role === 'org_super_admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                                                        user.role === 'admin' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' :
                                                            'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                                                        }`}>
                                                        {user.role}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-zinc-500">
                                                    {user.org_name || 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => setSelectedUser(user)}
                                                        className="text-indigo-500 hover:text-indigo-700 font-medium text-xs"
                                                    >
                                                        Manage
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {selectedOrg && (
                <ManageOrgModal
                    org={selectedOrg}
                    onClose={() => setSelectedOrg(null)}
                />
            )}

            {selectedUser && (
                <ManageUserModal
                    user={selectedUser}
                    onClose={() => setSelectedUser(null)}
                />
            )}
        </div>
    );
}

function StatCard({ icon: Icon, label, value, color }: { icon: LucideIcon, label: string, value?: number, color: 'blue' | 'indigo' | 'emerald' | 'amber' }) {
    const colors: Record<'blue' | 'indigo' | 'emerald' | 'amber', string> = {
        blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
        indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400",
        emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400",
        amber: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
    };

    return (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center gap-4">
            <div className={`p-3 rounded-xl ${colors[color] || colors.blue}`}>
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <p className="text-sm font-bold text-zinc-500 uppercase tracking-wide">{label}</p>
                <p className="text-2xl font-black text-zinc-900 dark:text-white">
                    {value !== undefined ? value.toLocaleString() : '-'}
                </p>
            </div>
        </div>
    );
}
