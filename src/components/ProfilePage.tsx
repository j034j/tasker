import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/lib/store';
import type { RecurringDuty } from '@/lib/store';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/Button';
import { UserPlus, Mail, Check, X, CheckCircle2 } from 'lucide-react';

interface ProfilePageProps {
    onBack: () => void;
}

const isInviteAdmin = (role?: string) => role === 'admin' || role === 'org_super_admin' || role === 'super_admin';

export function ProfilePage({ onBack }: ProfilePageProps) {
    const {
        currentUser, updateUser, fetchUserProfile, userProfile,
        taskInvites, fetchMyInvites, fetchInviteCandidates, fetchTasksForInvite, sendTaskInvite, acceptInvite, declineInvite
    } = useStore();
    const { t } = useLanguage();

    const [name, setName] = useState(currentUser?.name || '');
    const [email, setEmail] = useState(currentUser?.email || '');
    const [username, setUsername] = useState(currentUser?.username || '');
    const [phoneNumber, setPhoneNumber] = useState(currentUser?.phone_number || '');
    const [skills, setSkills] = useState(currentUser?.skills || '');
    const [location, setLocation] = useState(currentUser?.location || '');
    const [recurringDuties, setRecurringDuties] = useState<RecurringDuty[]>([]);
    const [password, setPassword] = useState('');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const hasUsername = Boolean((userProfile?.user?.username || currentUser?.username || '').trim());

    // Task invite (send) state
    const [inviteTaskId, setInviteTaskId] = useState('');
    const [inviteUserId, setInviteUserId] = useState('');
    const [inviteMessage, setInviteMessage] = useState('');
    const [inviteCandidates, setInviteCandidates] = useState<{ id: string; name: string; email: string; skills: string | null }[]>([]);
    const [tasksForInvite, setTasksForInvite] = useState<{ id: string; title: string; boardId: string; boardName: string }[]>([]);
    const [inviteSearch, setInviteSearch] = useState('');
    const [inviteSending, setInviteSending] = useState(false);
    const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

    // Initial Fetch
    useEffect(() => {
        fetchUserProfile();
    }, [fetchUserProfile]);

    // Sync if user changes (e.g. re-login or store update)
    useEffect(() => {
        if (currentUser) {
            setName(currentUser.name);
            setEmail(currentUser.email);
            setUsername(currentUser.username || '');
            setPhoneNumber(currentUser.phone_number || '');
            setSkills(currentUser.skills || '');
            setLocation(currentUser.location || '');
        }
    }, [currentUser]);

    useEffect(() => {
        setRecurringDuties(userProfile?.recurringDuties || []);
    }, [userProfile]);

    useEffect(() => {
        fetchMyInvites();
    }, [fetchMyInvites]);

    const loadTasksForInvite = useCallback(async () => {
        const oid = userProfile?.organization?.id;
        if (!oid) return;
        const list = await fetchTasksForInvite(oid);
        setTasksForInvite(list);
    }, [userProfile?.organization?.id, fetchTasksForInvite]);
    const loadCandidates = useCallback(async () => {
        const oid = userProfile?.organization?.id;
        if (!oid) return;
        const list = await fetchInviteCandidates(oid, inviteSearch || undefined, inviteTaskId || undefined);
        setInviteCandidates(list);
    }, [userProfile?.organization?.id, inviteSearch, inviteTaskId, fetchInviteCandidates]);

    useEffect(() => {
        if (userProfile?.organization?.id) loadTasksForInvite();
    }, [userProfile?.organization?.id, loadTasksForInvite]);
    useEffect(() => {
        if (!userProfile?.organization?.id) {
            setInviteCandidates([]);
            return;
        }
        if (isInviteAdmin(currentUser?.role) || inviteTaskId) loadCandidates();
        else setInviteCandidates([]);
    }, [currentUser?.role, userProfile?.organization?.id, inviteSearch, inviteTaskId, loadCandidates]);

    const handleSendInvite = async () => {
        if (!inviteTaskId || !inviteUserId) {
            setInviteSuccess(null);
            setMessage({ type: 'error', text: 'Please select a task and a member.' });
            return;
        }
        setInviteSending(true);
        setMessage(null);
        setInviteSuccess(null);
        try {
            await sendTaskInvite(inviteTaskId, inviteUserId, inviteMessage || undefined);
            setInviteSuccess('Invite sent successfully.');
            setInviteUserId('');
            setInviteMessage('');
        } catch (e) {
            const err = e as { response?: { data?: { error?: string } } };
            setMessage({ type: 'error', text: err?.response?.data?.error || 'Failed to send invite.' });
        } finally {
            setInviteSending(false);
        }
    };

    const addRecurringDuty = () => {
        setRecurringDuties((prev) => ([
            ...prev,
            {
                title: '',
                cadence: 'daily',
                dayOfWeek: null,
                startTime: '08:00',
                endTime: '10:00',
                location: '',
                notes: ''
            }
        ]));
    };

    const updateRecurringDuty = (index: number, patch: Partial<RecurringDuty>) => {
        setRecurringDuties((prev) => prev.map((duty, i) => (i === index ? { ...duty, ...patch } : duty)));
    };

    const removeRecurringDuty = (index: number) => {
        setRecurringDuties((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            await updateUser({
                name,
                email,
                username: username || undefined,
                phone_number: phoneNumber,
                skills,
                location,
                recurringDuties,
                password: password || undefined // Only send if set
            });
            setMessage({ type: 'success', text: 'Profile updated successfully' });
            setPassword(''); // Clear password field on success
        } catch (error) {
            console.error(error);
            setMessage({ type: 'error', text: 'Failed to update profile' });
        } finally {
            setSaving(false);
        }
    };

    const firstName = name.split(' ')[0];

    return (
        <div className="flex-1 overflow-y-auto p-8 bg-zinc-50 dark:bg-zinc-950">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                    </button>
                    <h1 className="text-3xl font-black text-zinc-900 dark:text-zinc-50">
                        {firstName ? `${firstName}'s Profile` : (t('profile_title') || 'My Profile')}
                    </h1>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column: Edit Profile */}
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-8">
                        <h2 className="text-xl font-bold mb-6 text-zinc-800 dark:text-zinc-200">Edit Details</h2>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 uppercase tracking-wide">
                                    {t('auth_your_name')}
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 uppercase tracking-wide">
                                    Username
                                </label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                                    className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-indigo-500 transition-all font-medium disabled:bg-zinc-100 disabled:dark:bg-zinc-800/60 disabled:text-zinc-600 disabled:dark:text-zinc-300"
                                    disabled={hasUsername}
                                    placeholder="Set your username"
                                />
                                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                                    {hasUsername ? 'Username is already set for this account.' : 'Set your username now. It can only be set once.'}
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 uppercase tracking-wide">
                                    {t('auth_email')}
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 uppercase tracking-wide">
                                    {t('auth_phone_optional') || 'Phone Number'}
                                </label>
                                <input
                                    type="tel"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                                    placeholder="+1 234 567 8900"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 uppercase tracking-wide">
                                    Skills
                                </label>
                                <input
                                    type="text"
                                    value={skills}
                                    onChange={(e) => setSkills(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                                    placeholder="e.g. Carpenter, Mechanic, Electrician, Roofer, Forklift Operator"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 uppercase tracking-wide">
                                    Location
                                </label>
                                <input
                                    type="text"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                                    placeholder="e.g. Hamburg / Remote"
                                />
                            </div>
                            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                                        Recurring Duties (Daily / Weekly)
                                    </label>
                                    <button
                                        type="button"
                                        onClick={addRecurringDuty}
                                        className="px-3 py-1.5 rounded-lg text-xs font-bold border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                    >
                                        + Add Duty
                                    </button>
                                </div>
                                {recurringDuties.length === 0 && (
                                    <p className="text-xs text-zinc-500">No recurring duties configured yet.</p>
                                )}
                                {recurringDuties.map((duty, index) => (
                                    <div key={`${index}-${duty.id || 'new'}`} className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-3 space-y-3 bg-zinc-50 dark:bg-zinc-800/50">
                                        <input
                                            type="text"
                                            value={duty.title}
                                            onChange={(e) => updateRecurringDuty(index, { title: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
                                            placeholder="Duty title (e.g. Milk cows, Open nursery shop)"
                                        />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            <select
                                                value={duty.cadence}
                                                onChange={(e) => updateRecurringDuty(index, { cadence: e.target.value as 'daily' | 'weekly', dayOfWeek: e.target.value === 'weekly' ? (duty.dayOfWeek ?? 1) : null })}
                                                className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
                                            >
                                                <option value="daily">Daily</option>
                                                <option value="weekly">Weekly</option>
                                            </select>
                                            {duty.cadence === 'weekly' ? (
                                                <select
                                                    value={duty.dayOfWeek ?? 1}
                                                    onChange={(e) => updateRecurringDuty(index, { dayOfWeek: Number(e.target.value) })}
                                                    className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
                                                >
                                                    <option value={1}>Monday</option>
                                                    <option value={2}>Tuesday</option>
                                                    <option value={3}>Wednesday</option>
                                                    <option value={4}>Thursday</option>
                                                    <option value={5}>Friday</option>
                                                    <option value={6}>Saturday</option>
                                                    <option value={0}>Sunday</option>
                                                </select>
                                            ) : (
                                                <div />
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <input
                                                type="time"
                                                value={duty.startTime}
                                                onChange={(e) => updateRecurringDuty(index, { startTime: e.target.value })}
                                                className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
                                            />
                                            <input
                                                type="time"
                                                value={duty.endTime}
                                                onChange={(e) => updateRecurringDuty(index, { endTime: e.target.value })}
                                                className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
                                            />
                                        </div>
                                        <input
                                            type="text"
                                            value={duty.location || ''}
                                            onChange={(e) => updateRecurringDuty(index, { location: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
                                            placeholder="Duty location"
                                        />
                                        <textarea
                                            value={duty.notes || ''}
                                            onChange={(e) => updateRecurringDuty(index, { notes: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
                                            rows={2}
                                            placeholder="Optional details"
                                        />
                                        <div className="flex justify-end">
                                            <button
                                                type="button"
                                                onClick={() => removeRecurringDuty(index)}
                                                className="text-xs font-bold text-red-600 hover:text-red-700"
                                            >
                                                Remove Duty
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 uppercase tracking-wide">
                                    {t('profile_new_password') || 'New Password (Optional)'}
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                                    placeholder="••••••••"
                                    minLength={6}
                                />
                            </div>

                            {message && (
                                <div className={`p-4 rounded-xl text-sm font-bold text-center ${message.type === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                    {message.text}
                                </div>
                            )}

                            <Button
                                type="submit"
                                disabled={saving}
                                className="w-full py-4 text-base font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-500/20 transition-all"
                            >
                                {saving ? (t('saving') || 'Saving...') : (t('profile_save_btn') || 'Save Changes')}
                            </Button>
                        </form>
                    </div>

                    {/* Right Column: Info & Interests */}
                    <div className="space-y-8">

                        {/* Organization */}
                        <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-8">
                            <h2 className="text-xl font-bold mb-4 text-zinc-800 dark:text-zinc-200">Your Organization</h2>
                            {userProfile?.organization ? (
                                <div>
                                    <div className="mb-2">
                                        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{userProfile.organization.name}</h3>
                                        <p className="text-sm text-zinc-500 uppercase tracking-wider font-bold">{currentUser?.role}</p>
                                    </div>
                                    <p className="text-xs text-zinc-400 mt-4">Org ID: {userProfile.organization.id}</p>
                                </div>
                            ) : (
                                <p className="text-zinc-500">Loading organization details...</p>
                            )}
                        </div>

                        {/* Task invites (received) */}
                        <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-8">
                            <h2 className="text-xl font-bold mb-4 text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                                <Mail className="w-5 h-5" /> Task Invites
                            </h2>
                            <p className="text-sm text-zinc-500 mb-4">
                                Invites from admins to consider joining a task based on your skills or interests.
                            </p>
                            {taskInvites.length === 0 ? (
                                <p className="text-zinc-500 text-sm">No task invites.</p>
                            ) : (
                                <div className="space-y-3 max-h-[280px] overflow-y-auto pr-2 custom-scrollbar">
                                    {taskInvites.map((inv) => (
                                        <div key={inv.id} className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-700">
                                            <div className="flex justify-between items-start gap-2">
                                                <div>
                                                    <h4 className="font-bold text-zinc-900 dark:text-zinc-200">{inv.taskTitle}</h4>
                                                    <p className="text-xs text-zinc-500 mt-1">Board: {inv.boardName}</p>
                                                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">From: {inv.inviterName}</p>
                                                    {inv.message && <p className="text-xs text-zinc-500 mt-1 italic">&quot;{inv.message}&quot;</p>}
                                                    <span className={`inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded ${inv.status === 'pending' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' : inv.status === 'accepted' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400'}`}>
                                                        {inv.status}
                                                    </span>
                                                </div>
                                                {inv.status === 'pending' && (
                                                    <div className="flex gap-1 shrink-0">
                                                        <button type="button" onClick={() => acceptInvite(inv.id)} className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800/50" title="Accept"><Check className="w-4 h-4" /></button>
                                                        <button type="button" onClick={() => declineInvite(inv.id)} className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800/50" title="Decline"><X className="w-4 h-4" /></button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Send task invite (org/board admins: admins or board creators) */}
                        {userProfile?.organization?.id && (isInviteAdmin(currentUser?.role) || tasksForInvite.length > 0) && (
                            <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-8">
                                <h2 className="text-xl font-bold mb-4 text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                                    <UserPlus className="w-5 h-5" /> Send Task Invite
                                </h2>
                                <p className="text-sm text-zinc-500 mb-4">
                                    Invite a member to consider a task (by skills or interests). They can accept or decline from their profile.
                                </p>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1">Task</label>
                                        <select value={inviteTaskId} onChange={(e) => { setInviteTaskId(e.target.value); setInviteSuccess(null); }} className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
                                            <option value="">Select a task</option>
                                            {tasksForInvite.map((t) => (
                                                <option key={t.id} value={t.id}>{t.boardName} — {t.title}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1">Search member (name, email, skills)</label>
                                        <input type="text" value={inviteSearch} onChange={(e) => setInviteSearch(e.target.value)} placeholder="Type to filter..." className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1">Invite this member</label>
                                        <select value={inviteUserId} onChange={(e) => { setInviteUserId(e.target.value); setInviteSuccess(null); }} className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
                                            <option value="">Select a member</option>
                                            {inviteCandidates.filter((c) => c.id !== currentUser?.id).map((c) => (
                                                <option key={c.id} value={c.id}>{c.name} — {c.email}{c.skills ? ` (${c.skills})` : ''}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1">Optional message</label>
                                        <input type="text" value={inviteMessage} onChange={(e) => setInviteMessage(e.target.value)} placeholder="e.g. Your skills match this task" className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100" />
                                    </div>
                                    {inviteSuccess && (
                                        <div className="flex items-center gap-3 p-4 rounded-xl bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800">
                                            <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400 shrink-0" />
                                            <p className="text-sm font-bold text-green-800 dark:text-green-200">{inviteSuccess}</p>
                                        </div>
                                    )}
                                    <Button type="button" onClick={handleSendInvite} disabled={inviteSending} className="w-full py-2.5 font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
                                        {inviteSending ? 'Sending...' : 'Send invite'}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Interested Tasks */}
                        <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-8">
                            <h2 className="text-xl font-bold mb-4 text-zinc-800 dark:text-zinc-200">Interested Tasks</h2>
                            <p className="text-sm text-zinc-500 mb-4">
                                A list of active tasks you are following.
                            </p>

                            {!userProfile ? (
                                <p className="text-zinc-500">Loading interests...</p>
                            ) : userProfile.interestedTasks.length === 0 ? (
                                <div className="text-center py-8 text-zinc-500">
                                    <p>No active interested tasks.</p>
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                    {userProfile.interestedTasks.map(task => (
                                        <div key={task.id} className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors group">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h4 className="font-bold text-zinc-900 dark:text-zinc-200">{task.title}</h4>
                                                    <p className="text-xs text-zinc-500 mt-1">
                                                        Board: <span className="font-semibold text-zinc-700 dark:text-zinc-400">{task.board_name}</span>
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </div>
        </div >
    );
}
