import { describe, expect, it } from "vitest";
import { createTestApp } from "./helpers.js";

describe("F-0007 Auth Owner + Invite", () => {
  it("registers owner and logs in", async () => {
    const { app, cleanup } = await createTestApp();
    try {
      const register = await app.inject({
        method: "POST",
        url: "/auth/register-owner",
        payload: {
          name: "Owner",
          email: "owner@mymuse.local",
          password: "StrongPass123"
        }
      });
      expect(register.statusCode).toBe(201);
      expect(register.json().accessToken).toBeTypeOf("string");

      const login = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: {
          email: "owner@mymuse.local",
          password: "StrongPass123"
        }
      });
      expect(login.statusCode).toBe(200);
      expect(login.json().user.role).toBe("owner");
    } finally {
      await cleanup();
    }
  });

  it("blocks private endpoint without bearer token", async () => {
    const { app, cleanup } = await createTestApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/tracks"
      });
      expect(response.statusCode).toBe(401);
    } finally {
      await cleanup();
    }
  });

  it("creates invite and accepts it as regular user", async () => {
    const { app, cleanup } = await createTestApp();
    try {
      const register = await app.inject({
        method: "POST",
        url: "/auth/register-owner",
        payload: {
          name: "Owner",
          email: "owner@mymuse.local",
          password: "StrongPass123"
        }
      });
      const ownerToken = register.json().accessToken as string;

      const invite = await app.inject({
        method: "POST",
        url: "/auth/invites",
        headers: {
          authorization: `Bearer ${ownerToken}`
        },
        payload: {
          expiresInHours: 12
        }
      });
      expect(invite.statusCode).toBe(201);
      const token = invite.json().invite.token as string;

      const accept = await app.inject({
        method: "POST",
        url: "/auth/accept-invite",
        payload: {
          token,
          name: "Member",
          email: "member@mymuse.local",
          password: "StrongPass456"
        }
      });
      expect(accept.statusCode).toBe(201);
      expect(accept.json().user.role).toBe("user");
    } finally {
      await cleanup();
    }
  });
});
