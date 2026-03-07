
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
    weather_code?: number;
    project_location?: string;
    project_duration?: string;
    interested_users?: string; // Comma-separated IDs
    admin_override_urgency?: number | null;
    admin_override_priority?: number;
}

interface Column {
    id: string;
    title: string;
    tasks: Task[];
}

interface Board {
    id: string;
    name: string;
    created_at?: string;
    columns: Column[];
    created_by?: string;
    creator_name?: string;
    followers?: string; // Comma-separated IDs
    is_public?: boolean;
}

export interface Notification {
    id: string;
    message: string;
    is_read: number; // 0 or 1
    type: string;
    created_at: string;
}

export interface User {
    id: string;
    name: string;
    username?: string;
    email: string;
    role: 'admin' | 'org_super_admin' | 'member' | 'super_admin';
    lastBoardId?: string;
    phone_number?: string;
    skills?: string;
    location?: string;
}
export interface RecurringDuty {
    id?: string;
    title: string;
    cadence: 'daily' | 'weekly';
    dayOfWeek: number | null;
    startTime: string;
    endTime: string;
    location?: string | null;
    notes?: string | null;
}

export interface SystemStats {
    users: number;
    orgs: number;
    boards: number;
    tasks: number;
}

export interface Organization {
    id: string;
    name: string;
    created_at: string;
    user_count: number;
}

export interface RegisterSuperAdminPayload {
    secret: string;
    name: string;
    email: string;
    password: string;
}

export interface UserProfileData {
    user: User;
    organization: { id: string; name: string };
    interestedTasks: { id: string; title: string; priority_score: number; board_name: string; board_id: string }[];
    recurringDuties: RecurringDuty[];
}

export interface TaskInviteEntry {
    id: string;
    taskId: string;
    taskTitle: string;
    boardName: string;
    inviterName: string;
    message: string | null;
    status: string;
    createdAt: string;
}

export interface ReportingProjectSummary {
    id: string;
    name: string;
    creator_name: string;
    visibility: 'public' | 'private';
    archived: boolean;
    total_tasks: number;
    todo_tasks: number;
    in_progress_tasks: number;
    done_tasks: number;
    completion_rate: number;
    average_priority: number;
    participants: string[];
    locations: string[];
    rank?: number;
    priority_explanation?: string;
    completed_on?: string;
}

export interface ReportingWeeklyTask {
    id: string;
    board_id: string;
    board_name: string;
    title: string;
    status: 'not_started' | 'in_progress' | 'completed';
    due_date: string | null;
    completed_at: string | null;
    location: string | null;
    participants: string[];
    priority_score: number;
}

export interface PublicBoardOverview {
    id: string;
    name: string;
    created_at: string;
    org_id: string;
    org_name: string;
    creator_name: string;
}

export interface ReportingOverview {
    orgId: string;
    week_start: string;
    week_end: string;
    active_projects: ReportingProjectSummary[];
    not_started_projects: ReportingProjectSummary[];
    completed_projects_week: ReportingProjectSummary[];
    weekly_tasks: ReportingWeeklyTask[];
    board_overview: ReportingProjectSummary[];
    public_boards: PublicBoardOverview[];
}

export interface OrgMemberOverview {
    id: string;
    name: string;
    email: string;
    role: User['role'];
    phone_number?: string;
    skills?: string;
    location?: string;
    last_board_id?: string | null;
    followed_boards: { id: string; name: string }[];
    assigned_tasks_week: {
        id: string;
        title: string;
        board_name: string;
        status: 'not_started' | 'in_progress' | 'completed';
        location: string | null;
        due_date: string | null;
        completed_at: string | null;
    }[];
    interested_tasks_week: {
        id: string;
        title: string;
        board_name: string;
        status: 'not_started' | 'in_progress' | 'completed';
        location: string | null;
        due_date: string | null;
        completed_at: string | null;
    }[];
    active_tasks_week: {
        id: string;
        title: string;
        board_name: string;
        status: 'not_started' | 'in_progress' | 'completed';
        location: string | null;
        due_date: string | null;
        completed_at: string | null;
    }[];
    current_tasks_now: {
        id: string;
        title: string;
        board_name: string;
        status: 'not_started' | 'in_progress' | 'completed';
        location: string | null;
        due_date: string | null;
        completed_at: string | null;
    }[];
    recurring_duties: RecurringDuty[];
    recurring_duties_active_now: RecurringDuty[];
}

export interface WeeklyObjectiveResponse {
    objective: string;
    updated_at: string | null;
    updated_by: string | null;
    updated_by_name: string | null;
}

export interface WeeklyObjectiveHistoryEntry {
    id: string;
    previous_objective_text: string | null;
    objective_text: string;
    changed_at: string;
    changed_by: string | null;
    changed_by_name: string | null;
}

interface AppState {
    board: Board | null;
    boards: { id: string; name: string; created_at?: string; followers?: string; created_by?: string; creator_name?: string; archived?: number; is_public?: number }[];
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
    createBoard: (name: string, orgId: string, isPublic: boolean) => Promise<void>;
    moveTask: (taskId: string, targetColId: string) => Promise<void>;
    deleteTask: (taskId: string) => Promise<void>;
    toggleArchiveTask: (taskId: string, archived: boolean) => Promise<void>;

    deleteBoard: (boardId: string) => Promise<void>;
    updateBoard: (boardId: string, updates: { name?: string, archived?: boolean }) => Promise<void>;
    deleteOrganization: () => Promise<void>;

    setRankingWeights: (weights: RankingWeights) => void;

    // New Actions
    toggleBoardFollow: (boardId: string) => Promise<void>;
    toggleTaskInterest: (taskId: string) => Promise<void>;
    switchOrganization: (orgId: string) => Promise<void>;
    updateUser: (updates: Partial<User> & { password?: string; recurringDuties?: RecurringDuty[] }) => Promise<void>;
    fetchUserProfile: () => Promise<void>;
    userProfile: UserProfileData | null;
    systemStats: SystemStats | null;
    allOrgs: Organization[];
    allUsers: (User & { org_name?: string })[];

    // Actions
    fetchSystemStats: () => Promise<void>;
    fetchAllOrgs: () => Promise<void>;
    fetchAllUsers: () => Promise<void>;
    registerSuperAdmin: (data: { secret: string; email: string; password: string; name: string }) => Promise<void>;
    deElevateSuperAdmin: (password: string, targetRole?: 'org_super_admin' | 'admin' | 'member') => Promise<void>;
    reportingOverview: ReportingOverview | null;
    fetchReportingOverview: (orgId: string, weekStart?: string) => Promise<void>;
    orgMembersOverview: OrgMemberOverview[];
    fetchOrgMembersOverview: (orgId: string, weekStart?: string) => Promise<void>;
    requestOrgSuperAdminPromotion: (orgId: string, targetUserId: string, currentPassword: string) => Promise<{ requestId: string; expiresAt: string }>;
    confirmOrgSuperAdminPromotion: (orgId: string, requestId: string, approvalCode: string) => Promise<void>;
    fetchWeeklyObjective: (orgId: string, month: string, week: number) => Promise<WeeklyObjectiveResponse>;
    saveWeeklyObjective: (orgId: string, month: string, week: number, objective: string) => Promise<void>;
    fetchWeeklyObjectiveHistory: (orgId: string, month: string, week: number) => Promise<WeeklyObjectiveHistoryEntry[]>;

    // Super Admin Actions
    deleteOrganizationAdmin: (id: string) => Promise<void>;
    updateOrganizationAdmin: (id: string, name: string) => Promise<void>;
    getOrgBoardsAdmin: (id: string) => Promise<{ id: string; name: string }[]>;
    updateUserAdmin: (id: string, data: { name: string; email: string }) => Promise<void>;
    deleteUserAdmin: (id: string) => Promise<void>;
    resetPasswordAdmin: (id: string, password: string) => Promise<void>;

    // Auth


    // Auth
    authToken: string | null;
    currentUser: User | null;
    login: (token: string, user: User, orgName: string, orgId: string) => void;
    logout: () => void;
    notifications: Notification[];
    fetchNotifications: () => Promise<void>;
    markNotificationRead: (id: string) => Promise<void>;

    // Task invites
    taskInvites: TaskInviteEntry[];
    fetchMyInvites: () => Promise<void>;
    fetchInviteCandidates: (orgId: string, q?: string, taskId?: string) => Promise<{ id: string; name: string; email: string; skills: string | null }[]>;
    fetchTasksForInvite: (orgId: string) => Promise<{ id: string; title: string; boardId: string; boardName: string }[]>;
    sendTaskInvite: (taskId: string, inviteeUserId: string, message?: string) => Promise<void>;
    acceptInvite: (inviteId: string) => Promise<void>;
    declineInvite: (inviteId: string) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
    board: null,
    boards: [],
    loading: false,
    notifications: [],
    taskInvites: [],
    weatherImpact: 0,
    userProfile: null,
    systemStats: null,
    allOrgs: [],
    allUsers: [],
    reportingOverview: null,
    orgMembersOverview: [],
    currentSeason: 'Spring', // Default
    rankingWeights: DEFAULT_WEIGHTS,

    orgName: localStorage.getItem('tasker_org_name') || null,
    setOrgName: (name) => {
        localStorage.setItem('tasker_org_name', name);
        set({ orgName: name });
    },

    setRankingWeights: (weights) => set({ rankingWeights: weights }),

    fetchBoard: async (id) => {
        set({ loading: true });
        try {
            const showArchived = get().showArchived;
            const { data } = await api.get(`/boards/${id}?includeArchived=${showArchived}`);
            set({ board: data });
            localStorage.setItem('tasker_last_board_id', id);

            // Sync to backend if logged in
            if (get().authToken) {
                console.log('Syncing last_board_id to backend:', id);
                api.put('/users/me/board', { boardId: id }).catch(e => console.error('Failed to sync last board:', e));
            }
        } catch (e) {
            console.error(e);
        } finally {
            set({ loading: false });
        }
    },
    createBoard: async (name, orgId, isPublic) => {
        try {
            const { data } = await api.post('/boards', { name, orgId, isPublic });
            const newBoard = {
                ...data,
                creator_name: get().currentUser?.name,
                created_at: data.created_at || new Date().toISOString(),
                is_public: isPublic ? 1 : 0
            };
            set((state) => ({
                boards: [...state.boards, newBoard]
            }));
            // Auto-select the new board
            get().fetchBoard(data.id);
        } catch (e) {
            console.error(e);
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
    fetchReportingOverview: async (orgId, weekStart) => {
        try {
            const query = weekStart ? `?weekStart=${encodeURIComponent(weekStart)}` : '';
            const { data } = await api.get(`/reports/overview/${orgId}${query}`);
            set({ reportingOverview: data });
        } catch (e) {
            console.error('Failed to fetch reporting overview', e);
        }
    },
    fetchOrgMembersOverview: async (orgId, weekStart) => {
        try {
            const query = weekStart ? `?weekStart=${encodeURIComponent(weekStart)}` : '';
            const { data } = await api.get(`/orgs/${orgId}/members/overview${query}`);
            set({ orgMembersOverview: Array.isArray(data?.members) ? data.members : [] });
        } catch (e) {
            console.error('Failed to fetch org members overview', e);
        }
    },
    requestOrgSuperAdminPromotion: async (orgId, targetUserId, currentPassword) => {
        const { data } = await api.post(`/orgs/${orgId}/super-admin/promote/request`, { targetUserId, currentPassword });
        return { requestId: data.requestId, expiresAt: data.expiresAt };
    },
    confirmOrgSuperAdminPromotion: async (orgId, requestId, approvalCode) => {
        await api.post(`/orgs/${orgId}/super-admin/promote/confirm`, { requestId, approvalCode });
    },
    fetchWeeklyObjective: async (orgId, month, week) => {
        const { data } = await api.get(`/orgs/${orgId}/weekly-objective?month=${encodeURIComponent(month)}&week=${week}`);
        return {
            objective: data?.objective || '',
            updated_at: data?.updated_at || null,
            updated_by: data?.updated_by || null,
            updated_by_name: data?.updated_by_name || null
        };
    },
    saveWeeklyObjective: async (orgId, month, week, objective) => {
        await api.put(`/orgs/${orgId}/weekly-objective`, { month, week, objective });
    },
    fetchWeeklyObjectiveHistory: async (orgId, month, week) => {
        const { data } = await api.get(`/orgs/${orgId}/weekly-objective/history?month=${encodeURIComponent(month)}&week=${week}`);
        return Array.isArray(data?.history) ? data.history : [];
    },
    fetchWeatherImpact: async () => {
        try {
            // const { fetchWeather, getWeatherImpact } = await import('./weatherService');
            // const weather = await fetchWeather();
            // const impact = 0;
            // set({ weatherImpact: impact, currentSeason: weather.season });
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

    toggleBoardFollow: async (boardId) => {
        try {
            const { data } = await api.post(`/boards/${boardId}/follow`);

            // Update boards list
            set((state) => ({
                boards: state.boards.map(b =>
                    b.id === boardId ? { ...b, followers: data.followers } : b
                )
            }));

            // Update current board if it matches
            const currentBoard = get().board;
            if (currentBoard && currentBoard.id === boardId) {
                set({ board: { ...currentBoard, followers: data.followers } });
            }
        } catch (e) {
            console.error("Failed to toggle follow", e);
        }
    },

    switchOrganization: async (newOrgId: string) => {
        try {
            const { data } = await api.put('/users/me/org', { orgId: newOrgId });
            set((state) => ({
                orgId: data.orgId,
                orgName: data.orgName,
                authToken: state.authToken,
                currentUser: state.currentUser ? { ...state.currentUser, role: data.role } : null,
                board: null,
                boards: []
            }));
            localStorage.setItem('tasker_org_id', data.orgId);
            localStorage.setItem('tasker_org_name', data.orgName);
        } catch (err) {
            console.error('Failed to switch org', err);
            throw err;
        }
    },

    toggleTaskInterest: async (taskId) => {
        const board = get().board;
        if (!board) return;
        // Optimistic
        try {
            const { data } = await api.post(`/tasks/${taskId}/interest`);
            // Update deeply nested task
            const newColumns = board.columns.map(col => ({
                ...col,
                tasks: col.tasks.map(t => t.id === taskId ? { ...t, interested_users: data.interested_users } : t)
            }));
            set({ board: { ...board, columns: newColumns } });
        } catch (e) {
            console.error("Failed to toggle interest", e);
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
        localStorage.setItem('tasker_org_name', orgName);
        if (user.lastBoardId) {
            localStorage.setItem('tasker_last_board_id', user.lastBoardId);
        } else {
            // New session with no last board from server -> keep local or clear?
            // If we want sync to source of truth (server), we should probably respect it.
            // But if server is NULL (new user), local might have something?
            // Let's rely on server. If server says nothing, we stick with what we have (maybe user was just here).
            // Actually, if user switches devices, we want server state.
            // If user logs in new, we might want to clear old user's state if we didn't full logout?
            // Logout clears it. So we are good.
        }
        console.log('Login State Update:', { user, orgId, lastBoardId: user.lastBoardId });
        set({ authToken: token, currentUser: user, orgName, orgId });
        get().fetchNotifications();
        get().fetchMyInvites();
    },

    logout: () => {
        localStorage.removeItem('tasker_token');
        localStorage.removeItem('tasker_user');
        localStorage.removeItem('tasker_org_id');
        localStorage.removeItem('tasker_org_name');
        set({ authToken: null, currentUser: null, board: null, boards: [], orgName: null, orgId: null, notifications: [], taskInvites: [] });
    },

    fetchNotifications: async () => {
        const { authToken } = get();
        if (!authToken) return;
        try {
            const res = await api.get('/notifications');
            set({ notifications: res.data });
        } catch (error: any) {
            if (error?.response?.status === 401) {
                get().logout();
                return;
            }
            console.error('Failed to fetch notifications', error);
        }
    },

    markNotificationRead: async (id: string) => {
        const { authToken, notifications } = get();
        if (!authToken) return;
        try {
            await api.put(`/notifications/${id}/read`, {});
            // Optimistic update
            if (id === 'all') {
                set({ notifications: notifications.map(n => ({ ...n, is_read: 1 })) });
            } else {
                set({
                    notifications: notifications.map(n =>
                        n.id === id ? { ...n, is_read: 1 } : n
                    )
                });
            }
        } catch (error: unknown) {
            const err = error as { response?: { status?: number } };
            if (err?.response?.status === 401) {
                get().logout();
                return;
            }
            console.error('Failed to mark read', error);
        }
    },

    fetchMyInvites: async () => {
        const { authToken } = get();
        if (!authToken) return;
        try {
            const { data } = await api.get<TaskInviteEntry[]>('/invites');
            set({ taskInvites: Array.isArray(data) ? data : [] });
        } catch (e) {
            console.error('Failed to fetch invites', e);
        }
    },
    fetchInviteCandidates: async (orgId, q, taskId) => {
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (taskId) params.set('taskId', taskId);
        const { data } = await api.get<{ id: string; name: string; email: string; skills: string | null }[]>(
            `/orgs/${orgId}/invite-candidates?${params.toString()}`
        );
        return Array.isArray(data) ? data : [];
    },
    fetchTasksForInvite: async (orgId) => {
        const { data } = await api.get<{ id: string; title: string; boardId: string; boardName: string }[]>(
            `/orgs/${orgId}/tasks-for-invite`
        );
        return Array.isArray(data) ? data : [];
    },
    sendTaskInvite: async (taskId, inviteeUserId, message) => {
        await api.post(`/tasks/${taskId}/invites`, { inviteeUserId, message });
    },
    acceptInvite: async (inviteId) => {
        await api.post(`/invites/${inviteId}/accept`, {});
        const { data } = await api.get<TaskInviteEntry[]>('/invites');
        set({ taskInvites: Array.isArray(data) ? data : [] });
        const board = get().board;
        if (board) get().fetchBoard(board.id);
        get().fetchUserProfile();
    },
    declineInvite: async (inviteId) => {
        await api.post(`/invites/${inviteId}/decline`, {});
        const { data } = await api.get<TaskInviteEntry[]>('/invites');
        set({ taskInvites: Array.isArray(data) ? data : [] });
    },

    updateUser: async (updates) => {
        try {
            const { data } = await api.put('/users/me', updates);
            if (data.success && data.user) {
                const currentUser = get().currentUser;
                const newUser = { ...currentUser, ...data.user };
                localStorage.setItem('tasker_user', JSON.stringify(newUser));
                set((state) => ({
                    currentUser: newUser,
                    userProfile: state.userProfile
                        ? {
                            ...state.userProfile,
                            user: { ...state.userProfile.user, ...data.user },
                            recurringDuties: Array.isArray(data.recurringDuties) ? data.recurringDuties : (state.userProfile.recurringDuties || [])
                        }
                        : state.userProfile
                }));
            }
        } catch (e) {
            console.error('Failed to update user', e);
            throw e;
        }
    },

    fetchUserProfile: async () => {
        try {
            const { data } = await api.get('/users/me/profile');
            const profileOrgName = data?.organization?.name;
            if (typeof profileOrgName === 'string' && profileOrgName.trim().length > 0) {
                localStorage.setItem('tasker_org_name', profileOrgName);
                set({ userProfile: data, orgName: profileOrgName });
                return;
            }
            set({ userProfile: data });
        } catch (e: unknown) {
            const err = e as { response?: { status?: number } };
            if (err?.response?.status === 401) {
                get().logout();
                return;
            }
            console.error('Failed to fetch user profile', e);
        }
    },

    fetchSystemStats: async () => {
        try {
            const { data } = await api.get('/admin/stats');
            set({ systemStats: data });
        } catch (e) {
            console.error('Failed to fetch system stats', e);
        }
    },

    fetchAllOrgs: async () => {
        try {
            const { data } = await api.get('/admin/orgs');
            set({ allOrgs: data });
        } catch (e) {
            console.error('Failed to fetch all orgs', e);
        }
    },

    fetchAllUsers: async () => {
        try {
            const { data } = await api.get('/admin/users');
            set({ allUsers: data });
        } catch (e) {
            console.error('Failed to fetch all users', e);
        }
    },

    registerSuperAdmin: async (payload) => {
        try {
            const { data } = await api.post('/auth/super-admin/register', payload);
            if (data.success && data.token) {
                get().login(data.token, data.user, 'System Governance', data.orgId);
            }
        } catch (e: unknown) {
            const err = e as { response?: { status?: number; data?: { error?: string } } };
            const msg = String(err?.response?.data?.error || '').toLowerCase();
            const status = err?.response?.status;
            if (status === 400 && msg.includes('email already registered')) {
                const elevated = await api.post('/auth/super-admin/elevate', payload);
                const data = elevated.data;
                if (data?.success && data?.token) {
                    get().login(data.token, data.user, 'System Governance', data.orgId);
                    return;
                }
            }
            console.error('Failed to register/elevate super admin', e);
            throw e;
        }
    },

    deElevateSuperAdmin: async (password, targetRole = 'org_super_admin') => {
        try {
            const { data } = await api.post('/auth/super-admin/de-elevate', { password, targetRole });
            if (data?.success && data?.token) {
                const currentOrgName = get().orgName || 'Tasker';
                get().login(data.token, data.user, currentOrgName, data.orgId);
            }
        } catch (e) {
            console.error('Failed to de-elevate super admin', e);
            throw e;
        }
    },

    deleteOrganizationAdmin: async (id) => {
        try {
            await api.delete(`/admin/orgs/${id}`);
            get().fetchAllOrgs();
            get().fetchAllUsers();
            get().fetchSystemStats();
        } catch (e) {
            console.error('Failed to delete org', e);
            throw e;
        }
    },

    updateOrganizationAdmin: async (id, name) => {
        try {
            await api.put(`/admin/orgs/${id}`, { name });
            get().fetchAllOrgs();
        } catch (e) {
            console.error('Failed to update org', e);
            throw e;
        }
    },

    getOrgBoardsAdmin: async (id) => {
        try {
            const { data } = await api.get(`/admin/orgs/${id}/boards`);
            return data;
        } catch (e) {
            console.error('Failed to get org boards', e);
            return [];
        }
    },

    updateUserAdmin: async (id, updates) => {
        try {
            await api.put(`/admin/users/${id}`, updates);
            get().fetchAllUsers();
        } catch (e) {
            console.error('Failed to update user', e);
            throw e;
        }
    },

    deleteUserAdmin: async (id) => {
        try {
            await api.delete(`/admin/users/${id}`);
            get().fetchAllUsers();
            get().fetchSystemStats();
            get().fetchAllOrgs();
        } catch (e) {
            console.error('Failed to delete user', e);
            throw e;
        }
    },

    resetPasswordAdmin: async (id, password) => {
        try {
            await api.post(`/admin/users/${id}/reset-password`, { password });
        } catch (e) {
            console.error('Failed to reset password', e);
            throw e;
        }
    }
}));
