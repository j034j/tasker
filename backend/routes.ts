import { Router } from 'express';
import type { Request, Response } from 'express';
import { registerOrg, login, createBoard, createTask, getBoard, getBoards, getReportingOverview, emailReportingExport, getOrgMembersOverview, getWeeklyObjective, getWeeklyObjectiveHistory, upsertWeeklyObjective, requestOrgSuperAdminPromotion, confirmOrgSuperAdminPromotion, moveTask, updateTask, getTaskOverrideHistory, deleteTask, updateBoard, deleteBoard, deleteOrganization, toggleBoardFollow, toggleTaskInterest, getInviteCandidates, getTasksForInvite, sendTaskInvite, getMyInvites, acceptTaskInvite, declineTaskInvite, findOrg, searchOrgs, registerUser, switchOrganization, translateText, updateUserLastBoard, updateUser, getUserProfile, getNotifications, markNotificationRead, registerSuperAdmin, elevateToSuperAdmin, deElevateSuperAdmin, getSystemStats, getAllOrgs, getAllUsers, deleteOrganizationAdmin, updateOrganizationAdmin, getOrgBoardsAdmin, updateUserAdmin, deleteUserAdmin, resetPasswordAdmin, requestPasswordReset, resetPassword, requestEmailVerificationCode, verifyEmailVerificationCode } from './controllers.js';
import { authenticateToken, requireSuperAdmin, loginRateLimiter, passwordResetRateLimiter, translateRateLimiter } from './middleware.js';
import db from './db.js';

export const router = Router();

router.get('/health', async (_req: Request, res: Response) => {
    try {
        await db.query('SELECT 1');
        const envStatus = {
            JWT_SECRET: !!process.env.JWT_SECRET,
            SUPER_ADMIN_SECRET: !!process.env.SUPER_ADMIN_SECRET,
            DATABASE_URL: !!process.env.DATABASE_URL,
            SKIP_EMAIL_VERIFICATION: !!process.env.SKIP_EMAIL_VERIFICATION,
        };
        res.json({ status: 'ok', database: 'connected', env: envStatus });
    } catch (err: any) {
        res.status(500).json({ status: 'error', database: 'disconnected', message: err.message });
    }
});

// Auth & Org
router.post('/orgs/register', registerOrg);
router.get('/orgs/lookup', findOrg);
router.get('/orgs/search', searchOrgs);
router.post('/auth/login', loginRateLimiter, login);
router.post('/auth/register', registerUser);
router.post('/auth/email-verification/request', requestEmailVerificationCode);
router.post('/auth/email-verification/verify', verifyEmailVerificationCode);
router.put('/users/me/org', authenticateToken, switchOrganization);
router.put('/users/me/board', authenticateToken, updateUserLastBoard);
router.put('/users/me', authenticateToken, updateUser);
router.get('/users/me/profile', authenticateToken, getUserProfile);
router.get('/notifications', authenticateToken, getNotifications);
router.put('/notifications/:id/read', authenticateToken, markNotificationRead);

router.post('/boards', authenticateToken, createBoard);
router.get('/boards/:id', authenticateToken, getBoard);
router.put('/boards/:id', authenticateToken, updateBoard);
router.delete('/boards/:id', authenticateToken, deleteBoard);
router.post('/boards/:id/follow', authenticateToken, toggleBoardFollow);

router.delete('/orgs/:id', authenticateToken, deleteOrganization);
router.get('/orgs/:orgId/boards', authenticateToken, getBoards);
router.get('/reports/overview/:orgId', authenticateToken, getReportingOverview);
router.post('/reports/overview/:orgId/email', authenticateToken, emailReportingExport);
router.get('/orgs/:orgId/members/overview', authenticateToken, getOrgMembersOverview);
router.get('/orgs/:orgId/weekly-objective', authenticateToken, getWeeklyObjective);
router.get('/orgs/:orgId/weekly-objective/history', authenticateToken, getWeeklyObjectiveHistory);
router.put('/orgs/:orgId/weekly-objective', authenticateToken, upsertWeeklyObjective);
router.post('/orgs/:orgId/super-admin/promote/request', authenticateToken, requestOrgSuperAdminPromotion);
router.post('/orgs/:orgId/super-admin/promote/confirm', authenticateToken, confirmOrgSuperAdminPromotion);

router.post('/tasks', authenticateToken, createTask);
router.put('/tasks/:id', authenticateToken, updateTask);
router.get('/tasks/:id/override-history', authenticateToken, getTaskOverrideHistory);
router.delete('/tasks/:id', authenticateToken, deleteTask);
router.post('/tasks/move', authenticateToken, moveTask);
router.post('/tasks/:id/interest', authenticateToken, toggleTaskInterest);
router.get('/orgs/:orgId/invite-candidates', authenticateToken, getInviteCandidates);
router.get('/orgs/:orgId/tasks-for-invite', authenticateToken, getTasksForInvite);
router.post('/tasks/:taskId/invites', authenticateToken, sendTaskInvite);
router.get('/invites', authenticateToken, getMyInvites);
router.post('/invites/:id/accept', authenticateToken, acceptTaskInvite);
router.post('/invites/:id/decline', authenticateToken, declineTaskInvite);

router.post('/translate', authenticateToken, translateRateLimiter, translateText);

// Super Admin
router.post('/auth/super-admin/register', registerSuperAdmin);
router.post('/auth/super-admin/elevate', elevateToSuperAdmin);
router.post('/auth/super-admin/de-elevate', authenticateToken, deElevateSuperAdmin);
router.get('/admin/stats', authenticateToken, requireSuperAdmin, getSystemStats);
router.get('/admin/orgs', authenticateToken, requireSuperAdmin, getAllOrgs);
router.get('/admin/users', authenticateToken, requireSuperAdmin, getAllUsers);

// Super Admin Management
router.delete('/admin/orgs/:id', authenticateToken, requireSuperAdmin, deleteOrganizationAdmin);
router.put('/admin/orgs/:id', authenticateToken, requireSuperAdmin, updateOrganizationAdmin);
router.get('/admin/orgs/:id/boards', authenticateToken, requireSuperAdmin, getOrgBoardsAdmin);
router.put('/admin/users/:id', authenticateToken, requireSuperAdmin, updateUserAdmin);
router.delete('/admin/users/:id', authenticateToken, requireSuperAdmin, deleteUserAdmin);
router.post('/admin/users/:id/reset-password', authenticateToken, requireSuperAdmin, resetPasswordAdmin);

// Password Recovery
router.post('/auth/request-password-reset', passwordResetRateLimiter, requestPasswordReset);
router.post('/auth/reset-password', resetPassword);

