import { describe, expect, it } from "vitest";
import { createMultipartForm, createTestApp, registerOwnerAndGetAuthHeader } from "./helpers.js";

const uploadTrack = async (
  app: Awaited<ReturnType<typeof createTestApp>>["app"],
  auth: { authorization: string }
) => {
  const form = createMultipartForm({
    fieldName: "track",
    filename: "share.mp3",
    contentType: "audio/mpeg",
    data: Buffer.from("share-track", "utf-8")
  });
  const response = await app.inject({
    method: "POST",
    url: "/api/tracks/upload",
    headers: { ...auth, "content-type": form.contentType },
    payload: form.body
  });
  return response.json().track.id as string;
};

describe("F-0004 Share Links", () => {
  it("AC-1: creates and resolves track share", async () => {
    const { app, cleanup } = await createTestApp();
    try {
      const auth = await registerOwnerAndGetAuthHeader(app);
      const trackId = await uploadTrack(app, auth);
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/shares",
        headers: auth,
        payload: { type: "track", targetId: trackId, expiresInHours: 1 }
      });

      expect(createResponse.statusCode).toBe(201);
      const token = createResponse.json().share.token as string;

      const resolveResponse = await app.inject({
        method: "GET",
        url: `/api/shares/${token}`
      });

      expect(resolveResponse.statusCode).toBe(200);
      expect(resolveResponse.json().track.id).toBe(trackId);
    } finally {
      await cleanup();
    }
  });

  it("AC-2: returns 403 for expired share token", async () => {
    const { app, cleanup } = await createTestApp();
    try {
      const auth = await registerOwnerAndGetAuthHeader(app);
      const trackId = await uploadTrack(app, auth);
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/shares",
        headers: auth,
        payload: { type: "track", targetId: trackId, expiresInHours: 0.00001 }
      });
      const token = createResponse.json().share.token as string;

      await new Promise((resolve) => setTimeout(resolve, 80));

      const resolveResponse = await app.inject({
        method: "GET",
        url: `/api/shares/${token}`
      });

      expect(resolveResponse.statusCode).toBe(403);
    } finally {
      await cleanup();
    }
  });

  it("AC-3: serves public share page for valid token", async () => {
    const { app, cleanup } = await createTestApp();
    try {
      const auth = await registerOwnerAndGetAuthHeader(app);
      const trackId = await uploadTrack(app, auth);
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/shares",
        headers: auth,
        payload: { type: "track", targetId: trackId }
      });
      const token = createResponse.json().share.token as string;

      const publicPageResponse = await app.inject({
        method: "GET",
        url: `/s/${token}`
      });

      expect(publicPageResponse.statusCode).toBe(200);
      expect(publicPageResponse.headers["content-type"]).toContain("text/html");
    } finally {
      await cleanup();
    }
  });
});
