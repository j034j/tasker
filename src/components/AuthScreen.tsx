import { useEffect, useState } from 'react';
import { Button } from './ui/Button';
import { VerificationCodeModal } from './VerificationCodeModal';
import { api } from '@/lib/axios';
import { useStore } from '@/lib/store';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';

type AuthErrorUi = {
    message: string;
    hint?: string;
};

const normalizeAuthError = (mode: 'login' | 'create-org' | 'join-org', err: unknown, fallback: string): AuthErrorUi => {
    const axiosErr = err as { response?: { data?: { error?: string } }; code?: string };
    const serverMessage = axiosErr?.response?.data?.error || '';
    const lowered = serverMessage.toLowerCase();

    if (lowered.includes('user not found')) {
        return { message: 'No account found for that email.', hint: 'Use Create Workspace or Join Workspace first, then sign in.' };
    }
    if (lowered.includes('invalid password')) {
        return { message: 'Password is incorrect.', hint: 'Retry your password or use Forgot Password.' };
    }
    if (lowered.includes('email already registered')) {
        return mode === 'login'
            ? { message: 'This email is already registered.', hint: 'Switch to Sign In and use your existing password.' }
            : { message: 'This email is already registered.', hint: 'Use Sign In instead of creating a new account with this email.' };
    }
    if (lowered.includes('username already registered')) {
        return { message: 'Username is already taken.', hint: 'Choose another username and try again.' };
    }
    if (lowered.includes('email not verified')) {
        return { message: 'Email verification is required.', hint: 'Send code to your email and verify it before creating the account.' };
    }
    if (lowered.includes('verification code')) {
        return { message: serverMessage || 'Invalid verification code.', hint: 'Request a new code if the current one expired.' };
    }
    if (lowered.includes('organization name already exists')) {
        return { message: 'Organization name already exists.', hint: 'Choose another organization name or use Join Workspace.' };
    }
    if (axiosErr?.code === 'ECONNABORTED' || axiosErr?.code === 'ERR_NETWORK') {
        return { message: 'Cannot reach server.', hint: 'Ensure backend is running on http://localhost:3000 and retry.' };
    }
    if (serverMessage) {
        return { message: serverMessage };
    }
    return { message: fallback };
};

export function AuthScreen() {
    const { t, setLanguage, language } = useLanguage();
    const { login } = useStore();
    const navigate = useNavigate();
    const [mode, setMode] = useState<'login' | 'create-org' | 'join-org'>('login');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<AuthErrorUi | null>(null);

    // Form State
    const [orgName, setOrgName] = useState('');
    const [userName, setUserName] = useState('');
    const [username, setUsername] = useState('');
    const [loginIdentifier, setLoginIdentifier] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [skills, setSkills] = useState('');
    const [location, setLocation] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [verificationToken, setVerificationToken] = useState<string | null>(null);
    const [verificationCodeSent, setVerificationCodeSent] = useState(false);
    const [verificationBusy, setVerificationBusy] = useState(false);

    // Modal State
    const [showVerificationModal, setShowVerificationModal] = useState(false);
    const [modalCode, setModalCode] = useState('');

    // Join Flow State
    const [foundOrgs, setFoundOrgs] = useState<{ id: string; name: string; creatorName: string; boards: { id: string; name: string }[] }[] | null>(null);
    const [selectedOrg, setSelectedOrg] = useState<{ id: string; name: string; boards?: { id: string; name: string }[] } | null>(null);
    const [joinedBoardIds, setJoinedBoardIds] = useState<string[]>([]);
    const [orgSearchLoading, setOrgSearchLoading] = useState(false);
    const [activeOrgIndex, setActiveOrgIndex] = useState(0);

    type OrgSearchResult = { id: string; name: string; boards?: { id: string; name: string }[] };
    const handleSelectOrg = (org: OrgSearchResult) => {
        setSelectedOrg(org);
        setOrgName(org.name);
    };

    const handleOrgSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!foundOrgs || foundOrgs.length === 0 || selectedOrg) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveOrgIndex((prev) => (prev + 1) % foundOrgs.length);
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveOrgIndex((prev) => (prev - 1 + foundOrgs.length) % foundOrgs.length);
            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSelectOrg(foundOrgs[activeOrgIndex]);
            return;
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            setFoundOrgs(null);
            setActiveOrgIndex(0);
        }
    };

    const handleLookupOrg = async () => {
        const query = orgName.trim();
        if (!query) return;
        setOrgSearchLoading(true);
        setError(null);
        try {
            const { data } = await api.get(`/orgs/search?q=${encodeURIComponent(query)}`);
            const orgs = Array.isArray(data) ? data : [];
            setFoundOrgs(orgs);
            setActiveOrgIndex(0);
            if (orgs.length === 1) setSelectedOrg(orgs[0]);
        } catch (err: unknown) {
            setError(normalizeAuthError(mode, err, t('auth_org_not_found')));
            setFoundOrgs([]);
        } finally {
            setOrgSearchLoading(false);
        }
    };

    useEffect(() => {
        if (mode === 'login') {
            setVerificationToken(null);
            setVerificationCode('');
            setVerificationCodeSent(false);
            return;
        }
        setVerificationToken(null);
        setVerificationCode('');
    }, [email, mode]);

    useEffect(() => {
        if (mode !== 'join-org') return;
        const query = orgName.trim();
        if (!query) {
            setFoundOrgs(null);
            setSelectedOrg(null);
            return;
        }

        const timer = window.setTimeout(async () => {
            setOrgSearchLoading(true);
            try {
                const { data } = await api.get(`/orgs/search?q=${encodeURIComponent(query)}`);
                const orgs = Array.isArray(data) ? data : [];
                setFoundOrgs(orgs);
                setActiveOrgIndex(0);
                if (selectedOrg && !orgs.some((org: OrgSearchResult) => org.id === selectedOrg.id)) {
                    setSelectedOrg(null);
                }
                if (orgs.length === 1 && orgs[0].name.toLowerCase() === query.toLowerCase()) {
                    setSelectedOrg(orgs[0]);
                }
            } catch {
                setFoundOrgs([]);
            } finally {
                setOrgSearchLoading(false);
            }
        }, 250);

        return () => window.clearTimeout(timer);
    }, [mode, orgName, selectedOrg]);

    const handleRequestVerificationCode = async () => {
        if (!email) {
            setError({ message: 'Enter your email first.' });
            return;
        }
        setVerificationBusy(true);
        setError(null);
        try {
            const { data } = await api.post('/auth/email-verification/request', { email, purpose: 'register' });
            setVerificationCodeSent(true);
            setVerificationToken(null);
            if (data.verificationCode) {
                setModalCode(data.verificationCode);
                setShowVerificationModal(true);
            } else {
                setError({ message: 'Verification code sent. Check your inbox.', hint: 'Enter the 6-digit code below to continue registration.' });
            }
        } catch (err: unknown) {
            setError(normalizeAuthError(mode, err, 'Failed to send verification code'));
        } finally {
            setVerificationBusy(false);
        }
    };

    const handleVerifyCode = async () => {
        if (!email || !verificationCode) {
            setError({ message: 'Enter email and verification code first.' });
            return;
        }
        setVerificationBusy(true);
        setError(null);
        try {
            const { data } = await api.post('/auth/email-verification/verify', {
                email,
                code: verificationCode,
                purpose: 'register'
            });
            setVerificationToken(data.verificationToken);
            setError({ message: 'Email verified successfully.' });
        } catch (err: unknown) {
            setError(normalizeAuthError(mode, err, 'Failed to verify email code'));
        } finally {
            setVerificationBusy(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            if (mode === 'create-org') {
                if (!verificationToken) {
                    setError({ message: 'Verify your email before creating workspace.' });
                    setLoading(false);
                    return;
                }
                const { data } = await api.post('/orgs/register', { orgName, userName, username, email, password, phoneNumber, skills, location, verificationToken });
                login(data.token, data.user, data.orgName || orgName, data.orgId);
                navigate('/', { replace: true });
            } else if (mode === 'join-org') {
                if (!selectedOrg) {
                    setError({ message: t('auth_select_org_err') });
                    setLoading(false);
                    return;
                }
                if (!verificationToken) {
                    setError({ message: 'Verify your email before joining workspace.' });
                    setLoading(false);
                    return;
                }
                const { data } = await api.post('/auth/register', {
                    email, password, userName, username,
                    orgId: selectedOrg.id,
                    joinedBoardIds,
                    phoneNumber,
                    skills,
                    location,
                    verificationToken
                });
                login(data.token, data.user, data.orgName, data.orgId);
                navigate('/', { replace: true });
            } else {
                const identifier = loginIdentifier.trim();
                if (!identifier || !password) {
                    setError({ message: 'Enter your email/username and password.' });
                    setLoading(false);
                    return;
                }
                const { data } = await api.post('/auth/login', { identifier, password });
                login(data.token, data.user, data.orgName, data.orgId);
                navigate('/', { replace: true });
            }
        } catch (err: unknown) {
            console.error(err);
            setError(normalizeAuthError(mode, err, t('auth_auth_failed')));
        } finally {
            setLoading(false);
        }
    };

    const toggleBoardJoin = (id: string) => {
        setJoinedBoardIds(prev => prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]);
    };

    return (
        <>
            {/* Language Toggle (Fixed Top Right) */}
            <div className="fixed top-4 right-4 z-[100] flex gap-2">
                <button
                    onClick={() => setLanguage('en')}
                    className={`p-2 rounded-lg transition-all border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 hover:bg-white/80 dark:hover:bg-zinc-800/80 backdrop-blur-sm ${language === 'en' ? 'opacity-100 bg-white/50 dark:bg-zinc-800/50 shadow-sm' : 'opacity-50 hover:opacity-100'}`}
                    title="English"
                >
                    <svg width="24" height="18" viewBox="0 0 24 18" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-6 h-4.5">
                        <path d="M0 0H24V18H0V0Z" fill="#012169"/>
                        <path d="M0 0L24 18M24 0L0 18" stroke="white" strokeWidth="2"/>
                        <path d="M0 0L24 18M24 0L0 18" stroke="#C8102E" strokeWidth="1"/>
                        <path d="M12 0V18M0 9H24" stroke="white" strokeWidth="3"/>
                        <path d="M12 0V18M0 9H24" stroke="#C8102E" strokeWidth="2"/>
                    </svg>
                </button>
                <button
                    onClick={() => setLanguage('de')}
                    className={`p-2 rounded-lg transition-all border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 hover:bg-white/80 dark:hover:bg-zinc-800/80 backdrop-blur-sm ${language === 'de' ? 'opacity-100 bg-white/50 dark:bg-zinc-800/50 shadow-sm' : 'opacity-50 hover:opacity-100'}`}
                    title="Deutsch"
                >
                    <svg width="24" height="18" viewBox="0 0 24 18" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-6 h-4.5">
                        <path d="M0 0H24V6H0V0Z" fill="#000"/>
                        <path d="M0 6H24V12H0V6Z" fill="#DD0000"/>
                        <path d="M0 12H24V18H0V12Z" fill="#FFCC00"/>
                    </svg>
                </button>
            </div>

            <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
                {/* Ambient Background */}
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-50/50 via-background to-purple-50/50 dark:from-indigo-950/20 dark:to-purple-950/20 animate-in fade-in duration-1000" />
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />

                <div className="max-w-sm w-full bg-white dark:bg-zinc-900 shadow-2xl shadow-indigo-500/10 rounded-3xl p-8 relative z-10 border border-zinc-100 dark:border-zinc-800 flex flex-col items-center">
                    <div className="text-center mb-6">
                        <h1 className="text-3xl font-black mb-2 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">{t('app_title')}</h1>
                        <p className="text-muted-foreground font-medium text-sm">{t('welcome_subtitle')}</p>
                    </div>

                    {/* Mode Toggle */}
                    <div className="flex p-1 bg-zinc-100/50 dark:bg-zinc-800/50 backdrop-blur-sm rounded-2xl mb-8 w-72 border border-zinc-200/50 dark:border-zinc-700/50">
                        <button
                            onClick={() => { setMode('login'); setError(null); }}
                            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${mode === 'login' ? 'bg-white dark:bg-zinc-700 shadow-sm text-indigo-600' : 'text-zinc-500 hover:text-zinc-700'}`}
                        >
                            {t('auth_signin')}
                        </button>
                        <button
                            onClick={() => { setMode('create-org'); setError(null); }}
                            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${mode === 'create-org' ? 'bg-white dark:bg-zinc-700 shadow-sm text-indigo-600' : 'text-zinc-500 hover:text-zinc-700'}`}
                        >
                            {t('auth_create')}
                        </button>
                        <button
                            onClick={() => { setMode('join-org'); setError(null); }}
                            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${mode === 'join-org' ? 'bg-white dark:bg-zinc-700 shadow-sm text-indigo-600' : 'text-zinc-500 hover:text-zinc-700'}`}
                        >
                            {t('auth_join')}
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="w-72 flex flex-col items-center gap-4">

                        {/* Create Org Fields */}
                        {mode === 'create-org' && (
                            <div className="w-full space-y-1.5 animate-in fade-in slide-in-from-top-2">
                                <label className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider ml-1">{t('auth_new_org_name')}</label>
                                <input
                                    required
                                    type="text"
                                    value={orgName}
                                    onChange={(e) => setOrgName(e.target.value)}
                                    className="w-full px-4 py-3 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium shadow-sm"
                                    placeholder="Acme Corp"
                                />
                            </div>
                        )}

                        {/* Join Org Fields */}
                        {mode === 'join-org' && (
                            <div className="w-full space-y-4 animate-in fade-in slide-in-from-top-2">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider ml-1">{t('auth_find_org')}</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={orgName}
                                            onChange={(e) => setOrgName(e.target.value)}
                                            onKeyDown={handleOrgSearchKeyDown}
                                            className="flex-1 px-4 py-3 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium shadow-sm"
                                            placeholder="Type organization name..."
                                        />
                                        {foundOrgs ? (
                                            <button
                                                type="button"
                                                onClick={() => { setFoundOrgs(null); setSelectedOrg(null); setOrgName(''); }}
                                                className="px-3 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 rounded-xl text-zinc-600 dark:text-zinc-300"
                                            >
                                                ✕
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={handleLookupOrg}
                                                disabled={!orgName}
                                                className="px-3 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 rounded-xl font-bold text-xs transition-colors"
                                            >
                                                {t('auth_find_btn')}
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                                        {orgSearchLoading ? 'Searching organizations...' : 'Type to filter matching organizations.'}
                                    </p>
                                </div>

                                {foundOrgs && !selectedOrg && foundOrgs.length > 0 && (
                                    <div className="space-y-2 animate-in fade-in">
                                        <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider block">{t('auth_select_org')}</label>
                                        {foundOrgs.map((org, index) => (
                                            <div key={org.id}
                                                onClick={() => handleSelectOrg(org)}
                                                onMouseEnter={() => setActiveOrgIndex(index)}
                                                className={`p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl border cursor-pointer transition-all ${
                                                    activeOrgIndex === index
                                                        ? 'border-indigo-400 ring-1 ring-indigo-300/60 dark:ring-indigo-700/60'
                                                        : 'border-zinc-200 dark:border-zinc-700 hover:border-indigo-400'
                                                }`}
                                            >
                                                <div className="font-bold text-sm">{org.name}</div>
                                                <div className="text-xs text-muted-foreground flex justify-between mt-1">
                                                    <span>{t('auth_creator')} {org.creatorName}</span>
                                                    <span>{org.boards.length} {t('auth_boards')}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {selectedOrg && (
                                    <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl space-y-2 animate-in fade-in slide-in-from-top-2">
                                        <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-bold text-xs">
                                            <span>✓ {t('auth_selected')} {selectedOrg.name}</span>
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider mb-1 block">{t('auth_select_boards')}</label>
                                            <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                                                {(selectedOrg.boards ?? []).map(b => (
                                                    <label key={b.id} className="flex items-center gap-2 p-1.5 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-100 dark:border-zinc-700 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition-all">
                                                        <input
                                                            type="checkbox"
                                                            checked={joinedBoardIds.includes(b.id)}
                                                            onChange={() => toggleBoardJoin(b.id)}
                                                            className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                                                        />
                                                        <span className="text-xs font-medium">{b.name}</span>
                                                    </label>
                                                ))}
                                                {(selectedOrg.boards ?? []).length === 0 && <p className="text-xs text-muted-foreground italic">{t('auth_no_boards')}</p>}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Common User Fields */}
                        {(mode === 'create-org' || (mode === 'join-org' && foundOrgs)) && (
                            <div className="w-full space-y-1.5 animate-in fade-in slide-in-from-top-2">
                                <label className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider ml-1">{t('auth_your_name')}</label>
                                <input
                                    required
                                    type="text"
                                    value={userName}
                                    onChange={(e) => setUserName(e.target.value)}
                                    className="w-full px-4 py-3 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium shadow-sm"
                                    placeholder="John Doe"
                                />
                            </div>
                        )}
                        {(mode === 'create-org' || (mode === 'join-org' && foundOrgs)) && (
                            <div className="w-full space-y-1.5 animate-in fade-in slide-in-from-top-2">
                                <label className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider ml-1">Username</label>
                                <input
                                    required
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full px-4 py-3 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium shadow-sm"
                                    placeholder="e.g. mason_john"
                                />
                            </div>
                        )}

                        <div className="w-full space-y-1.5">
                            <label className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider ml-1">
                                {mode === 'login' ? 'Email or Username' : t('auth_email')}
                            </label>
                            <input
                                required
                                type={mode === 'login' ? 'text' : 'email'}
                                autoComplete={mode === 'login' ? 'username' : 'email'}
                                value={mode === 'login' ? loginIdentifier : email}
                                onChange={(e) => mode === 'login' ? setLoginIdentifier(e.target.value) : setEmail(e.target.value)}
                                className="w-full px-4 py-3 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium shadow-sm"
                                placeholder={mode === 'login' ? 'your_email_or_username' : 'name@example.com'}
                            />
                        </div>
                        {mode !== 'login' && (
                            <div className="w-full rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-50/60 dark:bg-zinc-900/60 p-3 space-y-2">
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleRequestVerificationCode}
                                        disabled={verificationBusy || !email}
                                        className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold disabled:opacity-50"
                                    >
                                        {verificationBusy ? 'Sending...' : (verificationCodeSent ? 'Resend Code' : 'Send Verification Code')}
                                    </button>
                                    {verificationToken && (
                                        <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Email verified</span>
                                    )}
                                </div>
                                {verificationCodeSent && !verificationToken && (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={verificationCode}
                                            onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                            className="flex-1 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
                                            placeholder="Enter 6-digit code"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleVerifyCode}
                                            disabled={verificationBusy || verificationCode.length !== 6}
                                            className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-50"
                                        >
                                            Verify
                                        </button>
                                    </div>
                                )}

                                {foundOrgs && !selectedOrg && foundOrgs.length === 0 && orgName.trim().length > 0 && (
                                    <div className="text-xs text-zinc-500 dark:text-zinc-400 p-2">
                                        No matching organizations found.
                                    </div>
                                )}
                                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">We send a 6-digit verification code. It expires in 24 hours.</p>
                            </div>
                        )}

                        {/* Phone Number - Only for Register Flows */}
                        {(mode === 'create-org' || mode === 'join-org') && (
                            <div className="w-full space-y-1.5 animate-in fade-in slide-in-from-top-2">
                                <label className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider ml-1">{t('auth_phone_optional') || 'Phone Number (Optional)'}</label>
                                <input
                                    type="tel"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    className="w-full px-4 py-3 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium shadow-sm"
                                    placeholder="+1 234 567 8900"
                                />
                            </div>
                        )}

                        {(mode === 'create-org' || mode === 'join-org') && (
                            <div className="w-full space-y-1.5 animate-in fade-in slide-in-from-top-2">
                                <label className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider ml-1">Skills (Optional)</label>
                                <input
                                    type="text"
                                    value={skills}
                                    onChange={(e) => setSkills(e.target.value)}
                                    className="w-full px-4 py-3 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium shadow-sm"
                                    placeholder="e.g. Carpenter, Mechanic, Electrician, Roofer, Welder"
                                />
                            </div>
                        )}

                        {(mode === 'create-org' || mode === 'join-org') && (
                            <div className="w-full space-y-1.5 animate-in fade-in slide-in-from-top-2">
                                <label className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider ml-1">Location (Optional)</label>
                                <input
                                    type="text"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    className="w-full px-4 py-3 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium shadow-sm"
                                    placeholder="e.g. Munich / Remote"
                                />
                            </div>
                        )}

                        <div className="w-full space-y-1.5">
                            <label className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider ml-1">{t('auth_password')}</label>
                            <input
                                type="password"
                                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-indigo-500 transition-all"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                        {error && (
                            <div className="w-full p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs">
                                <p className="font-bold">{error.message}</p>
                                {error.hint && <p className="mt-1 font-medium opacity-90">{error.hint}</p>}
                            </div>
                        )}

                        <Button type="submit" disabled={loading} className="w-full py-4 mt-4 text-sm font-bold rounded-2xl bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-500/20 transition-all scale-100 hover:scale-[1.02] active:scale-[0.98]">
                            {loading ? t('auth_processing') : (mode === 'login' ? t('auth_signin') : (mode === 'create-org' ? t('auth_create_join') : t('auth_join_workspace_btn')))}
                        </Button>
                        <div className="flex justify-center mt-3">
                            <a href="/forgot-password" className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline opacity-80 hover:opacity-100 transition-opacity">
                                Forgot Password?
                            </a>
                        </div>
                    </form>


                    <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800 w-full flex justify-center text-center">
                        {mode === 'login' ? (
                            <div className="text-xs text-muted-foreground">
                                {t('auth_no_account')}<br />
                                <div className="flex gap-4 justify-center mt-2">
                                    <button onClick={() => setMode('create-org')} className="font-bold text-indigo-600 hover:text-indigo-700 hover:underline transition-all">
                                        {t('auth_create_workspace')}
                                    </button>
                                    <span className="text-zinc-300 dark:text-zinc-700">|</span>
                                    <button onClick={() => setMode('join-org')} className="font-bold text-indigo-600 hover:text-indigo-700 hover:underline transition-all">
                                        {t('auth_join_workspace')}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground">
                                {t('auth_have_account')}{' '}
                                <button onClick={() => setMode('login')} className="font-bold text-indigo-600 hover:text-indigo-700 hover:underline transition-all">
                                    {t('auth_login')}
                                </button>
                            </p>
                        )}
                    </div>

                    <div className="mt-8 text-center">
                        <a href="/super-admin" className="text-[10px] text-zinc-300 dark:text-zinc-700 hover:text-zinc-500 dark:hover:text-zinc-500 transition-colors uppercase tracking-widest font-bold">
                            System Admin Access
                        </a>
                    </div>
                </div>
            </div>
            {showVerificationModal && (
                <VerificationCodeModal
                    code={modalCode}
                    onClose={() => setShowVerificationModal(false)}
                />
            )}
        </>
    );
}
