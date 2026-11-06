import { z } from 'zod';

export const AddProjectSchema = z.object({
  path: z.string().min(1),
});

export const UpdateFindingSchema = z.object({
  status: z.enum(['open', 'ignored']).optional(),
  ignoreReason: z.string().optional(),
});

export const FindingsQuerySchema = z.object({
  category: z.enum(['quality', 'architecture', 'dependencies', 'security', 'docs', 'performance']).optional(),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']).optional(),
  tool: z.string().optional(),
  status: z.enum(['open', 'fixed', 'ignored']).optional(),
});

export type AddProjectInput = z.infer<typeof AddProjectSchema>;
export type UpdateFindingInput = z.infer<typeof UpdateFindingSchema>;
export type FindingsQuery = z.infer<typeof FindingsQuerySchema>;
