import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { buildServer } from "../src/server.js";

const testDirPrefix = path.join(os.tmpdir(), "mymuse-tests-");

export const createMultipartForm = (options: {
  fieldName: string;
  filename: string;
  contentType: string;
  data: Buffer;
}) => {
  const boundary = `----mymuse-boundary-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${options.fieldName}"; filename="${options.filename}"\r\n` +
      `Content-Type: ${options.contentType}\r\n\r\n`,
    "utf-8"
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, "utf-8");

  return {
    body: Buffer.concat([head, options.data, tail]),
    contentType: `multipart/form-data; boundary=${boundary}`
  };
};

export const createMultipartWithoutFile = () => {
  const boundary = `----mymuse-boundary-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const body = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="meta"\r\n\r\n` +
      `demo\r\n` +
      `--${boundary}--\r\n`,
    "utf-8"
  );

  return {
    body,
    contentType: `multipart/form-data; boundary=${boundary}`
  };
};

export const createTestApp = async () => {
  const tempRoot = await mkdtemp(testDirPrefix);
  const dataDir = path.join(tempRoot, "data");
  const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");
  const app = buildServer({
    dataDir,
    publicDir,
    logger: false,
    storageDriver: "file"
  });

  await app.ready();

  const cleanup = async () => {
    await app.close();
    await rm(tempRoot, { recursive: true, force: true });
  };

  return { app, cleanup, dataDir };
};

export const registerOwnerAndGetAuthHeader = async (
  app: Awaited<ReturnType<typeof createTestApp>>["app"]
) => {
  const response = await app.inject({
    method: "POST",
    url: "/auth/register-owner",
    payload: {
      name: "Owner",
      email: "owner@mymuse.local",
      password: "StrongPass123"
    }
  });
  const payload = response.json() as { accessToken: string };
  return {
    authorization: `Bearer ${payload.accessToken}`
  };
};
