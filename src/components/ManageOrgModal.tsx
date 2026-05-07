import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { Button } from './ui/Button';
import { DraggableModalWrapper } from './ui/DraggableModalWrapper';
import { X, Trash2, Edit2, Key } from 'lucide-react';
import { api } from '@/lib/axios';

interface OrgShape {
    id: string;
    name: string;
}

interface ManageOrgModalProps {
    org: OrgShape;
    onClose: () => void;
}

export function ManageOrgModal({ org, onClose }: ManageOrgModalProps) {
    const {
        updateOrganizationAdmin, deleteOrganizationAdmin,
        getOrgBoardsAdmin, deleteUserAdmin,
        updateUserAdmin, resetPasswordAdmin,
        allUsers
    } = useStore();

    const [activeTab, setActiveTab] = useState<'details' | 'users' | 'boards' | 'departments'>('details');
    const [orgName, setOrgName] = useState(org.name);
    const [boards, setBoards] = useState<{ id: string; name: string }[]>([]);
    const [departments, setDepartments] = useState<{ id: string; name: string; admin_user_id?: string | null }[]>([]);
    const [newDeptName, setNewDeptName] = useState('');
    const [newDeptAdmin, setNewDeptAdmin] = useState<string | null>(null);

    // Filter users for this org
    const orgUsers = allUsers.filter(u => (u as { org_id?: string }).org_id === org.id || (u as { org_name?: string }).org_name === org.name);

    const loadBoards = async () => {
        const data = await getOrgBoardsAdmin(org.id);
        setBoards(data);
    };

    useEffect(() => {
        if (activeTab === 'boards') {
            loadBoards();
        }
        if (activeTab === 'departments') {
            (async () => {
                try {
                    const { data } = await api.get(`/orgs/${org.id}/departments`);
                    setDepartments(Array.isArray(data?.departments) ? data.departments : []);
                } catch (err) {
                    console.error('Failed to load departments', err);
                }
            })();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    const handleUpdateName = async () => {
        if (!confirm('Update organization name?')) return;
        await updateOrganizationAdmin(org.id, orgName);
        alert('Updated');
    };

    const handleDeleteOrg = async () => {
        const confirmText = prompt(`Type "${org.name}" to confirm deletion. This will delete ALL users, boards, and tasks.`);
        if (confirmText === org.name) {
            await deleteOrganizationAdmin(org.id);
            onClose();
        }
    };

    return (
        <DraggableModalWrapper isOpen={true} onClose={onClose} className="w-full max-w-2xl bg-white dark:bg-zinc-900">
            <div className="flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="modal-handle cursor-move p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-800/20">
                    <div>
                        <h2 className="text-xl font-bold">Manage Organization</h2>
                        <p className="text-sm text-zinc-500">{org.id}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-zinc-200 dark:border-zinc-800">
                    <button
                        onClick={() => setActiveTab('details')}
                        className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'details' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-zinc-500'}`}
                    >
                        Details
                    </button>
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'users' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-zinc-500'}`}
                    >
                        Users ({orgUsers.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('boards')}
                        className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'boards' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-zinc-500'}`}
                    >
                        Boards
                    </button>
                    <button
                        onClick={() => setActiveTab('departments')}
                        className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'departments' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-zinc-500'}`}
                    >
                        Departments
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">

                    {/* DETAILS TAB */}
                    {activeTab === 'details' && (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-bold mb-2">Organization Name</label>
                                <div className="flex gap-2">
                                    <input
                                        value={orgName}
                                        onChange={e => setOrgName(e.target.value)}
                                        className="flex-1 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                                    />
                                    <Button onClick={handleUpdateName}>Save</Button>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800">
                                <h3 className="text-red-500 font-bold mb-2">Danger Zone</h3>
                                <p className="text-sm text-zinc-500 mb-4">
                                    Deleting an organization is irreversible. All associated data will be wiped.
                                </p>
                                <Button onClick={handleDeleteOrg} className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 dark:bg-red-900/20 shadow-none border border-red-200 dark:border-red-900">
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete Organization
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* USERS TAB */}
                    {activeTab === 'users' && (
                        <div className="space-y-4">
                            {orgUsers.map(user => (
                                <UserRow key={user.id} user={user}
                                    onUpdate={updateUserAdmin}
                                    onDelete={deleteUserAdmin}
                                    onReset={resetPasswordAdmin}
                                />
                            ))}
                            {orgUsers.length === 0 && <p className="text-zinc-500 italic">No users found.</p>}
                        </div>
                    )}

                    {/* BOARDS TAB */}
                    {activeTab === 'boards' && (
                        <div className="space-y-4">
                            {boards.map(board => (
                                <div key={board.id} className="flex justify-between items-center p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                                    <div>
                                        <p className="font-bold">{board.name}</p>
                                        <p className="text-xs text-zinc-500">{board.id}</p>
                                    </div>
                                    {/* Board deletion could be added here if needed, but not explicitly requested yet */}
                                </div>
                            ))}
                            {boards.length === 0 && <p className="text-zinc-500 italic">No boards found.</p>}
                        </div>
                    )}

                    {/* DEPARTMENTS TAB */}
                    {activeTab === 'departments' && (
                        <div className="space-y-6">
                            <div className="flex items-center gap-3">
                                <input value={newDeptName} onChange={e => setNewDeptName(e.target.value)} placeholder="New department name" className="flex-1 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800" />
                                <select value={newDeptAdmin || ''} onChange={e => setNewDeptAdmin(e.target.value || null)} className="px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800">
                                    <option value="">No admin</option>
                                    {orgUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                                </select>
                                <Button onClick={async () => {
                                    if (!newDeptName.trim()) return alert('Enter a department name');
                                    try {
                                        const res = await api.post(`/orgs/${org.id}/departments`, { name: newDeptName.trim(), adminUserId: newDeptAdmin });
                                        setDepartments(prev => [{ ...res.data, admin_user_id: res.data?.admin_user_id || res.data?.adminUserId || null }, ...prev]);
                                        setNewDeptName(''); setNewDeptAdmin(null);
                                    } catch (err) {
                                        console.error(err);
                                        alert('Failed to create department');
                                    }
                                }}>Create</Button>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                {departments.map(d => (
                                    <div key={d.id} className="p-4 rounded-2xl bg-gradient-to-br from-white to-indigo-50 dark:from-zinc-900 dark:to-indigo-900/20 border border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                                        <div>
                                            <p className="font-semibold">{d.name}</p>
                                            <p className="text-xs text-zinc-500">ID: {d.id}</p>
                                            <p className="text-xs text-zinc-500">Weekly overview: available in Weekly Tasks for this department.</p>
                                            <p className="text-xs text-zinc-500">Admin: { (orgUsers.find(u => u.id === d.admin_user_id)?.name) || '—' }</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button className="text-zinc-500 hover:text-indigo-600" onClick={async () => {
                                                const newName = prompt('Update department name', d.name);
                                                if (!newName) return;
                                                try {
                                                    await api.put(`/departments/${d.id}`, { name: newName });
                                                    setDepartments(prev => prev.map(x => x.id === d.id ? { ...x, name: newName } : x));
                                                } catch (err) { console.error(err); alert('Failed to update'); }
                                            }}>Edit</button>
                                            <button className="text-red-500 hover:text-red-700" onClick={async () => {
                                                if (!confirm(`Delete department ${d.name}?`)) return;
                                                try {
                                                    await api.delete(`/departments/${d.id}`);
                                                    setDepartments(prev => prev.filter(x => x.id !== d.id));
                                                } catch (err) { console.error(err); alert('Failed to delete'); }
                                            }}>Delete</button>
                                        </div>
                                    </div>
                                ))}
                                {departments.length === 0 && <p className="text-zinc-500 italic">No departments yet.</p>}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </DraggableModalWrapper>
    );
}

interface UserRowProps {
    user: { id: string; name: string; email: string; role: string };
    onUpdate: (id: string, data: { name: string; email: string }) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onReset: (id: string, password: string) => Promise<void>;
}

function UserRow({ user, onUpdate, onDelete, onReset }: UserRowProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(user.name);
    const [email, setEmail] = useState(user.email);

    const handleSave = async () => {
        await onUpdate(user.id, { name, email });
        setIsEditing(false);
    };

    const handleReset = async () => {
        const newPwd = prompt(`Reset password for ${user.name}? Enter new password:`);
        if (newPwd) {
            await onReset(user.id, newPwd);
            alert('Password reset successfully.');
        }
    };

    const handleDelete = async () => {
        if (confirm(`Delete user ${user.name}?`)) {
            await onDelete(user.id);
        }
    };

    if (isEditing) {
        return (
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl space-y-2">
                <input value={name} onChange={e => setName(e.target.value)} className="w-full p-2 rounded border" placeholder="Name" />
                <input value={email} onChange={e => setEmail(e.target.value)} className="w-full p-2 rounded border" placeholder="Email" />
                <div className="flex gap-2">
                    <Button size="sm" onClick={handleSave}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex justify-between items-center p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800 group">
            <div>
                <p className="font-bold text-sm">{user.name} <span className="text-xs text-zinc-400 font-normal">({user.role})</span></p>
                <p className="text-xs text-zinc-500">{user.email}</p>
            </div>
            <div className="flex gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setIsEditing(true)} title="Edit User" className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-zinc-500">
                    <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={handleReset} title="Reset Password" className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-amber-500">
                    <Key className="w-4 h-4" />
                </button>
                <button onClick={handleDelete} title="Delete User" className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-red-500">
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
