import { describe, expect, test } from "bun:test";
import { createApp } from "./app.ts";
import { MemoryRateLimitStore } from "./middleware/rate-limit.ts";

function testApp(max = 100) {
  return createApp({
    rateLimit: { max, store: new MemoryRateLimitStore() },
  });
}

describe("app", () => {
  test("reports health", async () => {
    const response = await testApp().request("/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  test("uses one error shape for missing routes", async () => {
    const response = await testApp().request("/missing", {
      headers: { "x-request-id": "request-1" },
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "No route for GET /missing",
      },
      requestId: "request-1",
    });
  });

  test("returns validation errors", async () => {
    const response = await testApp().request("/todos", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": "request-2",
      },
      body: JSON.stringify({ title: "" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "VALIDATION_ERROR" },
      requestId: "request-2",
    });
  });

  test("creates, updates, and deletes a todo", async () => {
    const app = testApp();
    const createResponse = await app.request("/todos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Ship Bono" }),
    });
    const todo = (await createResponse.json()) as { id: string };

    expect(createResponse.status).toBe(201);

    const getResponse = await app.request(`/todos/${todo.id}`);
    expect(getResponse.status).toBe(200);
    expect(await getResponse.json()).toMatchObject({
      id: todo.id,
      title: "Ship Bono",
      completed: false,
    });

    const updateResponse = await app.request(`/todos/${todo.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ completed: true }),
    });
    expect(updateResponse.status).toBe(200);
    expect(await updateResponse.json()).toMatchObject({ completed: true });

    const deleteResponse = await app.request(`/todos/${todo.id}`, {
      method: "DELETE",
    });
    expect(deleteResponse.status).toBe(204);

    const missingResponse = await app.request(`/todos/${todo.id}`);
    expect(missingResponse.status).toBe(404);
    expect(await missingResponse.json()).toMatchObject({
      error: { code: "TODO_NOT_FOUND" },
    });
  });

  test("limits repeated requests", async () => {
    const app = testApp(1);

    expect((await app.request("/health")).status).toBe(200);

    const response = await app.request("/health");
    expect(response.status).toBe(429);
    expect(response.headers.get("RateLimit-Remaining")).toBe("0");
    expect(await response.json()).toMatchObject({
      error: { code: "RATE_LIMITED" },
    });
  });
});
