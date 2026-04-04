import { describe, expect, it } from "vitest";
import { createMultipartForm, createTestApp, registerOwnerAndGetAuthHeader } from "./helpers.js";

const uploadTrack = async (
  app: Awaited<ReturnType<typeof createTestApp>>["app"],
  auth: { authorization: string },
  name = "manage.mp3"
) => {
  const form = createMultipartForm({
    fieldName: "track",
    filename: name,
    contentType: "audio/mpeg",
    data: Buffer.from(`content-${name}`, "utf-8")
  });
  const response = await app.inject({
    method: "POST",
    url: "/api/tracks/upload",
    headers: { ...auth, "content-type": form.contentType },
    payload: form.body
  });
  return response.json().track.id as string;
};

describe("F-0005 Library Management", () => {
  it("updates track metadata", async () => {
    const { app, cleanup } = await createTestApp();
    try {
      const auth = await registerOwnerAndGetAuthHeader(app);
      const id = await uploadTrack(app, auth);
      const patchResponse = await app.inject({
        method: "PATCH",
        url: `/api/tracks/${id}`,
        headers: auth,
        payload: {
          title: "New title",
          artist: "New artist",
          album: "New album"
        }
      });
      expect(patchResponse.statusCode).toBe(200);
      expect(patchResponse.json().track.title).toBe("New title");
    } finally {
      await cleanup();
    }
  });

  it("deletes track and returns 204", async () => {
    const { app, cleanup } = await createTestApp();
    try {
      const auth = await registerOwnerAndGetAuthHeader(app);
      const id = await uploadTrack(app, auth, "delete.mp3");
      const deleteResponse = await app.inject({ method: "DELETE", url: `/api/tracks/${id}`, headers: auth });
      expect(deleteResponse.statusCode).toBe(204);

      const listResponse = await app.inject({ method: "GET", url: "/api/tracks", headers: auth });
      expect(listResponse.json().tracks.some((track: { id: string }) => track.id === id)).toBe(false);
    } finally {
      await cleanup();
    }
  });

  it("removes track from playlist via delete endpoint", async () => {
    const { app, cleanup } = await createTestApp();
    try {
      const auth = await registerOwnerAndGetAuthHeader(app);
      const trackId = await uploadTrack(app, auth, "pl-remove.mp3");
      const createPlaylist = await app.inject({
        method: "POST",
        url: "/api/playlists",
        headers: auth,
        payload: { name: "Temp List" }
      });
      const playlistId = createPlaylist.json().playlist.id as string;
      await app.inject({
        method: "POST",
        url: `/api/playlists/${playlistId}/tracks`,
        headers: auth,
        payload: { trackId }
      });

      const removeResponse = await app.inject({
        method: "DELETE",
        url: `/api/playlists/${playlistId}/tracks/${trackId}`,
        headers: auth
      });
      expect(removeResponse.statusCode).toBe(200);
      expect(removeResponse.json().playlist.trackIds).not.toContain(trackId);
    } finally {
      await cleanup();
    }
  });
});
