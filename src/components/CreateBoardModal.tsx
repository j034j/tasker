
import { useEffect, useId, useState } from 'react';
import { Button } from './ui/Button';
import { useStore } from '@/lib/store';
import { api } from '@/lib/axios';
import { Lock, Globe, CheckCircle2, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

import { DraggableModalWrapper } from './ui/DraggableModalWrapper';

interface CreateBoardModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function CreateBoardModal({ isOpen, onClose }: CreateBoardModalProps) {
    const { createBoard, orgId } = useStore();
    const { t } = useLanguage();
    const departmentListId = useId();
    const [name, setName] = useState('');
    const [isPublic, setIsPublic] = useState(false);
    const [loading, setLoading] = useState(false);
    const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
    const [departmentName, setDepartmentName] = useState('');

    const resetForm = () => {
        setName('');
        setIsPublic(false);
        setDepartmentName('');
    };

    const loadDepartments = async (nextOrgId: string) => {
        try {
            const { data } = await api.get(`/orgs/${nextOrgId}/departments`);
            setDepartments(Array.isArray(data?.departments) ? data.departments : []);
        } catch (err) {
            console.error('Failed to load departments', err);
        }
    };

    const resolveDepartmentId = async () => {
        const trimmedDepartmentName = departmentName.trim();
        if (!trimmedDepartmentName || !orgId) {
            return null;
        }

        const existingDepartment = departments.find((department) => department.name.trim().toLowerCase() === trimmedDepartmentName.toLowerCase());
        if (existingDepartment) {
            return existingDepartment.id;
        }

        const { data } = await api.post(`/orgs/${orgId}/departments`, { name: trimmedDepartmentName });
        const createdDepartment = {
            id: String(data?.id),
            name: typeof data?.name === 'string' ? data.name : trimmedDepartmentName
        };
        setDepartments((currentDepartments) => [...currentDepartments, createdDepartment]);
        return createdDepartment.id;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orgId) return;

        setLoading(true);
        try {
            const departmentId = await resolveDepartmentId();
            await createBoard(name.trim(), orgId, isPublic, departmentId);
            onClose();
            resetForm();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isOpen) {
            resetForm();
            return;
        }
        if (!orgId) return;
        loadDepartments(orgId).catch(console.error);
    }, [isOpen, orgId]);

    return (
        <DraggableModalWrapper isOpen={isOpen} onClose={onClose} className="w-[92vw] max-w-md overflow-hidden bg-white dark:bg-zinc-900 border-0 shadow-2xl rounded-2xl">
            <div className="relative">
                {/* Decorative Header Background */}
                <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 dark:from-indigo-500/20 dark:via-purple-500/20 dark:to-pink-500/20 opacity-50 pointer-events-none" />

                <div className="modal-handle cursor-move relative p-6 pb-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-inner">
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">{t('create_board_title')}</h2>
                        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-0.5">Start a new project space</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 pt-2 space-y-6 relative z-10">
                    {/* Modern Name Input */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 ml-1">
                            {t('board_name_label')}
                        </label>
                        <div className="relative group">
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-zinc-900 transition-all font-semibold text-zinc-900 dark:text-zinc-100 shadow-sm"
                                placeholder={t('board_name_placeholder')}
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Enhanced Visibility Selection */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 ml-1">
                            {t('visibility_label')}
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setIsPublic(false)}
                                className={`relative p-4 rounded-xl border-2 text-left transition-all duration-200 group overflow-hidden ${!isPublic ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-md' : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-sm'}`}
                            >
                                {!isPublic && (
                                    <div className="absolute top-3 right-3 text-indigo-500">
                                        <CheckCircle2 className="w-5 h-5 fill-indigo-100 dark:fill-indigo-900" />
                                    </div>
                                )}
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 transition-colors ${!isPublic ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 group-hover:text-indigo-500'}`}>
                                    <Lock className="w-5 h-5" />
                                </div>
                                <div className={`font-bold text-sm mb-1 ${!isPublic ? 'text-indigo-900 dark:text-indigo-100' : 'text-zinc-900 dark:text-zinc-100'}`}>{t('vis_private')}</div>
                                <div className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed pr-4">{t('vis_private_desc')}</div>
                            </button>

                            <button
                                type="button"
                                onClick={() => setIsPublic(true)}
                                className={`relative p-4 rounded-xl border-2 text-left transition-all duration-200 group overflow-hidden ${isPublic ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-md' : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-sm'}`}
                            >
                                {isPublic && (
                                    <div className="absolute top-3 right-3 text-indigo-500">
                                        <CheckCircle2 className="w-5 h-5 fill-indigo-100 dark:fill-indigo-900" />
                                    </div>
                                )}
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 transition-colors ${isPublic ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 group-hover:text-indigo-500'}`}>
                                    <Globe className="w-5 h-5" />
                                </div>
                                <div className={`font-bold text-sm mb-1 ${isPublic ? 'text-indigo-900 dark:text-indigo-100' : 'text-zinc-900 dark:text-zinc-100'}`}>{t('vis_public')}</div>
                                <div className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed pr-4">{t('vis_public_desc')}</div>
                            </button>
                        </div>
                    </div>

                    {/* Department Selector */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 ml-1">Department (optional)</label>
                        <input
                            type="text"
                            list={departmentListId}
                            value={departmentName}
                            onChange={(e) => setDepartmentName(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 focus:outline-none focus:border-indigo-500 transition-all text-zinc-900 dark:text-zinc-100"
                            placeholder="Type a department or choose an existing one"
                        />
                        <datalist id={departmentListId}>
                            {departments.map((department) => (
                                <option key={department.id} value={department.name} />
                            ))}
                        </datalist>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 ml-1">
                            Enter a new department name here, or pick one already in this workspace.
                        </p>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={loading} className="px-5 font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
                            {t('cancel')}
                        </Button>
                        <Button type="submit" disabled={loading} className="px-8 font-bold shadow-md hover:shadow-lg transition-all active:scale-[0.98]">
                            {loading ? t('creating_board_btn') : t('create_board_btn')}
                        </Button>
                    </div>
                </form>
            </div>
        </DraggableModalWrapper>
    );
}
