import { z } from "zod";

export const todoSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1).max(200),
  completed: z.boolean(),
  createdAt: z.iso.datetime(),
});

export const createTodoSchema = z.object({
  title: z.string().min(1).max(200),
});

export const updateTodoSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    completed: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "Provide at least one field to update",
  });

export const todoIdParamSchema = z.object({
  id: z.uuid(),
});

export type Todo = z.infer<typeof todoSchema>;
export type CreateTodo = z.infer<typeof createTodoSchema>;
export type UpdateTodo = z.infer<typeof updateTodoSchema>;
