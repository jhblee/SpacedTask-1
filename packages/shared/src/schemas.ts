import { z } from 'zod';

/** Regex for YYYY-MM-DD local date strings */
const localDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a YYYY-MM-DD date string');

export const TaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, 'Title must not be empty').max(500),
  startDate: localDateString,
  repetitionIndex: z.number().int().min(0).max(4),
  nextDueDate: localDateString,
  lastCompletedDate: localDateString.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateTaskInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title must not be empty or whitespace')
    .max(500),
});

export const CompleteTaskInputSchema = z.object({
  id: z.string().uuid(),
});

export const ResetTaskInputSchema = z.object({
  id: z.string().uuid(),
});

export const DeleteTaskInputSchema = z.object({
  id: z.string().uuid(),
});

export const SetMockDateInputSchema = z.object({
  date: localDateString.nullable(),
});

export type TaskSchemaType = z.infer<typeof TaskSchema>;
export type CreateTaskInputType = z.infer<typeof CreateTaskInputSchema>;
