import { Hono } from "hono";
import type { AppEnv } from "../../lib/app-env.ts";
import { AppError } from "../../lib/errors.ts";
import { validate } from "../../lib/validate.ts";
import {
  createTodoSchema,
  todoIdParamSchema,
  updateTodoSchema,
} from "./todos.schema.ts";
import {
  createTodo,
  deleteTodo,
  getTodo,
  listTodos,
  updateTodo,
} from "./todos.service.ts";

export const todosRoutes = new Hono<AppEnv>()
  .get("/", (c) => {
    return c.json(listTodos());
  })
  .get("/:id", validate("param", todoIdParamSchema), (c) => {
    const { id } = c.req.valid("param");
    const todo = getTodo(id);
    if (!todo) {
      throw new AppError(404, "TODO_NOT_FOUND", `No todo with id ${id}`);
    }
    return c.json(todo);
  })
  .post("/", validate("json", createTodoSchema), (c) => {
    const todo = createTodo(c.req.valid("json"));
    return c.json(todo, 201);
  })
  .patch(
    "/:id",
    validate("param", todoIdParamSchema),
    validate("json", updateTodoSchema),
    (c) => {
      const { id } = c.req.valid("param");
      const todo = updateTodo(id, c.req.valid("json"));
      if (!todo) {
        throw new AppError(404, "TODO_NOT_FOUND", `No todo with id ${id}`);
      }
      return c.json(todo);
    },
  )
  .delete("/:id", validate("param", todoIdParamSchema), (c) => {
    const { id } = c.req.valid("param");
    if (!deleteTodo(id)) {
      throw new AppError(404, "TODO_NOT_FOUND", `No todo with id ${id}`);
    }
    return c.body(null, 204);
  });
