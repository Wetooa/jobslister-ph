import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST } from "./route";
import { GET as GET_SESSION } from "../session/route";

describe("auth routes", () => {
  const originalPassword = process.env.ADMIN_PASSWORD;

  beforeEach(() => {
    process.env.ADMIN_PASSWORD = "test-admin-secret";
  });

  afterEach(() => {
    if (originalPassword === undefined) {
      delete process.env.ADMIN_PASSWORD;
    } else {
      process.env.ADMIN_PASSWORD = originalPassword;
    }
  });

  it("POST /api/auth/login returns 503 when ADMIN_PASSWORD is unset", async () => {
    delete process.env.ADMIN_PASSWORD;

    const res = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "x" }),
      }),
    );

    expect(res.status).toBe(503);
  });

  it("POST /api/auth/login returns 401 for wrong password", async () => {
    const res = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "wrong" }),
      }),
    );

    expect(res.status).toBe(401);
  });

  it("POST /api/auth/login returns token and GET /api/auth/session accepts it", async () => {
    const loginRes = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "test-admin-secret" }),
      }),
    );

    expect(loginRes.status).toBe(200);
    const { token } = (await loginRes.json()) as { token: string };
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);

    const sessionRes = await GET_SESSION(
      new Request("http://localhost/api/auth/session", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    expect(sessionRes.status).toBe(200);
    const sessionBody = (await sessionRes.json()) as { ok: boolean };
    expect(sessionBody.ok).toBe(true);
  });

  it("GET /api/auth/session returns 401 without Bearer token", async () => {
    const res = await GET_SESSION(
      new Request("http://localhost/api/auth/session"),
    );

    expect(res.status).toBe(401);
  });

  it("GET /api/auth/session returns 401 for invalid token", async () => {
    const res = await GET_SESSION(
      new Request("http://localhost/api/auth/session", {
        headers: { Authorization: "Bearer not-a-real-token" },
      }),
    );

    expect(res.status).toBe(401);
  });
});
