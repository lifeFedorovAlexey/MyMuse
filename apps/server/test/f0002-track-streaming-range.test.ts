import { describe, expect, it } from "vitest";
import { createMultipartForm, createTestApp, registerOwnerAndGetAuthHeader } from "./helpers.js";

const uploadTrack = async (
  app: Awaited<ReturnType<typeof createTestApp>>["app"],
  data: Buffer,
  auth: { authorization: string }
) => {
  const form = createMultipartForm({
    fieldName: "track",
    filename: "stream.mp3",
    contentType: "audio/mpeg",
    data
  });
  const response = await app.inject({
    method: "POST",
    url: "/api/tracks/upload",
    headers: { ...auth, "content-type": form.contentType },
    payload: form.body
  });
  return response.json().track.id as string;
};

describe("F-0002 Track Streaming with Range", () => {
  it("AC-1: streams full content with 200", async () => {
    const { app, cleanup } = await createTestApp();
    try {
      const auth = await registerOwnerAndGetAuthHeader(app);
      const source = Buffer.from("0123456789", "utf-8");
      const id = await uploadTrack(app, source, auth);
      const response = await app.inject({ method: "GET", url: `/api/tracks/${id}/stream` });

      expect(response.statusCode).toBe(200);
      expect(Buffer.from(response.rawPayload).equals(source)).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("AC-2: returns partial content with 206 and range headers", async () => {
    const { app, cleanup } = await createTestApp();
    try {
      const auth = await registerOwnerAndGetAuthHeader(app);
      const source = Buffer.from("abcdefghij", "utf-8");
      const id = await uploadTrack(app, source, auth);
      const response = await app.inject({
        method: "GET",
        url: `/api/tracks/${id}/stream`,
        headers: {
          range: "bytes=0-3"
        }
      });

      expect(response.statusCode).toBe(206);
      expect(response.headers["content-range"]).toContain("bytes 0-3/");
      expect(Buffer.from(response.rawPayload).toString("utf-8")).toBe("abcd");
    } finally {
      await cleanup();
    }
  });

  it("AC-3: returns 416 for invalid range", async () => {
    const { app, cleanup } = await createTestApp();
    try {
      const auth = await registerOwnerAndGetAuthHeader(app);
      const id = await uploadTrack(app, Buffer.from("small", "utf-8"), auth);
      const response = await app.inject({
        method: "GET",
        url: `/api/tracks/${id}/stream`,
        headers: {
          range: "bytes=999-1000"
        }
      });

      expect(response.statusCode).toBe(416);
    } finally {
      await cleanup();
    }
  });
});
