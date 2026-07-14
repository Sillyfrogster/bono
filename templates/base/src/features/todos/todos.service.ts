import type { CreateTodo, Todo, UpdateTodo } from "./todos.schema.ts";

const todos = new Map<string, Todo>();

export function listTodos(): Todo[] {
  return [...todos.values()];
}

export function getTodo(id: string): Todo | undefined {
  return todos.get(id);
}

export function createTodo(input: CreateTodo): Todo {
  const todo: Todo = {
    id: crypto.randomUUID(),
    title: input.title,
    completed: false,
    createdAt: new Date().toISOString(),
  };
  todos.set(todo.id, todo);
  return todo;
}

export function updateTodo(id: string, input: UpdateTodo): Todo | undefined {
  const existing = todos.get(id);
  if (!existing) {
    return undefined;
  }
  const updated: Todo = { ...existing, ...input };
  todos.set(id, updated);
  return updated;
}

export function deleteTodo(id: string): boolean {
  return todos.delete(id);
}
