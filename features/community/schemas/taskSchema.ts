import { z } from 'zod';

export const taskSchema = z.object({
    areaId: z.string().min(1, 'Required'),
    titleDirect: z.string().min(3, 'Title must be at least 3 characters'),
    descriptionDirect: z.string().min(10, 'Description must be at least 10 characters'),
    deliverableDirect: z.string().optional(),
    type: z.enum(['service', 'personnel', 'voluntary']),
    status: z.enum(['planned', 'in_progress', 'completed', 'paused', 'cancelled']),
    costXrd: z.string().refine(val => !isNaN(Number(val)), 'Must be a number'),
    costUsd: z.string().refine(val => !isNaN(Number(val)), 'Must be a number'),
    startDate: z.string().min(1, 'Required'),
    endDate: z.string().optional(),
    tags: z.string().optional(),
    githubUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
    assignedMembers: z.string().optional(),
});

export type TaskFormValues = z.infer<typeof taskSchema>;
