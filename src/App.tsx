
import { useState, useEffect } from 'react';
import { KanbanBoard } from './components/KanbanBoard';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/Button';
import { RankingConfigPanel } from './components/RankingConfigPanel';
import { useLanguage } from '@/contexts/LanguageContext';
import { AuthScreen } from './components/AuthScreen';
import { DiscoveryModal } from './components/DiscoveryModal';
import { CreateBoardModal } from './components/CreateBoardModal';
import { Plus, Trash2, LogOut, Archive, UserMinus, Globe, Search, User as UserIcon, ChartColumnIncreasing, CalendarDays, LayoutGrid, ShieldCheck, House } from 'lucide-react';
import { ProfilePage } from './components/ProfilePage';
import { NotificationPopover } from './components/NotificationPopover';
import { SuperAdminRegister } from './components/SuperAdminRegister';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { ForgotPassword } from './components/ForgotPassword';
import { ResetPassword } from './components/ResetPassword';
import { ReportingSystemPage } from './components/ReportingSystemPage';
import { WeeklyTasksPage } from './components/WeeklyTasksPage';
import { BoardsOverviewPage } from './components/BoardsOverviewPage';
import { OrgSuperAdminAccessPage } from './components/OrgSuperAdminAccessPage';
import { Navigate, Route, Routes } from 'react-router-dom';

const getCurrentWeekStart = () => {
  const now = new Date();
  const utcDay = now.getUTCDay();
  const diffToMonday = (utcDay + 6) % 7;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - diffToMonday);
  return monday.toISOString().slice(0, 10);
};

const getWeekOfMonth = (date: Date) => {
  const dayOfMonth = date.getUTCDate();
  const week = Math.ceil(dayOfMonth / 7);
  return Math.min(4, Math.max(1, week));
};

const getMonthWeekLabel = (date: Date) => {
  const month = date.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
  const week = getWeekOfMonth(date);
  return `${month} Week ${week}`;
};

const getWeekKey = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const week = getWeekOfMonth(date);
  return `${year}-${month}-W${week}`;
};

const parseBoardDate = (createdAt?: string) => {
  if (!createdAt) return new Date();
  const parsed = new Date(createdAt);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const getRecentWeekOptions = (count = 16) => {
  const options: { key: string; label: string }[] = [];
  const seen = new Set<string>();
  const cursor = new Date();
  for (let i = 0; i < count; i += 1) {
    const key = getWeekKey(cursor);
    if (!seen.has(key)) {
      options.push({ key, label: getMonthWeekLabel(cursor) });
      seen.add(key);
    }
    cursor.setUTCDate(cursor.getUTCDate() - 7);
  }
  return options;
};

const hasFollower = (followers: string | undefined, userId: string | undefined) => {
  if (!followers || !userId) return false;
  return followers.split(',').map((id) => id.trim()).filter(Boolean).includes(userId);
};

const canManageBoard = (role?: string) => role === 'admin' || role === 'org_super_admin' || role === 'super_admin';

function DashboardShell() {
  const { board, boards, fetchBoard, fetchBoards, orgName, orgId, logout, deleteBoard, updateBoard, deleteOrganization, toggleBoardFollow, currentUser, fetchUserProfile, userProfile, fetchNotifications, fetchMyInvites } = useStore();
  const { language, setLanguage, t } = useLanguage();
  const [isDiscoveryOpen, setIsDiscoveryOpen] = useState(false);
  const [isCreateBoardOpen, setIsCreateBoardOpen] = useState(false);
  const [discoveryTab, setDiscoveryTab] = useState<'boards' | 'orgs'>('boards');
  const [view, setView] = useState<'board' | 'profile' | 'reporting' | 'weekly' | 'boards-overview' | 'org-admin-access'>('board');
  const [sortByUrgency, setSortByUrgency] = useState(true);
  const [weekStart, setWeekStart] = useState(getCurrentWeekStart());
  const [selectedBoardWeekKey, setSelectedBoardWeekKey] = useState(getWeekKey(new Date()));
  const canAccessOrgAdminWorkflow = currentUser?.role === 'admin' || currentUser?.role === 'org_super_admin' || currentUser?.role === 'super_admin';
  const recentWeekOptions = getRecentWeekOptions();

  // Filter boards for the dropdown (Joined/Followed only)
  // If user created it, they are auto-followed now.
  const myBoards = boards.filter((b) => hasFollower(b.followers, currentUser?.id));
  const weekScopedBoards = myBoards.filter((b) => getWeekKey(parseBoardDate(b.created_at)) === selectedBoardWeekKey);
  const selectableBoards = weekScopedBoards.length > 0 ? weekScopedBoards : myBoards;
  const boardIndex = board ? selectableBoards.findIndex((b) => b.id === board.id) + 1 : 0;

  useEffect(() => {
    if (orgId) {
      fetchBoards(orgId).catch(console.error);
    }
  }, [orgId, fetchBoards]);

  useEffect(() => {
    fetchUserProfile().catch(console.error);
  }, [fetchUserProfile]);

  useEffect(() => {
    fetchNotifications();
    fetchMyInvites();
  }, [fetchNotifications, fetchMyInvites]);

  // Auto-load last viewed board or first available
  useEffect(() => {
    if (board) return;

    if (selectableBoards.length > 0) {
      const lastBoardId = localStorage.getItem('tasker_last_board_id');
      console.log('Auto-load logic running:', {
        lastBoardId,
        myBoardsCount: selectableBoards.length,
        myBoardsIds: selectableBoards.map(b => b.id),
        currentUserId: currentUser?.id
      });

      const targetBoard = selectableBoards.find(b => b.id === lastBoardId) || selectableBoards[0];
      if (targetBoard) {
        console.log('Fetching target board:', targetBoard.name);
        fetchBoard(targetBoard.id);
      }
    }
  }, [boards, board, fetchBoard, currentUser, selectedBoardWeekKey]);

  useEffect(() => {
    if (!board || selectableBoards.length === 0) return;
    const existsInCurrentWeek = selectableBoards.some((entry) => entry.id === board.id);
    if (!existsInCurrentWeek) {
      fetchBoard(selectableBoards[0].id);
    }
  }, [selectedBoardWeekKey, selectableBoards, board, fetchBoard]);

  const handleCreateBoard = () => {
    if (!orgId) return;
    setIsCreateBoardOpen(true);
  };

  const handleDeleteBoard = async () => {
    if (!board) return;
    if (confirm(`Are you sure you want to permanently delete the board "${board.name}"? All tasks will be lost.`)) {
      await deleteBoard(board.id);
    }
  };

  const handleArchiveBoard = async () => {
    if (!board) return;
    if (confirm(`Archive board "${board.name}"? It will be hidden from this list.`)) {
      await updateBoard(board.id, { archived: true });
    }
  };

  /* User & Logout */
  const handleDeleteAccount = async () => {
    if (confirm("WARNING: Are you sure you want to delete your account and organization? ALL BOARDS AND TASKS WILL BE PERMANENTLY DELETED. This cannot be undone.")) {
      if (confirm("Please confirm again: DELETE EVERYTHING?")) {
        await deleteOrganization();
      }
    }
  };

  const currentOrgName = userProfile?.organization?.name || orgName || 'your organization';
  const firstName = currentUser?.name?.split(' ')[0] || 'there';

  return (
    <div className="min-h-screen text-zinc-900 dark:text-zinc-50 flex flex-col relative">
      <header className="glass border-b border-zinc-200/70 dark:border-zinc-700/70 px-4 md:px-6 py-3 md:py-4 flex items-center gap-4 md:gap-8 transition-all duration-300 sticky top-0 z-20">
        <div className="flex flex-col">
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">{t('app_title')}</h1>

          <div className="mt-1">
            <p className="text-lg font-bold text-muted-foreground">
              {t('header_welcome')} <span className="font-bold text-blue-600 dark:text-blue-400">{firstName}</span>, {t('header_tasks_from')} <span className="text-foreground font-bold">{currentOrgName}</span>
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 md:gap-5 flex-1 min-w-0">

          {/* Language Toggles */}
          <div className="flex items-center gap-1 border-r border-zinc-200 dark:border-zinc-700 pr-4">
            <button onClick={() => setLanguage('en')} className={`hover:scale-110 transition-transform ${language === 'en' ? 'opacity-100' : 'opacity-40 grayscale'}`} title="English">
              <svg width="24" height="18" viewBox="0 0 24 18" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-6 h-4.5">
                <path d="M0 0H24V18H0V0Z" fill="#012169"/>
                <path d="M0 0L24 18M24 0L0 18" stroke="white" strokeWidth="2"/>
                <path d="M0 0L24 18M24 0L0 18" stroke="#C8102E" strokeWidth="1"/>
                <path d="M12 0V18M0 9H24" stroke="white" strokeWidth="3"/>
                <path d="M12 0V18M0 9H24" stroke="#C8102E" strokeWidth="2"/>
              </svg>
            </button>
            <button onClick={() => setLanguage('de')} className={`hover:scale-110 transition-transform ${language === 'de' ? 'opacity-100' : 'opacity-40 grayscale'}`} title="Deutsch">
              <svg width="24" height="18" viewBox="0 0 24 18" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-6 h-4.5">
                <path d="M0 0H24V6H0V0Z" fill="#000"/>
                <path d="M0 6H24V12H0V6Z" fill="#DD0000"/>
                <path d="M0 12H24V18H0V12Z" fill="#FFCC00"/>
              </svg>
            </button>
          </div>

          {/* Org Badge */}
          {currentOrgName && (
            <div className="hidden md:flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full border border-zinc-200 dark:border-zinc-700">
                {currentOrgName}
              </span>
              <Button
                onClick={() => { setDiscoveryTab('orgs'); setIsDiscoveryOpen(true); }}
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 rounded-full"
                title="Switch Organization"
              >
                <Globe className="w-3.5 h-3.5 text-zinc-400 hover:text-indigo-500" />
              </Button>
            </div>
          )}

          {/* Board Controls */}
          <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-800/50 p-1.5 rounded-xl border border-zinc-100 dark:border-zinc-800">
            {myBoards.length > 0 ? (
              <>
                <div className="flex items-center gap-3 px-2 border-r border-zinc-200 dark:border-zinc-700 mr-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase text-zinc-500 tracking-wider">Board</span>
                    <span className="text-xs font-bold bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-1.5 py-0.5 rounded-md min-w-[20px] text-center">
                      {boardIndex > 0 ? boardIndex : 1}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <select
                      value={selectedBoardWeekKey}
                      onChange={(e) => setSelectedBoardWeekKey(e.target.value)}
                      className="bg-white dark:bg-zinc-800 text-xs font-semibold px-2 py-1 border border-zinc-200 dark:border-zinc-700 rounded-md focus:outline-none"
                      title="Select month and week"
                    >
                      {recentWeekOptions.map((option) => (
                        <option key={option.key} value={option.key}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <select
                  value={board?.id || ''}
                  onChange={(e) => fetchBoard(e.target.value)}
                  className="bg-transparent text-sm font-medium px-2 py-1 focus:outline-none min-w-[120px] max-w-[200px]"
                >
                  {selectableBoards.map((b) => (
                    <option key={b.id} value={b.id}>{b.name?.trim() || getMonthWeekLabel(parseBoardDate(b.created_at))}</option>
                  ))}
                </select>

                <Button
                  onClick={() => { setDiscoveryTab('boards'); setIsDiscoveryOpen(true); }}
                  size="sm" variant="ghost" className="h-7 w-7 p-0" title={t('dash_browse_title')}
                >
                  <Search className="w-3.5 h-3.5 text-zinc-400 hover:text-indigo-500" />
                </Button>

                <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700 mx-1" />

                {board && (
                  <>
                    <Button
                      onClick={() => toggleBoardFollow(board.id)}
                      size="sm"
                      variant="ghost"
                      className={`h-7 px-2 gap-1 transition-colors ${hasFollower(board.followers, currentUser?.id)
                        ? 'text-pink-600 bg-pink-50 hover:bg-pink-100 dark:bg-pink-900/20 dark:text-pink-300'
                        : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400'
                        }`}
                      title={hasFollower(board.followers, currentUser?.id) ? t('dash_unfollow') : t('dash_follow')}
                    >
                      <span className={hasFollower(board.followers, currentUser?.id) ? "scale-110" : "grayscale opacity-50"}>❤️</span>
                      <span className="text-xs">{board.followers ? board.followers.split(',').filter(Boolean).length : 0}</span>
                    </Button>

                    <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700 mx-1" />

                    {canManageBoard(currentUser?.role) && (
                      <>
                        <Button onClick={handleArchiveBoard} size="icon" variant="ghost" className="h-7 w-7" title={t('dash_archive')}>
                          <Archive className="w-3.5 h-3.5 text-zinc-400 hover:text-orange-500" />
                        </Button>
                        <Button onClick={handleDeleteBoard} size="icon" variant="ghost" className="h-7 w-7" title={t('dash_delete')}>
                          <Trash2 className="w-3.5 h-3.5 text-zinc-400 hover:text-red-500" />
                        </Button>
                        <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700 mx-1" />
                      </>
                    )}
                  </>
                )}

                {canManageBoard(currentUser?.role) && (
                  <Button onClick={handleCreateBoard} size="sm" variant="ghost" className="h-7 text-xs px-2 gap-1 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20">
                    <Plus className="w-3.5 h-3.5" /> {t('dash_new_btn')}
                  </Button>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2">
                {canManageBoard(currentUser?.role) && (
                  <Button onClick={handleCreateBoard} size="sm" className="gap-2">
                    <Plus className="w-4 h-4" /> {t('dash_create_first')}
                  </Button>
                )}
                <Button
                  onClick={() => { setDiscoveryTab('boards'); setIsDiscoveryOpen(true); }}
                  size="sm" variant="ghost" className="gap-2 text-indigo-600"
                >
                  <Search className="w-4 h-4" /> {t('dash_browse_btn')}
                </Button>
              </div>
            )}
          </div>

          {/* Notifications */}
          <NotificationPopover />

          {/* User & Logout */}
          <div className="flex items-center gap-2 pl-4 border-l border-zinc-200 dark:border-zinc-700">
            <button onClick={() => setView('board')} className={`p-2 rounded-full transition-all ${view === 'board' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'}`} title="Board Home">
              <House className="w-5 h-5" />
            </button>
            <button onClick={() => setView('reporting')} className={`p-2 rounded-full transition-all ${view === 'reporting' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'}`} title="Reporting System">
              <ChartColumnIncreasing className="w-5 h-5" />
            </button>
            <button onClick={() => setView('weekly')} className={`p-2 rounded-full transition-all ${view === 'weekly' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'}`} title="Weekly Tasks">
              <CalendarDays className="w-5 h-5" />
            </button>
            <button onClick={() => setView('boards-overview')} className={`p-2 rounded-full transition-all ${view === 'boards-overview' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'}`} title="Boards Overview">
              <LayoutGrid className="w-5 h-5" />
            </button>
            {canAccessOrgAdminWorkflow && (
              <button onClick={() => setView('org-admin-access')} className={`p-2 rounded-full transition-all ${view === 'org-admin-access' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'}`} title="Org Super Admin Access">
                <ShieldCheck className="w-5 h-5" />
              </button>
            )}
            <button onClick={() => setView('profile')} className={`p-2 rounded-full transition-all ${view === 'profile' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'}`} title="My Profile">
              <UserIcon className="w-5 h-5" />
            </button>
            <button onClick={handleDeleteAccount} className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all" title="Delete Account">
              <UserMinus className="w-5 h-5" />
            </button>
            <button onClick={logout} className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all" title="Logout">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex min-w-0 flex-1 overflow-hidden">
        {view === 'profile' ? (
          <ProfilePage onBack={() => setView('board')} />
        ) : view === 'reporting' ? (
          <ReportingSystemPage
            weekStart={weekStart}
            onWeekChange={setWeekStart}
            onOpenWeeklyTasks={() => setView('weekly')}
            onOpenBoardsOverview={() => setView('boards-overview')}
          />
        ) : view === 'weekly' ? (
          <WeeklyTasksPage weekStart={weekStart} onWeekChange={setWeekStart} />
        ) : view === 'boards-overview' ? (
          <BoardsOverviewPage weekStart={weekStart} />
        ) : view === 'org-admin-access' ? (
          <OrgSuperAdminAccessPage weekStart={weekStart} />
        ) : board ? (
          <div className="flex-1 min-w-0 px-2 pb-3 md:px-3 xl:pr-0">
            <KanbanBoard sortByUrgency={sortByUrgency} setSortByUrgency={setSortByUrgency} />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
            <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mb-2">
              <div className="w-8 h-8 rounded-md border-2 border-dashed border-zinc-300 dark:border-zinc-600" />
            </div>
            <p>{t('dash_empty_msg')}</p>
            {myBoards.length === 0 && (
              <div className="flex gap-2">
                {canManageBoard(currentUser?.role) && <Button onClick={handleCreateBoard}>{t('dash_create_btn')}</Button>}
                <Button onClick={() => { setDiscoveryTab('boards'); setIsDiscoveryOpen(true); }} variant="outline">{t('dash_browse_all')}</Button>
              </div>
            )}
          </div>
        )}
        {view === 'board' && (
          <div className="hidden w-72 shrink-0 overflow-y-auto border-l border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900 xl:block">
            <RankingConfigPanel />
          </div>
        )}
      </main>

      <DiscoveryModal
        isOpen={isDiscoveryOpen}
        onClose={() => setIsDiscoveryOpen(false)}
        initialTab={discoveryTab}
      />
      <CreateBoardModal
        isOpen={isCreateBoardOpen}
        onClose={() => setIsCreateBoardOpen(false)}
      />
    </div>
  );
}

function App() {
  const { authToken, currentUser } = useStore();

  return (
    <Routes>
      <Route path="/super-admin" element={<SuperAdminRegister />} />
      <Route path="/forgot-password" element={authToken ? <Navigate to="/" replace /> : <ForgotPassword />} />
      <Route path="/reset-password" element={authToken ? <Navigate to="/" replace /> : <ResetPassword />} />
      <Route
        path="/*"
        element={
          !authToken ? (
            <AuthScreen />
          ) : currentUser?.role === 'super_admin' ? (
            <SuperAdminDashboard />
          ) : (
            <DashboardShell />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
