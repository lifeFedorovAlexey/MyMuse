import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import type { Invite, Playlist, Share, ShareType, Track, User, UserRole } from "./types.js";
import type { AppStore } from "./store.contract.js";

const toIso = (value: string | Date): string => new Date(value).toISOString();

export class PgStore implements AppStore {
  private readonly uploadsDir: string;
  private readonly pool: Pool;

  constructor(options: { uploadsBaseDir: string; databaseUrl: string }) {
    this.uploadsDir = path.join(options.uploadsBaseDir, "uploads");
    this.pool = new Pool({
      connectionString: options.databaseUrl
    });
  }

  public async init(): Promise<void> {
    await fs.mkdir(this.uploadsDir, { recursive: true });
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS invites (
        token TEXT PRIMARY KEY,
        role TEXT NOT NULL,
        created_by_user_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NULL
      );

      CREATE TABLE IF NOT EXISTS tracks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        album TEXT NOT NULL,
        filename TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes BIGINT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS playlists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS playlist_tracks (
        playlist_id TEXT NOT NULL,
        track_id TEXT NOT NULL,
        PRIMARY KEY (playlist_id, track_id)
      );

      CREATE TABLE IF NOT EXISTS shares (
        token TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NULL
      );
    `);
  }

  public getUploadsDir(): string {
    return this.uploadsDir;
  }

  public async listUsers(): Promise<User[]> {
    const result = await this.pool.query(
      "SELECT id, name, email, role, password_hash, created_at FROM users ORDER BY created_at DESC"
    );
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role as UserRole,
      passwordHash: row.password_hash,
      createdAt: toIso(row.created_at)
    }));
  }

  public async getUserById(userId: string): Promise<User | undefined> {
    const result = await this.pool.query(
      "SELECT id, name, email, role, password_hash, created_at FROM users WHERE id=$1 LIMIT 1",
      [userId]
    );
    const row = result.rows[0];
    if (!row) {
      return undefined;
    }
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role as UserRole,
      passwordHash: row.password_hash,
      createdAt: toIso(row.created_at)
    };
  }

  public async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await this.pool.query(
      "SELECT id, name, email, role, password_hash, created_at FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1",
      [email]
    );
    const row = result.rows[0];
    if (!row) {
      return undefined;
    }
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role as UserRole,
      passwordHash: row.password_hash,
      createdAt: toIso(row.created_at)
    };
  }

  public async ownerExists(): Promise<boolean> {
    const result = await this.pool.query("SELECT 1 FROM users WHERE role='owner' LIMIT 1");
    return (result.rowCount ?? 0) > 0;
  }

  public async createUser(input: {
    name: string;
    email: string;
    role: UserRole;
    passwordHash: string;
  }): Promise<User> {
    const id = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO users (id, name, email, role, password_hash)
       VALUES ($1, $2, LOWER($3), $4, $5)
       RETURNING id, name, email, role, password_hash, created_at`,
      [id, input.name, input.email, input.role, input.passwordHash]
    );
    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role as UserRole,
      passwordHash: row.password_hash,
      createdAt: toIso(row.created_at)
    };
  }

  public async createInvite(input: {
    createdByUserId: string;
    role: Exclude<UserRole, "owner">;
    expiresInHours?: number;
  }): Promise<Invite> {
    const token = randomUUID();
    const expiresAt =
      typeof input.expiresInHours === "number" && input.expiresInHours > 0
        ? new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000).toISOString()
        : null;
    const result = await this.pool.query(
      `INSERT INTO invites (token, role, created_by_user_id, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING token, role, created_by_user_id, created_at, expires_at`,
      [token, input.role, input.createdByUserId, expiresAt]
    );
    const row = result.rows[0];
    return {
      token: row.token,
      role: row.role,
      createdByUserId: row.created_by_user_id,
      createdAt: toIso(row.created_at),
      expiresAt: row.expires_at ? toIso(row.expires_at) : null
    };
  }

  public async getInvite(token: string): Promise<Invite | undefined> {
    const result = await this.pool.query(
      `SELECT token, role, created_by_user_id, created_at, expires_at
       FROM invites WHERE token=$1 LIMIT 1`,
      [token]
    );
    const row = result.rows[0];
    if (!row) {
      return undefined;
    }
    return {
      token: row.token,
      role: row.role,
      createdByUserId: row.created_by_user_id,
      createdAt: toIso(row.created_at),
      expiresAt: row.expires_at ? toIso(row.expires_at) : null
    };
  }

  public async consumeInvite(token: string): Promise<boolean> {
    const result = await this.pool.query("DELETE FROM invites WHERE token=$1", [token]);
    return (result.rowCount ?? 0) > 0;
  }

  public async listTracks(): Promise<Track[]> {
    const result = await this.pool.query(
      `SELECT id, title, artist, album, filename, mime_type, size_bytes, created_at
       FROM tracks ORDER BY created_at DESC`
    );
    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      artist: row.artist,
      album: row.album,
      filename: row.filename,
      mimeType: row.mime_type,
      size: Number(row.size_bytes),
      createdAt: toIso(row.created_at)
    }));
  }

  public async getTrack(trackId: string): Promise<Track | undefined> {
    const result = await this.pool.query(
      `SELECT id, title, artist, album, filename, mime_type, size_bytes, created_at
       FROM tracks WHERE id=$1 LIMIT 1`,
      [trackId]
    );
    const row = result.rows[0];
    if (!row) {
      return undefined;
    }
    return {
      id: row.id,
      title: row.title,
      artist: row.artist,
      album: row.album,
      filename: row.filename,
      mimeType: row.mime_type,
      size: Number(row.size_bytes),
      createdAt: toIso(row.created_at)
    };
  }

  public async addTrack(input: Omit<Track, "id" | "createdAt">): Promise<Track> {
    const id = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO tracks (id, title, artist, album, filename, mime_type, size_bytes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, title, artist, album, filename, mime_type, size_bytes, created_at`,
      [id, input.title, input.artist, input.album, input.filename, input.mimeType, input.size]
    );
    const row = result.rows[0];
    return {
      id: row.id,
      title: row.title,
      artist: row.artist,
      album: row.album,
      filename: row.filename,
      mimeType: row.mime_type,
      size: Number(row.size_bytes),
      createdAt: toIso(row.created_at)
    };
  }

  public async updateTrack(
    trackId: string,
    patch: Partial<Pick<Track, "title" | "artist" | "album">>
  ): Promise<Track | undefined> {
    await this.pool.query(
      `UPDATE tracks
       SET title = COALESCE($2, title),
           artist = COALESCE($3, artist),
           album = COALESCE($4, album)
       WHERE id=$1`,
      [trackId, patch.title ?? null, patch.artist ?? null, patch.album ?? null]
    );
    return this.getTrack(trackId);
  }

  public async deleteTrack(trackId: string): Promise<Track | undefined> {
    const track = await this.getTrack(trackId);
    if (!track) {
      return undefined;
    }
    await this.pool.query("DELETE FROM playlist_tracks WHERE track_id=$1", [trackId]);
    await this.pool.query("DELETE FROM shares WHERE type='track' AND target_id=$1", [trackId]);
    await this.pool.query("DELETE FROM tracks WHERE id=$1", [trackId]);
    return track;
  }

  public async listPlaylists(): Promise<Playlist[]> {
    const [playlistsResult, tracksResult] = await Promise.all([
      this.pool.query("SELECT id, name, created_at FROM playlists ORDER BY created_at DESC"),
      this.pool.query("SELECT playlist_id, track_id FROM playlist_tracks")
    ]);
    const tracksMap = new Map<string, string[]>();
    for (const row of tracksResult.rows) {
      const arr = tracksMap.get(row.playlist_id) ?? [];
      arr.push(row.track_id);
      tracksMap.set(row.playlist_id, arr);
    }
    return playlistsResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      trackIds: tracksMap.get(row.id) ?? [],
      createdAt: toIso(row.created_at)
    }));
  }

  public async createPlaylist(name: string): Promise<Playlist> {
    const id = randomUUID();
    const result = await this.pool.query(
      "INSERT INTO playlists (id, name) VALUES ($1, $2) RETURNING id, name, created_at",
      [id, name]
    );
    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      trackIds: [],
      createdAt: toIso(row.created_at)
    };
  }

  public async addTrackToPlaylist(playlistId: string, trackId: string): Promise<Playlist | undefined> {
    const exists = await this.pool.query("SELECT id FROM playlists WHERE id=$1", [playlistId]);
    if ((exists.rowCount ?? 0) === 0) {
      return undefined;
    }
    await this.pool.query(
      "INSERT INTO playlist_tracks (playlist_id, track_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [playlistId, trackId]
    );
    const playlists = await this.listPlaylists();
    return playlists.find((playlist) => playlist.id === playlistId);
  }

  public async removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<Playlist | undefined> {
    const exists = await this.pool.query("SELECT id FROM playlists WHERE id=$1", [playlistId]);
    if ((exists.rowCount ?? 0) === 0) {
      return undefined;
    }
    await this.pool.query("DELETE FROM playlist_tracks WHERE playlist_id=$1 AND track_id=$2", [
      playlistId,
      trackId
    ]);
    const playlists = await this.listPlaylists();
    return playlists.find((playlist) => playlist.id === playlistId);
  }

  public async createShare(type: ShareType, targetId: string, expiresInHours?: number): Promise<Share> {
    const token = randomUUID();
    const expiresAt =
      typeof expiresInHours === "number" && expiresInHours > 0
        ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString()
        : null;
    const result = await this.pool.query(
      `INSERT INTO shares (token, type, target_id, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING token, type, target_id, created_at, expires_at`,
      [token, type, targetId, expiresAt]
    );
    const row = result.rows[0];
    return {
      token: row.token,
      type: row.type as ShareType,
      targetId: row.target_id,
      createdAt: toIso(row.created_at),
      expiresAt: row.expires_at ? toIso(row.expires_at) : null
    };
  }

  public async getShare(token: string): Promise<Share | undefined> {
    const result = await this.pool.query(
      "SELECT token, type, target_id, created_at, expires_at FROM shares WHERE token=$1 LIMIT 1",
      [token]
    );
    const row = result.rows[0];
    if (!row) {
      return undefined;
    }
    return {
      token: row.token,
      type: row.type as ShareType,
      targetId: row.target_id,
      createdAt: toIso(row.created_at),
      expiresAt: row.expires_at ? toIso(row.expires_at) : null
    };
  }

  public async listShares(): Promise<Share[]> {
    const result = await this.pool.query(
      "SELECT token, type, target_id, created_at, expires_at FROM shares ORDER BY created_at DESC"
    );
    return result.rows.map((row) => ({
      token: row.token,
      type: row.type as ShareType,
      targetId: row.target_id,
      createdAt: toIso(row.created_at),
      expiresAt: row.expires_at ? toIso(row.expires_at) : null
    }));
  }

  public async revokeShare(token: string): Promise<boolean> {
    const result = await this.pool.query("DELETE FROM shares WHERE token=$1", [token]);
    return (result.rowCount ?? 0) > 0;
  }
}
