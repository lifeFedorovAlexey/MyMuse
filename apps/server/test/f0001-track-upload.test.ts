import { describe, expect, it } from "vitest";
import path from "node:path";
import { access } from "node:fs/promises";
import {
  createMultipartForm,
  createMultipartWithoutFile,
  createTestApp,
  registerOwnerAndGetAuthHeader
} from "./helpers.js";

describe("F-0001 Track Upload", () => {
  it("AC-1: uploads valid file and returns 201 with track id", async () => {
    const { app, cleanup } = await createTestApp();
    try {
      const auth = await registerOwnerAndGetAuthHeader(app);
      const fileData = Buffer.from("fake-audio-bytes", "utf-8");
      const form = createMultipartForm({
        fieldName: "track",
        filename: "song.mp3",
        contentType: "audio/mpeg",
        data: fileData
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/tracks/upload",
        headers: { ...auth, "content-type": form.contentType },
        payload: form.body
      });

      expect(response.statusCode).toBe(201);
      const payload = response.json();
      expect(payload.track.id).toBeTypeOf("string");
    } finally {
      await cleanup();
    }
  });

  it("AC-2: persists uploaded file in storage", async () => {
    const { app, cleanup, dataDir } = await createTestApp();
    try {
      const auth = await registerOwnerAndGetAuthHeader(app);
      const form = createMultipartForm({
        fieldName: "track",
        filename: "persist.mp3",
        contentType: "audio/mpeg",
        data: Buffer.from("persist-me", "utf-8")
      });

      const uploadResponse = await app.inject({
        method: "POST",
        url: "/api/tracks/upload",
        headers: { ...auth, "content-type": form.contentType },
        payload: form.body
      });

      const uploadPayload = uploadResponse.json();
      const tracksResponse = await app.inject({ method: "GET", url: "/api/tracks", headers: auth });
      const tracksPayload = tracksResponse.json();
      const savedTrack = tracksPayload.tracks.find((track: { id: string }) => track.id === uploadPayload.track.id);
      expect(savedTrack).toBeTruthy();

      const uploadsDir = path.join(dataDir, "uploads");
      const fullPath = path.join(uploadsDir, savedTrack.filename);
      await expect(access(fullPath)).resolves.toBeUndefined();
    } finally {
      await cleanup();
    }
  });

  it("AC-3: returns 400 when multipart request has no file", async () => {
    const { app, cleanup } = await createTestApp();
    try {
      const auth = await registerOwnerAndGetAuthHeader(app);
      const body = createMultipartWithoutFile();
      const response = await app.inject({
        method: "POST",
        url: "/api/tracks/upload",
        headers: { ...auth, "content-type": body.contentType },
        payload: body.body
      });

      expect(response.statusCode).toBe(400);
    } finally {
      await cleanup();
    }
  });
});
