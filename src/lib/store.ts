
import { create } from 'zustand';
import { api } from './axios';
import { type RankingWeights, DEFAULT_WEIGHTS } from './rankingEngine';

export interface Task {
    id: string;
    column_id: string;
    title: string;
    description?: string;
    priority_score: number;
    urgency: number;
    due_date?: string;
    people_required?: number;
    skills?: string;
    // New Ranking Factors
    weather_index?: number;      // 0-100
    funding_factor?: number;     // 0-100
    skill_availability?: number; // 0-100
    weather_sensitive?: boolean; // Keep for legacy compatibility if needed
    season?: 'Spring' | 'Summer' | 'Autumn' | 'Winter'; // Manual Season Override
    archived?: boolean;
}

interface Column {
    id: string;
    title: string;
    tasks: Task[];
}

interface Board {
    id: string;
    name: string;
    columns: Column[];
}

export interface User {
    id: string;
    name: string;
    email: string;
    role: string;
}

interface AppState {
    board: Board | null;
    boards: { id: string; name: string }[];
    loading: boolean;
    weatherImpact: number;
    currentSeason: 'Spring' | 'Summer' | 'Autumn' | 'Winter';
    rankingWeights: RankingWeights;

    showArchived: boolean;
    setShowArchived: (show: boolean) => void;

    fetchWeatherImpact: () => Promise<void>;
    orgName: string | null;
    orgId: string | null;
    setOrgName: (name: string) => void;

    fetchBoard: (id: string) => Promise<void>;
    fetchBoards: (orgId: string) => Promise<void>;
    moveTask: (taskId: string, targetColId: string) => Promise<void>;
    deleteTask: (taskId: string) => Promise<void>;
    toggleArchiveTask: (taskId: string, archived: boolean) => Promise<void>;

    deleteBoard: (boardId: string) => Promise<void>;
    updateBoard: (boardId: string, updates: { name?: string, archived?: boolean }) => Promise<void>;
    deleteOrganization: () => Promise<void>;

    setRankingWeights: (weights: RankingWeights) => void;
    //...


    // Auth
    authToken: string | null;
    currentUser: User | null;
    login: (token: string, user: User, orgName: string, orgId: string) => void;
    logout: () => void;
}

export const useStore = create<AppState>((set, get) => ({
    board: null,
    boards: [],
    loading: false,
    weatherImpact: 0,
    currentSeason: 'Spring', // Default
    rankingWeights: DEFAULT_WEIGHTS,

    orgName: null,
    setOrgName: (name) => set({ orgName: name }),

    setRankingWeights: (weights) => set({ rankingWeights: weights }),

    fetchBoard: async (id) => {
        set({ loading: true });
        try {
            const showArchived = get().showArchived;
            const { data } = await api.get(`/boards/${id}?includeArchived=${showArchived}`);
            set({ board: data });
        } catch (e) {
            console.error(e);
        } finally {
            set({ loading: false });
        }
    },
    fetchBoards: async (orgId) => {
        try {
            const { data } = await api.get(`/orgs/${orgId}/boards`);
            set({ boards: data });
        } catch (e) {
            console.error(e);
        }
    },
    fetchWeatherImpact: async () => {
        try {
            const { fetchWeather, getWeatherImpact } = await import('./weather');
            const weather = await fetchWeather();
            const impact = getWeatherImpact(weather);
            set({ weatherImpact: impact, currentSeason: weather.season });
        } catch (e) {
            console.error(e);
        }
    },

    moveTask: async (taskId, targetColId) => {
        // Optimistic update
        const board = get().board;
        if (!board) return;

        // SNAPSHOT for Rollback
        const previousBoard = JSON.parse(JSON.stringify(board));

        const sourceCol = board.columns.find(c => c.tasks.some(t => t.id === taskId));
        if (!sourceCol) return;

        const task = sourceCol.tasks.find(t => t.id === taskId);
        if (!task) return;

        // Remove from source
        const newSourceTasks = sourceCol.tasks.filter(t => t.id !== taskId);

        // Add to target
        const targetCol = board.columns.find(c => c.id === targetColId);
        if (!targetCol) return; // Should not happen

        // Create new columns array
        const newColumns = board.columns.map(col => {
            if (col.id === sourceCol.id) return { ...col, tasks: newSourceTasks };
            if (col.id === targetCol.id) return { ...col, tasks: [...col.tasks, { ...task, column_id: targetColId }] };
            return col;
        });

        set({ board: { ...board, columns: newColumns } });

        try {
            await api.post('/tasks/move', { taskId, targetColumnId: targetColId });
        } catch (e) {
            console.error("Failed to move task, rolling back", e);
            // ROLLBACK
            set({ board: previousBoard });
            alert("Failed to move task. Reverted changes.");
        }
    },
    deleteTask: async (taskId) => {
        const board = get().board;
        if (!board) return;
        const previousBoard = JSON.parse(JSON.stringify(board));

        // Optimistic Remove
        const newColumns = board.columns.map(col => ({
            ...col,
            tasks: col.tasks.filter(t => t.id !== taskId)
        }));
        set({ board: { ...board, columns: newColumns } });

        try {
            await api.delete(`/tasks/${taskId}`);
        } catch (e) {
            console.error("Failed to delete task", e);
            set({ board: previousBoard });
            alert("Failed to delete task.");
        }
    },
    toggleArchiveTask: async (taskId, archived) => {
        const board = get().board;
        if (!board) return;
        const previousBoard = JSON.parse(JSON.stringify(board));

        // Optimistic Update
        const newColumns = board.columns.map(col => ({
            ...col,
            tasks: col.tasks.map(t => t.id === taskId ? { ...t, archived } : t)
        }));

        set({ board: { ...board, columns: newColumns } });

        try {
            await api.put(`/tasks/${taskId}`, { archived });
        } catch (e) {
            console.error("Failed to archive task", e);
            set({ board: previousBoard });
        }
    },

    deleteBoard: async (boardId) => {
        try {
            await api.delete(`/boards/${boardId}`);
            const orgId = get().orgId;
            if (orgId) get().fetchBoards(orgId);

            if (get().board?.id === boardId) {
                set({ board: null });
            }
        } catch (e) {
            console.error('Failed to delete board', e);
        }
    },

    updateBoard: async (boardId, updates) => {
        try {
            await api.put(`/boards/${boardId}`, updates);
            const orgId = get().orgId;
            if (orgId) get().fetchBoards(orgId);

            if (get().board?.id === boardId) {
                const currentBoard = get().board;
                if (currentBoard) {
                    set({ board: { ...currentBoard, ...updates } });
                }
            }
        } catch (e) {
            console.error('Failed to update board', e);
        }
    },

    deleteOrganization: async () => {
        const orgId = get().orgId;
        if (!orgId) return;
        try {
            await api.delete(`/orgs/${orgId}`);
            get().logout();
        } catch (e) {
            console.error('Failed to delete org', e);
        }
    },

    showArchived: false,
    setShowArchived: (show) => {
        set({ showArchived: show });
        // Refetch board to respect new filter
        const board = get().board;
        if (board) get().fetchBoard(board.id);
    },

    // Auth
    authToken: localStorage.getItem('tasker_token') || null,
    currentUser: localStorage.getItem('tasker_user') ? JSON.parse(localStorage.getItem('tasker_user')!) : null,

    orgId: localStorage.getItem('tasker_org_id') || null,

    login: (token, user, orgName, orgId) => {
        localStorage.setItem('tasker_token', token);
        localStorage.setItem('tasker_user', JSON.stringify(user));
        localStorage.setItem('tasker_org_id', orgId);
        set({ authToken: token, currentUser: user, orgName, orgId });
    },

    logout: () => {
        localStorage.removeItem('tasker_token');
        localStorage.removeItem('tasker_user');
        localStorage.removeItem('tasker_org_id');
        set({ authToken: null, currentUser: null, board: null, boards: [], orgName: null, orgId: null });
    }
}));
