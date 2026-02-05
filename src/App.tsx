
import { useEffect } from 'react';
import { KanbanBoard } from './components/KanbanBoard';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/axios';
import { RankingConfigPanel } from './components/RankingConfigPanel';
import { useLanguage } from '@/contexts/LanguageContext';
import { AuthScreen } from './components/AuthScreen';
import { Plus, Trash2, LogOut, Archive, UserMinus } from 'lucide-react';

function App() {
  const { board, boards, fetchBoard, fetchBoards, orgName, orgId, authToken, logout, deleteBoard, updateBoard, deleteOrganization } = useStore();
  const { language, setLanguage, t } = useLanguage();

  useEffect(() => {
    if (authToken && orgId) {
      // Ensure boards are loaded (if empty or stale)
      fetchBoards(orgId).catch(console.error);
    }
  }, [authToken, orgId]);

  // Auto-load first board if available and none selected
  useEffect(() => {
    if (boards.length > 0 && !board) {
      fetchBoard(boards[0].id);
    }
  }, [boards, board, fetchBoard]);

  const handleCreateBoard = async () => {
    if (!orgId) return;
    const name = prompt('Enter board name:');
    if (!name) return;

    try {
      const { data } = await api.post('/boards', { name, orgId });
      await fetchBoards(orgId);
      await fetchBoard(data.id);
    } catch {
      alert('Failed to create board');
    }
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

  if (!authToken) {
    return <AuthScreen />;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 flex flex-col">
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700 px-6 py-4 flex justify-between items-center transition-all duration-300">
        <h1 className="text-2xl font-bold">Tasker <span className="font-normal text-sm opacity-70">- {t('subtitle')}</span></h1>

        {/* Header Actions */}
        <div className="flex items-center gap-6">

          {/* Language Toggles */}
          <div className="flex items-center gap-1 border-r border-zinc-200 dark:border-zinc-700 pr-4">
            <button onClick={() => setLanguage('en')} className={`text-xl hover:scale-110 transition-transform ${language === 'en' ? 'opacity-100' : 'opacity-40 grayscale'}`} title="English">🇬🇧</button>
            <button onClick={() => setLanguage('de')} className={`text-xl hover:scale-110 transition-transform ${language === 'de' ? 'opacity-100' : 'opacity-40 grayscale'}`} title="Deutsch">🇩🇪</button>
          </div>

          {/* Org Badge */}
          {orgName && (
            <span className="hidden md:inline-flex text-xs font-bold text-zinc-600 dark:text-zinc-400 px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full border border-zinc-200 dark:border-zinc-700">
              {orgName}
            </span>
          )}

          {/* Board Controls */}
          <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-800/50 p-1.5 rounded-xl border border-zinc-100 dark:border-zinc-800">
            {boards.length > 0 ? (
              <>
                <select
                  value={board?.id || ''}
                  onChange={(e) => fetchBoard(e.target.value)}
                  className="bg-transparent text-sm font-medium px-2 py-1 focus:outline-none min-w-[120px] max-w-[200px]"
                >
                  {boards.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>

                <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700 mx-1" />

                {board && (
                  <>
                    <Button onClick={handleArchiveBoard} size="icon" variant="ghost" className="h-7 w-7" title="Archive Board">
                      <Archive className="w-3.5 h-3.5 text-zinc-400 hover:text-orange-500" />
                    </Button>
                    <Button onClick={handleDeleteBoard} size="icon" variant="ghost" className="h-7 w-7" title="Delete Board">
                      <Trash2 className="w-3.5 h-3.5 text-zinc-400 hover:text-red-500" />
                    </Button>
                    <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700 mx-1" />
                  </>
                )}

                <Button onClick={handleCreateBoard} size="sm" variant="ghost" className="h-7 text-xs px-2 gap-1 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20">
                  <Plus className="w-3.5 h-3.5" /> New
                </Button>
              </>
            ) : (
              <Button onClick={handleCreateBoard} size="sm" className="gap-2">
                <Plus className="w-4 h-4" /> Create First Board
              </Button>
            )}
          </div>

          {/* User & Logout */}
          <div className="flex items-center gap-2 pl-4 border-l border-zinc-200 dark:border-zinc-700">
            <button onClick={handleDeleteAccount} className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all" title="Delete Account">
              <UserMinus className="w-5 h-5" />
            </button>
            <button onClick={logout} className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all" title="Logout">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex">
        {board ? (
          <KanbanBoard />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
            <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mb-2">
              <div className="w-8 h-8 rounded-md border-2 border-dashed border-zinc-300 dark:border-zinc-600" />
            </div>
            <p>Select or create a board to get started.</p>
            {boards.length === 0 && (
              <Button onClick={handleCreateBoard}>Create Board</Button>
            )}
          </div>
        )}
        <div className="w-80 bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-700 p-4 overflow-y-auto hidden xl:block">
          <RankingConfigPanel />
        </div>
      </main>
    </div>
  );
}

export default App;
