import { useState } from 'react';
import { Button } from './ui/Button';
import { api } from '@/lib/axios';
import { useStore } from '@/lib/store';
import { useLanguage } from '@/contexts/LanguageContext';

export function AuthScreen() {
    const { t, setLanguage, language } = useLanguage();
    const { login } = useStore();
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [orgName, setOrgName] = useState('');
    const [userName, setUserName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            if (mode === 'register') {
                const { data } = await api.post('/orgs/register', { orgName, userName, email, password });
                // Auto login after register
                login(data.token, data.user, data.orgName || orgName, data.orgId);
            } else {
                const { data } = await api.post('/auth/login', { email, password });
                login(data.token, data.user, data.orgName, data.orgId);
            }
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.error || 'Authentication failed');
        } finally {
            setLoading(false);
        }
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
                    <span className="text-2xl" role="img" aria-label="UK Flag">🇬🇧</span>
                </button>
                <button
                    onClick={() => setLanguage('de')}
                    className={`p-2 rounded-lg transition-all border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 hover:bg-white/80 dark:hover:bg-zinc-800/80 backdrop-blur-sm ${language === 'de' ? 'opacity-100 bg-white/50 dark:bg-zinc-800/50 shadow-sm' : 'opacity-50 hover:opacity-100'}`}
                    title="Deutsch"
                >
                    <span className="text-2xl" role="img" aria-label="German Flag">🇩🇪</span>
                </button>
            </div>

            <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
                {/* Ambient Background */}
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-50/50 via-background to-purple-50/50 dark:from-indigo-950/20 dark:to-purple-950/20 animate-in fade-in duration-1000" />
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />

                <div className="max-w-md w-full bg-white dark:bg-zinc-900 shadow-2xl shadow-indigo-500/10 rounded-3xl p-10 relative z-10 border border-zinc-100 dark:border-zinc-800 flex flex-col items-center">
                    <div className="text-center mb-8">
                        <h1 className="text-4xl font-black mb-2 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">{t('app_title')}</h1>
                        <p className="text-muted-foreground font-medium">{t('welcome_subtitle')}</p>
                    </div>

                    <form onSubmit={handleSubmit} className="w-full flex flex-col items-center gap-4">
                        {mode === 'register' && (
                            <>
                                <div className="w-2/3 space-y-1">
                                    <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider ml-1">Organization</label>
                                    <input
                                        required
                                        type="text"
                                        value={orgName}
                                        onChange={(e) => setOrgName(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm font-medium text-center"
                                        placeholder="Acme Corp"
                                    />
                                </div>
                                <div className="w-2/3 space-y-1">
                                    <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider ml-1">Your Name</label>
                                    <input
                                        required
                                        type="text"
                                        value={userName}
                                        onChange={(e) => setUserName(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm font-medium text-center"
                                        placeholder="John Doe"
                                    />
                                </div>
                            </>
                        )}

                        <div className="w-2/3 space-y-1">
                            <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider ml-1">Email</label>
                            <input
                                required
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm font-medium text-center"
                                placeholder="name@example.com"
                            />
                        </div>

                        <div className="w-2/3 space-y-1">
                            <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider ml-1">Password</label>
                            <input
                                required
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm font-medium text-center"
                                placeholder="••••••••"
                            />
                        </div>

                        {error && (
                            <div className="w-2/3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-bold text-center">
                                {error}
                            </div>
                        )}

                        <Button type="submit" disabled={loading} className="w-2/3 py-6 mt-2 text-base rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/30">
                            {loading ? 'Processing...' : (mode === 'login' ? 'Sign In' : 'Create Account')}
                        </Button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800 w-full flex justify-center">
                        {mode === 'login' ? (
                            <p className="text-sm text-muted-foreground">
                                Don't have an account?{' '}
                                <button onClick={() => setMode('register')} className="font-bold text-indigo-600 hover:text-indigo-700 hover:underline transition-all">
                                    Register
                                </button>
                            </p>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                Already have an account?{' '}
                                <button onClick={() => setMode('login')} className="font-bold text-indigo-600 hover:text-indigo-700 hover:underline transition-all">
                                    Log In
                                </button>
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
