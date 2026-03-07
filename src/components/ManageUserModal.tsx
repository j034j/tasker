import { useState } from 'react';
import { useStore } from '@/lib/store';
import { Button } from './ui/Button';
import { DraggableModalWrapper } from './ui/DraggableModalWrapper';
import { X, Trash2, Key, User as UserIcon } from 'lucide-react';

interface ManageUserModalProps {
    user: { id: string; name: string; email: string; role: string };
    onClose: () => void;
}

export function ManageUserModal({ user, onClose }: ManageUserModalProps) {
    const { updateUserAdmin, deleteUserAdmin, resetPasswordAdmin } = useStore();

    const [name, setName] = useState(user.name);
    const [email, setEmail] = useState(user.email);
    const [isLoading, setIsLoading] = useState(false);

    const handleSave = async () => {
        setIsLoading(true);
        try {
            await updateUserAdmin(user.id, { name, email });
            alert('User updated successfully');
            onClose();
        } catch {
            alert('Failed to update user');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPassword = async () => {
        const newPwd = prompt(`Reset password for ${user.name}? Enter new password:`);
        if (!newPwd) return;

        setIsLoading(true);
        try {
            await resetPasswordAdmin(user.id, newPwd);
            alert('Password reset successfully');
        } catch {
            alert('Failed to reset password');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(`Are you sure you want to delete user ${user.name}? This action cannot be undone.`)) return;

        setIsLoading(true);
        try {
            await deleteUserAdmin(user.id);
            onClose();
        } catch {
            alert('Failed to delete user');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <DraggableModalWrapper isOpen={true} onClose={onClose} className="w-full max-w-md bg-white dark:bg-zinc-900">
            <div className="flex flex-col">
                {/* Header */}
                <div className="modal-handle cursor-move p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-800/20">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                            <UserIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Manage User</h2>
                            <p className="text-xs text-zinc-500">{user.id}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold mb-1.5 text-zinc-700 dark:text-zinc-300">Full Name</label>
                            <input
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1.5 text-zinc-700 dark:text-zinc-300">Email Address</label>
                            <input
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="w-full px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            />
                        </div>
                    </div>

                    <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Security & Actions</h3>

                        <button
                            onClick={handleResetPassword}
                            disabled={isLoading}
                            className="w-full flex items-center justify-between p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-400 group-hover:bg-amber-200 dark:group-hover:bg-amber-900/50 transition-colors">
                                    <Key className="w-4 h-4" />
                                </div>
                                <div className="text-left">
                                    <p className="font-bold text-sm text-zinc-900 dark:text-zinc-100">Reset Password</p>
                                    <p className="text-xs text-zinc-500">Force set a new password</p>
                                </div>
                            </div>
                        </button>

                        <button
                            onClick={handleDelete}
                            disabled={isLoading}
                            className="w-full flex items-center justify-between p-4 rounded-xl border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600 dark:text-red-400 group-hover:bg-red-200 dark:group-hover:bg-red-900/50 transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                </div>
                                <div className="text-left">
                                    <p className="font-bold text-sm text-red-600 dark:text-red-400">Delete User</p>
                                    <p className="text-xs text-red-500/70">Permanently remove this account</p>
                                </div>
                            </div>
                        </button>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <Button onClick={handleSave} disabled={isLoading} className="flex-1">
                            {isLoading ? 'Saving...' : 'Save Changes'}
                        </Button>
                        <Button variant="outline" onClick={onClose} disabled={isLoading}>
                            Cancel
                        </Button>
                    </div>
                </div>
            </div>
        </DraggableModalWrapper>
    );
}
