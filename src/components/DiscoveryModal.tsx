
import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { api } from '@/lib/axios';
import { Button } from './ui/Button';
import { Search, Globe, Check, ArrowRightLeft } from 'lucide-react';
import { DraggableModalWrapper } from './ui/DraggableModalWrapper';

interface DiscoveryModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialTab?: 'boards' | 'orgs';
}

const hasFollower = (followers: string | undefined, userId: string | undefined) => {
    if (!followers || !userId) return false;
    return followers.split(',').map((id) => id.trim()).filter(Boolean).includes(userId);
};

export function DiscoveryModal({ isOpen, onClose, initialTab = 'boards' }: DiscoveryModalProps) {
    const { boards, currentUser, toggleBoardFollow, orgId, switchOrganization } = useStore();
    const [activeTab, setActiveTab] = useState<'boards' | 'orgs'>(initialTab);

    // Org Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [foundOrgs, setFoundOrgs] = useState<{ id: string; name: string; creator_name?: string; boards?: { id: string; name: string; is_public?: boolean; creator_name?: string }[] }[] | null>(null);
    const [loadingOrgs, setLoadingOrgs] = useState(false);
    const [switching, setSwitching] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setActiveTab(initialTab);
            setFoundOrgs(null);
            setSearchQuery('');
        }
    }, [isOpen, initialTab]);

    const handleSearchOrgs = async () => {
        if (!searchQuery.trim()) return;
        setLoadingOrgs(true);
        try {
            const { data } = await api.get(`/orgs/lookup?name=${encodeURIComponent(searchQuery)}`);
            setFoundOrgs(Array.isArray(data) ? data : [data]);
        } catch {
            setFoundOrgs([]);
        } finally {
            setLoadingOrgs(false);
        }
    };

    const handleSwitchOrg = async (targetOrgId: string) => {
        if (confirm("Switching organizations will reload your dashboard. Continue?")) {
            setSwitching(true);
            try {
                await switchOrganization(targetOrgId);
                onClose();
            } catch {
                alert("Failed to switch organization.");
            } finally {
                setSwitching(false);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <DraggableModalWrapper isOpen={isOpen} onClose={onClose} className="w-full max-w-2xl flex flex-col max-h-[80vh]">
            {/* Header */}
            <div className="modal-handle cursor-move p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-800">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <Globe className="w-5 h-5 text-indigo-500" />
                    Discovery
                </h2>
                <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                    ✕
                </button>
            </div>

            {/* Tabs */}
            <div className="flex px-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                <button
                    onClick={() => setActiveTab('boards')}
                    className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'boards' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
                >
                    Browse Boards
                </button>
                <button
                    onClick={() => setActiveTab('orgs')}
                    className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'orgs' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
                >
                    Switch Organization
                </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto min-h-[300px] flex-1 bg-white dark:bg-zinc-900">

                {/* BOARDS TAB */}
                {activeTab === 'boards' && (
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground mb-4">
                            Join boards in your organization to see them in your dashboard.
                        </p>
                        <div className="grid gap-3">
                            {boards.map(board => {
                                const isJoined = hasFollower(board.followers, currentUser?.id);
                                return (
                                    <div key={board.id} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                                                <Globe className={`w-5 h-5 ${board.is_public ? "text-indigo-500" : "text-zinc-400"}`} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-sm flex items-center gap-2">
                                                    {board.name}
                                                    {board.is_public ? (
                                                        <span className="text-[10px] uppercase font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">Public</span>
                                                    ) : (
                                                        <span className="text-[10px] uppercase font-bold text-zinc-600 bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 rounded-full">Private</span>
                                                    )}
                                                </h3>
                                                <p className="text-xs text-muted-foreground">Created by {board.creator_name || 'Unknown'}</p>
                                            </div>
                                        </div>
                                        <Button
                                            onClick={() => toggleBoardFollow(board.id)}
                                            variant={isJoined ? "outline" : "default"}
                                            size="sm"
                                            className={isJoined ? "opacity-70 hover:opacity-100 hover:bg-red-50 hover:text-red-600 hover:border-red-200" : ""}
                                        >
                                            {isJoined ? "Leave" : "Join"}
                                        </Button>
                                    </div>
                                );
                            })}
                            {boards.length === 0 && (
                                <div className="text-center py-10 text-muted-foreground">
                                    No boards found in this organization.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ORGS TAB */}
                {activeTab === 'orgs' && (
                    <div className="space-y-6">
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search for an organization..."
                                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearchOrgs()}
                                />
                            </div>
                            <Button onClick={handleSearchOrgs} disabled={loadingOrgs}>
                                {loadingOrgs ? 'Searching...' : 'Search'}
                            </Button>
                        </div>

                        <div className="space-y-2">
                            {foundOrgs?.map(org => {
                                const isCurrent = org.id === orgId;
                                return (
                                    <div key={org.id} className="flex flex-col p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 animate-in fade-in slide-in-from-bottom-2">
                                        <div className="flex items-center justify-between w-full">
                                            <div>
                                                <h3 className="font-bold text-sm">{org.name}</h3>
                                                <p className="text-xs text-muted-foreground">{org.boards?.length || 0} Boards • Creator: {org.creator_name || 'Unknown'}</p>
                                            </div>
                                            {isCurrent ? (
                                                <span className="text-xs font-bold text-green-600 bg-green-100 dark:bg-green-900/30 px-3 py-1 rounded-full flex items-center gap-1">
                                                    <Check className="w-3 h-3" /> Current
                                                </span>
                                            ) : (
                                                <Button
                                                    onClick={() => handleSwitchOrg(org.id)}
                                                    disabled={switching}
                                                    size="sm"
                                                    variant="ghost"
                                                    className="gap-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                                                >
                                                    <ArrowRightLeft className="w-4 h-4" /> Switch
                                                </Button>
                                            )}
                                        </div>

                                        {/* Boards List in Search Result */}
                                        {org.boards && org.boards.length > 0 && (
                                            <div className="mt-3 pl-4 border-l-2 border-zinc-200 dark:border-zinc-700 space-y-2">
                                                <p className="text-xs font-semibold text-muted-foreground uppercase">Boards in this Organization:</p>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {org.boards.map((board: { id: string; name: string; is_public?: boolean; creator_name?: string }) => (
                                                        <div key={board.id} className="flex items-center justify-between p-2 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-100 dark:border-zinc-800">
                                                            <div className="flex items-center gap-2">
                                                                <Globe className={`w-4 h-4 ${board.is_public ? "text-indigo-500" : "text-zinc-400"}`} />
                                                                <div>
                                                                    <span className="text-sm font-medium block">{board.name}</span>
                                                                    <span className="text-[10px] text-muted-foreground">
                                                                        By {board.creator_name || 'Unknown'} • {board.is_public ? 'Public' : 'Private'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            {!isCurrent && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="text-xs h-7"
                                                                    onClick={() => {
                                                                        if (confirm(`To join the board "${board.name}", you must first join the organization "${org.name}".\n\nDo you want to switch to this organization now?`)) {
                                                                            handleSwitchOrg(org.id);
                                                                        }
                                                                    }}
                                                                >
                                                                    Join
                                                                </Button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {foundOrgs && foundOrgs.length === 0 && (
                                <div className="text-center py-8 text-muted-foreground">
                                    No organizations found matching "{searchQuery}".
                                </div>
                            )}
                        </div>
                    </div>
                )
                }

            </div >
        </DraggableModalWrapper >
    );
}
