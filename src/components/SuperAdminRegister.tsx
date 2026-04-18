import { useState } from 'react';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/Button';
import { useNavigate } from 'react-router-dom';

export function SuperAdminRegister() {
    const { registerSuperAdmin } = useStore();
    const navigate = useNavigate();

    const [secret, setSecret] = useState('');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            await registerSuperAdmin({ secret: secret.trim(), name, email, password });
            navigate('/', { replace: true });
        } catch (err: unknown) {
            const axiosErr = err as { response?: { status?: number; data?: { error?: string } } };
            if (axiosErr?.response?.status === 403) {
                setError('Invalid Super Admin Secret. Use the server SUPER_ADMIN_SECRET value and try again.');
            } else {
                setError(axiosErr?.response?.data?.error || 'Registration failed');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
            <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-8">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-orange-600">
                        Super Admin
                    </h1>
                    <p className="text-zinc-500 mt-2">System Governance Access</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800 mb-4">
                        <p className="text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
                            <span className="font-bold">Note:</span> This is for creating a NEW System Admin.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                            Secret Key
                        </label>
                        <input
                            type="password"
                            value={secret}
                            onChange={(e) => setSecret(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-red-500 transition-all font-mono text-sm"
                            placeholder="Server Environment Secret"
                            required
                        />
                        <p className="text-[10px] text-zinc-400 mt-1">
                            Lost your secret? Check your server's <code>SUPER_ADMIN_SECRET</code> env var.
                        </p>
                    </div>

                    <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                        <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                            Admin Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-indigo-500 transition-all"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                            Email Address
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-indigo-500 transition-all"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-indigo-500 transition-all"
                            required
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-lg font-bold text-center animate-in fade-in slide-in-from-top-1">
                            {error}
                        </div>
                    )}

                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 text-base font-bold bg-gradient-to-r from-red-600 to-orange-600 hover:opacity-90 text-white rounded-xl shadow-lg shadow-red-500/20 transition-all"
                    >
                        {loading ? 'Verifying...' : 'Establish Access'}
                    </Button>

                    <div className="text-center mt-4">
                        <a href="/" className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 font-medium">
                            Already have an account? Login here
                        </a>
                    </div>
                </form>
            </div>
        </div>
    );
}
