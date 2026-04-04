import { describe, expect, it } from "vitest";
import { createMultipartForm, createTestApp, registerOwnerAndGetAuthHeader } from "./helpers.js";

const uploadTrack = async (
  app: Awaited<ReturnType<typeof createTestApp>>["app"],
  auth: { authorization: string }
) => {
  const form = createMultipartForm({
    fieldName: "track",
    filename: "share-manager.mp3",
    contentType: "audio/mpeg",
    data: Buffer.from("share-manager", "utf-8")
  });
  const response = await app.inject({
    method: "POST",
    url: "/api/tracks/upload",
    headers: { ...auth, "content-type": form.contentType },
    payload: form.body
  });
  return response.json().track.id as string;
};

describe("F-0006 Share Manager", () => {
  it("lists active shares with public url", async () => {
    const { app, cleanup } = await createTestApp();
    try {
      const auth = await registerOwnerAndGetAuthHeader(app);
      const trackId = await uploadTrack(app, auth);
      await app.inject({
        method: "POST",
        url: "/api/shares",
        headers: auth,
        payload: { type: "track", targetId: trackId }
      });

      const listResponse = await app.inject({ method: "GET", url: "/api/shares", headers: auth });
      expect(listResponse.statusCode).toBe(200);
      const share = listResponse.json().shares[0];
      expect(share.url).toContain("/s/");
    } finally {
      await cleanup();
    }
  });

  it("revokes share and hides it from list", async () => {
    const { app, cleanup } = await createTestApp();
    try {
      const auth = await registerOwnerAndGetAuthHeader(app);
      const trackId = await uploadTrack(app, auth);
      const createShare = await app.inject({
        method: "POST",
        url: "/api/shares",
        headers: auth,
        payload: { type: "track", targetId: trackId }
      });
      const token = createShare.json().share.token as string;

      const revoke = await app.inject({
        method: "DELETE",
        url: `/api/shares/${token}`,
        headers: auth
      });
      expect(revoke.statusCode).toBe(204);

      const resolve = await app.inject({
        method: "GET",
        url: `/api/shares/${token}`
      });
      expect(resolve.statusCode).toBe(404);
    } finally {
      await cleanup();
    }
  });
});
