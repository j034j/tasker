
import { useState } from 'react';
import { Button } from './ui/Button';
import { useStore } from '@/lib/store';
import { Lock, Globe } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

import { DraggableModalWrapper } from './ui/DraggableModalWrapper';

interface CreateBoardModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function CreateBoardModal({ isOpen, onClose }: CreateBoardModalProps) {
    const { createBoard, orgId } = useStore();
    const { t } = useLanguage();
    const [name, setName] = useState('');
    const [isPublic, setIsPublic] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orgId) return;

        setLoading(true);
        try {
            await createBoard(name.trim(), orgId, isPublic);
            onClose();
            setName('');
            setIsPublic(false);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <DraggableModalWrapper isOpen={isOpen} onClose={onClose} className="w-[92vw] max-w-xs">
            <div className="p-5 bg-white dark:bg-zinc-900">
                <div className="modal-handle cursor-move -mx-5 -mt-5 px-5 py-4 mb-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800">
                    <h2 className="text-xl font-bold">{t('create_board_title')}</h2>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Inline Name Input */}
                    <div className="flex items-center gap-4">
                        <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 w-24">{t('board_name_label')}</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="flex-1 px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                            placeholder={t('board_name_placeholder')}
                            autoFocus
                        />
                    </div>

                    {/* Explicit Visibility Selection */}
                    <div className="space-y-3">
                        <label className="block text-xs font-bold uppercase text-muted-foreground tracking-wider">{t('visibility_label')}</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setIsPublic(false)}
                                className={`p-4 rounded-xl border-2 text-left transition-all ${!isPublic ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 ring-1 ring-indigo-500' : 'border-zinc-200 dark:border-zinc-700 bg-transparent hover:border-zinc-300 dark:hover:border-zinc-600'}`}
                            >
                                <Lock className={`w-6 h-6 mb-2 ${!isPublic ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-400'}`} />
                                <div className={`font-bold text-sm ${!isPublic ? 'text-indigo-900 dark:text-indigo-100' : 'text-zinc-900 dark:text-zinc-100'}`}>{t('vis_private')}</div>
                                <div className="text-[10px] text-muted-foreground leading-tight mt-1">{t('vis_private_desc')}</div>
                            </button>

                            <button
                                type="button"
                                onClick={() => setIsPublic(true)}
                                className={`p-4 rounded-xl border-2 text-left transition-all ${isPublic ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 ring-1 ring-indigo-500' : 'border-zinc-200 dark:border-zinc-700 bg-transparent hover:border-zinc-300 dark:hover:border-zinc-600'}`}
                            >
                                <Globe className={`w-6 h-6 mb-2 ${isPublic ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-400'}`} />
                                <div className={`font-bold text-sm ${isPublic ? 'text-indigo-900 dark:text-indigo-100' : 'text-zinc-900 dark:text-zinc-100'}`}>{t('vis_public')}</div>
                                <div className="text-[10px] text-muted-foreground leading-tight mt-1">{t('vis_public_desc')}</div>
                            </button>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
                            {t('cancel')}
                        </Button>
                        <Button type="submit" disabled={loading} className="px-6">
                            {loading ? t('creating_board_btn') : t('create_board_btn')}
                        </Button>
                    </div>
                </form>
            </div>
        </DraggableModalWrapper>
    );
}
