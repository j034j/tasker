import { z } from 'zod';

export const registerSchema = z.object({
    name: z.string().min(1, 'Name is required').max(100),
    email: z.string().email('Invalid email'),
    password: z.string().min(6, 'Password must be at least 6 characters').max(100),
    orgName: z.string().min(1, 'Organization name is required').max(100).optional(),
    username: z.string().min(1, 'Username is required').max(50).optional(),
});

export const loginSchema = z.object({
    email: z.string().email('Invalid email'),
    password: z.string().min(1, 'Password is required'),
});

export const createBoardSchema = z.object({
    name: z.string().min(1, 'Board name is required').max(100),
    isPublic: z.boolean().optional(),
});

export const createTaskSchema = z.object({
    columnId: z.string().uuid('Invalid column ID'),
    title: z.string().min(1, 'Title is required').max(200),
    description: z.string().max(5000).optional(),
    assignedTo: z.string().uuid().optional().nullable(),
    urgency: z.number().min(0).max(100).optional(),
    dueDate: z.string().datetime().optional().nullable(),
    weatherSensitive: z.boolean().optional(),
    fundingNeeded: z.number().min(0).optional(),
    skillRequired: z.string().max(100).optional(),
    projectDuration: z.string().max(50).optional(),
    projectLocation: z.string().max(200).optional(),
    peopleRequired: z.number().min(1).max(100).optional(),
    skills: z.string().max(500).optional(),
    weatherCode: z.number().min(0).max(100).optional(),
});

export const updateTaskSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(5000).optional(),
    assignedTo: z.string().uuid().optional().nullable(),
    urgency: z.number().min(0).max(100).optional(),
    dueDate: z.string().datetime().optional().nullable(),
    weatherSensitive: z.boolean().optional(),
    fundingNeeded: z.number().min(0).optional(),
    skillRequired: z.string().max(100).optional(),
    projectDuration: z.string().max(50).optional(),
    projectLocation: z.string().max(200).optional(),
    peopleRequired: z.number().min(1).max(100).optional(),
    skills: z.string().max(500).optional(),
    weatherCode: z.number().min(0).max(100).optional(),
    adminOverrideUrgency: z.number().min(0).max(100).optional().nullable(),
    adminOverridePriority: z.number().min(0).max(100).optional(),
});

export const updateUserSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    username: z.string().max(50).optional(),
    phoneNumber: z.string().max(20).optional(),
    skills: z.string().max(500).optional(),
    location: z.string().max(200).optional(),
});

export const createOrgSchema = z.object({
    name: z.string().min(1, 'Organization name is required').max(100),
});

export const orgRegistrationSchema = z.object({
    orgName: z.string().min(1, 'Organization name is required').max(100),
    userName: z.string().min(1, 'Your name is required').max(100),
    name: z.string().min(1).max(100).optional(), // Support both formats
    username: z.string().min(1, 'Username is required').max(50),
    email: z.string().email('Invalid email'),
    password: z.string().min(6, 'Password must be at least 6 characters').max(100),
    verificationToken: z.string().min(1, 'Verification token is required'),
    phoneNumber: z.string().max(20).optional(),
    skills: z.string().max(500).optional(),
    location: z.string().max(200).optional(),
});

export const passwordResetRequestSchema = z.object({
    email: z.string().email('Invalid email'),
});

export const createDepartmentSchema = z.object({
    name: z.string().min(1, 'Department name is required').max(100),
    adminUserId: z.string().uuid('Invalid admin user ID').optional().nullable(),
});

export const updateDepartmentSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    adminUserId: z.string().uuid().optional().nullable(),
});

export const passwordResetSchema = z.object({
    token: z.string().min(1, 'Token is required'),
    newPassword: z.string().min(6, 'Password must be at least 6 characters').max(100),
});

export const emailVerificationRequestSchema = z.object({
    email: z.string().email('Invalid email'),
});

export const emailVerificationVerifySchema = z.object({
    email: z.string().email('Invalid email'),
    code: z.string().length(6, 'Code must be 6 digits'),
});

export const moveTaskSchema = z.object({
    taskId: z.string().uuid('Invalid task ID'),
    targetColumnId: z.string().uuid('Invalid column ID'),
    newIndex: z.number().int().min(0).optional(),
});

export const translateTextSchema = z.object({
    text: z.string().min(1).max(5000),
    targetLang: z.string().length(2),
});