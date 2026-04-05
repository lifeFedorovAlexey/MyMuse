import Fastify from "fastify";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import sensible from "@fastify/sensible";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { config } from "./config.js";
import { FileStore } from "./store.js";
import { PgStore } from "./pg-store.js";
import { createAccessToken, hashPassword, verifyAccessToken, verifyPassword } from "./auth.js";
import type { Track, User } from "./types.js";
import type { AppStore } from "./store.contract.js";

const createSafeFilename = (inputName: string): string => {
  const ext = path.extname(inputName || "").slice(0, 10);
  return `${Date.now()}-${randomUUID()}${ext}`;
};

const sanitizeMetadataPart = (value: string): string =>
  value
    .replace(/[_]+/g, " ")
    .replace(/\s+-\s+/g, " - ")
    .replace(/\s+/g, " ")
    .replace(/\b\d{6,}\b/g, "")
    .trim();

const inferTrackMetadata = (originalFilename: string): Pick<Track, "title" | "artist" | "album"> => {
  const parsed = path.parse(originalFilename);
  const normalized = sanitizeMetadataPart(parsed.name);

  const separators = [" - ", " – ", " — "];
  for (const separator of separators) {
    if (!normalized.includes(separator)) {
      continue;
    }

    const [artistRaw, ...titleParts] = normalized.split(separator);
    const artist = sanitizeMetadataPart(artistRaw);
    const title = sanitizeMetadataPart(titleParts.join(" - "));
    if (artist && title) {
      return {
        title,
        artist,
        album: "Single"
      };
    }
  }

  return {
    title: normalized || "Unknown title",
    artist: "Unknown artist",
    album: "Unknown album"
  };
};

type BuildServerOptions = {
  dataDir?: string;
  publicDir?: string;
  logger?: boolean;
  storageDriver?: "postgres" | "file";
  databaseUrl?: string;
};

type AuthRequest = FastifyRequest & { authUser?: User };

type RateLimitRule = {
  limit: number;
  windowMs: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const publicApiRoutes = new Set([
  "/health",
  "/ready",
  "/legal/disclaimer",
  "/",
  "/s/:token",
  "/invite/:token",
  "/auth/register-owner",
  "/auth/setup-state",
  "/auth/login",
  "/auth/accept-invite",
  "/api/shares/:token",
  "/api/shares/:token/stream",
  "/api/tracks/:id/stream"
]);

const publicRateLimits = new Map<string, RateLimitRule>([
  ["/auth/register-owner", { limit: 5, windowMs: 10 * 60 * 1000 }],
  ["/auth/login", { limit: 20, windowMs: 10 * 60 * 1000 }],
  ["/auth/accept-invite", { limit: 10, windowMs: 10 * 60 * 1000 }],
  ["/api/shares/:token", { limit: 120, windowMs: 60 * 1000 }],
  ["/api/shares/:token/stream", { limit: 120, windowMs: 60 * 1000 }],
  ["/api/tracks/:id/stream", { limit: 240, windowMs: 60 * 1000 }],
  ["/s/:token", { limit: 120, windowMs: 60 * 1000 }]
]);

const getClientAddress = (request: FastifyRequest): string =>
  request.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
  request.ip ||
  "unknown";

export const buildServer = (options: BuildServerOptions = {}): FastifyInstance => {
  const app = Fastify({
    logger: options.logger ?? true
  });
  const rateLimitBuckets = new Map<string, RateLimitBucket>();
  let storageReady = false;
  const dataDir = path.resolve(options.dataDir ?? config.DATA_DIR);
  const publicDir = path.resolve(options.publicDir ?? path.join(process.cwd(), "public"));
  const storageDriver = options.storageDriver ?? config.STORAGE_DRIVER;
  const store: AppStore =
    storageDriver === "postgres"
      ? new PgStore({
          uploadsBaseDir: dataDir,
          databaseUrl: options.databaseUrl ?? config.DATABASE_URL
        })
      : new FileStore(dataDir);

  const sanitizeUser = (user: User) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt
  });

  const requireOwner = async (request: AuthRequest, reply: FastifyReply): Promise<User | undefined> => {
    const user = request.authUser;
    if (!user) {
      return reply.unauthorized("Unauthorized");
    }
    if (user.role !== "owner") {
      return reply.forbidden("Owner role required");
    }
    return user;
  };

  const streamTrack = async (
    track: Track,
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<FastifyReply | void> => {
    const filePath = path.join(store.getUploadsDir(), track.filename);
    const stat = await fs.stat(filePath);
    const rangeHeader = request.headers.range;

    if (!rangeHeader) {
      reply.header("Content-Type", track.mimeType);
      reply.header("Content-Length", stat.size);
      return reply.send(createReadStream(filePath));
    }

    const bytesPrefix = "bytes=";
    if (!rangeHeader.startsWith(bytesPrefix)) {
      return reply.badRequest("Invalid range header");
    }

    const [startRaw, endRaw] = rangeHeader.slice(bytesPrefix.length).split("-");
    const start = Number.parseInt(startRaw, 10);
    const end = endRaw ? Number.parseInt(endRaw, 10) : stat.size - 1;

    if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= stat.size) {
      reply.header("Content-Range", `bytes */${stat.size}`);
      return reply.code(416).send("Requested range not satisfiable");
    }

    reply.code(206);
    reply.header("Accept-Ranges", "bytes");
    reply.header("Content-Range", `bytes ${start}-${end}/${stat.size}`);
    reply.header("Content-Length", end - start + 1);
    reply.header("Content-Type", track.mimeType);
    return reply.send(createReadStream(filePath, { start, end }));
  };

  app.register(sensible);
  app.register(cors, {
    origin: true
  });
  app.register(multipart, {
    limits: {
      fileSize: 100 * 1024 * 1024
    }
  });
  app.register(fastifyStatic, {
    root: publicDir,
    prefix: "/"
  });

  app.addHook("onReady", async () => {
    await store.init();
    storageReady = true;
  });

  app.addHook("preHandler", async (request, reply) => {
    const pattern = request.routeOptions.url ?? request.url;
    const publicRateLimit = publicRateLimits.get(pattern);
    if (publicRateLimit) {
      const bucketKey = `${pattern}:${getClientAddress(request)}`;
      const now = Date.now();
      const existing = rateLimitBuckets.get(bucketKey);
      if (!existing || existing.resetAt <= now) {
        rateLimitBuckets.set(bucketKey, {
          count: 1,
          resetAt: now + publicRateLimit.windowMs
        });
      } else if (existing.count >= publicRateLimit.limit) {
        reply.header("Retry-After", Math.ceil((existing.resetAt - now) / 1000));
        return reply.tooManyRequests("Rate limit exceeded");
      } else {
        existing.count += 1;
      }
    }

    if (!config.AUTH_REQUIRED) {
      return;
    }

    if (publicApiRoutes.has(pattern)) {
      return;
    }
    if (!pattern.startsWith("/api/") && !pattern.startsWith("/auth/")) {
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reply.unauthorized("Missing bearer token");
    }
    const token = authHeader.slice("Bearer ".length);
    const payload = verifyAccessToken(token);
    if (!payload) {
      return reply.unauthorized("Invalid access token");
    }
    const user = await store.getUserById(payload.userId);
    if (!user) {
      return reply.unauthorized("User not found");
    }
    (request as AuthRequest).authUser = user;
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "mymuse-server",
    env: config.NODE_ENV,
    timestamp: new Date().toISOString()
  }));

  app.get("/ready", async (request, reply) => {
    if (!storageReady) {
      return reply.code(503).send({
        status: "starting",
        storageReady: false
      });
    }

    try {
      await store.listTracks();
      return {
        status: "ready",
        storageReady: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      request.log?.error?.(error);
      return reply.code(503).send({
        status: "degraded",
        storageReady: false
      });
    }
  });

  app.get("/legal/disclaimer", async () => ({
    message: "MyMuse is a self-hosted tool. Users are responsible for legality of uploaded and shared content."
  }));

  app.post("/auth/register-owner", async (request, reply) => {
    const body = z
      .object({
        name: z.string().trim().min(2).max(120),
        email: z.string().trim().email(),
        password: z.string().min(8).max(128)
      })
      .parse(request.body);

    if (await store.ownerExists()) {
      return reply.conflict("Owner already registered");
    }
    if (await store.getUserByEmail(body.email)) {
      return reply.conflict("Email already in use");
    }

    const user = await store.createUser({
      name: body.name,
      email: body.email,
      role: "owner",
      passwordHash: hashPassword(body.password)
    });
    return reply.code(201).send({
      user: sanitizeUser(user),
      accessToken: createAccessToken(user)
    });
  });

  app.get("/auth/setup-state", async () => {
    return {
      ownerExists: await store.ownerExists(),
      authRequired: config.AUTH_REQUIRED
    };
  });

  app.post("/auth/login", async (request, reply) => {
    const body = z
      .object({
        email: z.string().trim().email(),
        password: z.string().min(8).max(128)
      })
      .parse(request.body);

    const user = await store.getUserByEmail(body.email);
    if (!user || !verifyPassword(body.password, user.passwordHash)) {
      return reply.unauthorized("Invalid credentials");
    }

    return {
      user: sanitizeUser(user),
      accessToken: createAccessToken(user)
    };
  });

  app.get("/auth/me", async (request, reply) => {
    const user = (request as AuthRequest).authUser;
    if (!user) {
      return reply.unauthorized("Unauthorized");
    }
    return { user: sanitizeUser(user) };
  });

  app.post("/auth/invites", async (request, reply) => {
    const owner = await requireOwner(request as AuthRequest, reply);
    if (!owner) {
      return;
    }

    const body = z
      .object({
        expiresInHours: z.number().positive().max(24 * 30).optional()
      })
      .parse(request.body);

    const invite = await store.createInvite({
      createdByUserId: owner.id,
      role: "user",
      expiresInHours: body.expiresInHours
    });
    return reply.code(201).send({
      invite,
      url: `${request.protocol}://${request.host}/invite/${invite.token}`
    });
  });

  app.post("/auth/accept-invite", async (request, reply) => {
    const body = z
      .object({
        token: z.string(),
        name: z.string().trim().min(2).max(120),
        email: z.string().trim().email(),
        password: z.string().min(8).max(128)
      })
      .parse(request.body);

    const invite = await store.getInvite(body.token);
    if (!invite) {
      return reply.notFound("Invite not found");
    }
    if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
      return reply.forbidden("Invite expired");
    }
    if (await store.getUserByEmail(body.email)) {
      return reply.conflict("Email already in use");
    }

    const user = await store.createUser({
      name: body.name,
      email: body.email,
      role: invite.role,
      passwordHash: hashPassword(body.password)
    });
    await store.consumeInvite(invite.token);
    return reply.code(201).send({
      user: sanitizeUser(user),
      accessToken: createAccessToken(user)
    });
  });

  app.get("/api/tracks", async () => ({
    tracks: await store.listTracks()
  }));

  app.get("/api/stats", async () => {
    const [tracks, playlists, shares] = await Promise.all([
      store.listTracks(),
      store.listPlaylists(),
      store.listShares()
    ]);
    return {
      stats: {
        tracks: tracks.length,
        playlists: playlists.length,
        shares: shares.length,
        totalBytes: tracks.reduce((sum, track) => sum + track.size, 0)
      }
    };
  });

  app.post("/api/tracks/upload", async (request, reply) => {
    const file = await request.file();
    if (!file) {
      return reply.badRequest("No file uploaded");
    }
    const filename = createSafeFilename(file.filename);
    const destination = path.join(store.getUploadsDir(), filename);
    await pipeline(file.file, createWriteStream(destination));
    const stat = await fs.stat(destination);
    const metadata = inferTrackMetadata(file.filename);

    const track = await store.addTrack({
      title: metadata.title,
      artist: metadata.artist,
      album: metadata.album,
      filename,
      mimeType: file.mimetype || "audio/mpeg",
      size: stat.size
    });
    return reply.code(201).send({ track });
  });

  app.get("/api/tracks/:id/stream", async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const track = await store.getTrack(params.id);
    if (!track) {
      return reply.notFound("Track not found");
    }
    return streamTrack(track, request, reply);
  });

  app.patch("/api/tracks/:id", async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = z
      .object({
        title: z.string().trim().min(1).max(200).optional(),
        artist: z.string().trim().min(1).max(200).optional(),
        album: z.string().trim().min(1).max(200).optional()
      })
      .refine((value) => Object.keys(value).length > 0, "No fields to update")
      .parse(request.body);

    const track = await store.updateTrack(params.id, body);
    if (!track) {
      return reply.notFound("Track not found");
    }
    return { track };
  });

  app.delete("/api/tracks/:id", async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const removed = await store.deleteTrack(params.id);
    if (!removed) {
      return reply.notFound("Track not found");
    }
    await fs.rm(path.join(store.getUploadsDir(), removed.filename), { force: true });
    return reply.code(204).send();
  });

  app.get("/api/playlists", async () => {
    const [playlists, tracks] = await Promise.all([store.listPlaylists(), store.listTracks()]);
    const trackMap = new Map(tracks.map((track) => [track.id, track]));
    return {
      playlists: playlists.map((playlist) => ({
        ...playlist,
        tracks: playlist.trackIds.map((id) => trackMap.get(id)).filter(Boolean)
      }))
    };
  });

  app.post("/api/playlists", async (request, reply) => {
    const body = z.object({ name: z.string().trim().min(1).max(120) }).parse(request.body);
    const playlist = await store.createPlaylist(body.name);
    return reply.code(201).send({ playlist });
  });

  app.post("/api/playlists/:id/tracks", async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({ trackId: z.string() }).parse(request.body);
    const track = await store.getTrack(body.trackId);
    if (!track) {
      return reply.notFound("Track not found");
    }
    const playlist = await store.addTrackToPlaylist(params.id, body.trackId);
    if (!playlist) {
      return reply.notFound("Playlist not found");
    }
    return { playlist };
  });

  app.delete("/api/playlists/:id/tracks/:trackId", async (request, reply) => {
    const params = z.object({ id: z.string(), trackId: z.string() }).parse(request.params);
    const playlist = await store.removeTrackFromPlaylist(params.id, params.trackId);
    if (!playlist) {
      return reply.notFound("Playlist not found");
    }
    return { playlist };
  });

  app.post("/api/shares", async (request, reply) => {
    const body = z
      .object({
        type: z.enum(["track", "playlist"]),
        targetId: z.string(),
        expiresInHours: z.number().positive().max(24 * 30).optional()
      })
      .parse(request.body);

    if (body.type === "track") {
      if (!(await store.getTrack(body.targetId))) {
        return reply.notFound("Track not found");
      }
    }
    if (body.type === "playlist") {
      const playlists = await store.listPlaylists();
      if (!playlists.some((playlist) => playlist.id === body.targetId)) {
        return reply.notFound("Playlist not found");
      }
    }

    const share = await store.createShare(body.type, body.targetId, body.expiresInHours);
    return reply.code(201).send({
      share,
      url: `${request.protocol}://${request.host}/s/${share.token}`
    });
  });

  app.get("/api/shares", async (request) => {
    const shares = await store.listShares();
    return {
      shares: shares.map((share) => ({
        ...share,
        url: `${request.protocol}://${request.host}/s/${share.token}`
      }))
    };
  });

  app.get("/api/shares/:token", async (request, reply) => {
    const params = z.object({ token: z.string() }).parse(request.params);
    const share = await store.getShare(params.token);
    if (!share) {
      return reply.notFound("Share not found");
    }
    if (share.expiresAt && new Date(share.expiresAt).getTime() < Date.now()) {
      return reply.forbidden("Share link expired");
    }

    if (share.type === "track") {
      const track = await store.getTrack(share.targetId);
      if (!track) {
        return reply.notFound("Track not found");
      }
      return { share, track };
    }

    const [playlists, tracks] = await Promise.all([store.listPlaylists(), store.listTracks()]);
    const playlist = playlists.find((item) => item.id === share.targetId);
    if (!playlist) {
      return reply.notFound("Playlist not found");
    }
    const trackMap = new Map(tracks.map((track) => [track.id, track]));
    return {
      share,
      playlist: {
        ...playlist,
        tracks: playlist.trackIds.map((id) => trackMap.get(id)).filter(Boolean)
      }
    };
  });

  app.get("/api/shares/:token/stream", async (request, reply) => {
    const params = z.object({ token: z.string() }).parse(request.params);
    const share = await store.getShare(params.token);
    if (!share) {
      return reply.notFound("Share not found");
    }
    if (share.expiresAt && new Date(share.expiresAt).getTime() < Date.now()) {
      return reply.forbidden("Share link expired");
    }
    if (share.type !== "track") {
      return reply.badRequest("Share stream is available only for track links");
    }
    const track = await store.getTrack(share.targetId);
    if (!track) {
      return reply.notFound("Track not found");
    }
    return streamTrack(track, request, reply);
  });

  app.delete("/api/shares/:token", async (request, reply) => {
    const params = z.object({ token: z.string() }).parse(request.params);
    const deleted = await store.revokeShare(params.token);
    if (!deleted) {
      return reply.notFound("Share not found");
    }
    return reply.code(204).send();
  });

  app.get("/s/:token", async (request, reply) => {
    const params = z.object({ token: z.string() }).parse(request.params);
    const share = await store.getShare(params.token);
    if (!share) {
      return reply.notFound("Share not found");
    }
    if (share.expiresAt && new Date(share.expiresAt).getTime() < Date.now()) {
      return reply.forbidden("Share link expired");
    }
    return reply.sendFile("index.html");
  });

  app.get("/invite/:token", async (_request, reply) => reply.sendFile("index.html"));
  app.get("/", async (_request, reply) => reply.sendFile("index.html"));

  return app;
};
