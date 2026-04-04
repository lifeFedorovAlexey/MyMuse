import { describe, expect, it } from "vitest";
import { createMultipartForm, createTestApp, registerOwnerAndGetAuthHeader } from "./helpers.js";

const uploadTrack = async (
  app: Awaited<ReturnType<typeof createTestApp>>["app"],
  auth: { authorization: string }
) => {
  const form = createMultipartForm({
    fieldName: "track",
    filename: "playlist.mp3",
    contentType: "audio/mpeg",
    data: Buffer.from("playlist-track", "utf-8")
  });
  const response = await app.inject({
    method: "POST",
    url: "/api/tracks/upload",
    headers: { ...auth, "content-type": form.contentType },
    payload: form.body
  });
  return response.json().track.id as string;
};

describe("F-0003 Playlists CRUD", () => {
  it("AC-1: creates playlist with 201", async () => {
    const { app, cleanup } = await createTestApp();
    try {
      const auth = await registerOwnerAndGetAuthHeader(app);
      const response = await app.inject({
        method: "POST",
        url: "/api/playlists",
        headers: auth,
        payload: { name: "Focus mix" }
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().playlist.id).toBeTypeOf("string");
    } finally {
      await cleanup();
    }
  });

  it("AC-2: adds existing track to playlist", async () => {
    const { app, cleanup } = await createTestApp();
    try {
      const auth = await registerOwnerAndGetAuthHeader(app);
      const trackId = await uploadTrack(app, auth);
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/playlists",
        headers: auth,
        payload: { name: "Road trip" }
      });
      const playlistId = createResponse.json().playlist.id as string;

      const addResponse = await app.inject({
        method: "POST",
        url: `/api/playlists/${playlistId}/tracks`,
        headers: auth,
        payload: { trackId }
      });

      expect(addResponse.statusCode).toBe(200);
      expect(addResponse.json().playlist.trackIds).toContain(trackId);
    } finally {
      await cleanup();
    }
  });

  it("AC-3: returns 404 when adding missing track", async () => {
    const { app, cleanup } = await createTestApp();
    try {
      const auth = await registerOwnerAndGetAuthHeader(app);
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/playlists",
        headers: auth,
        payload: { name: "Empty" }
      });
      const playlistId = createResponse.json().playlist.id as string;

      const response = await app.inject({
        method: "POST",
        url: `/api/playlists/${playlistId}/tracks`,
        headers: auth,
        payload: { trackId: "missing-track-id" }
      });

      expect(response.statusCode).toBe(404);
    } finally {
      await cleanup();
    }
  });
});
