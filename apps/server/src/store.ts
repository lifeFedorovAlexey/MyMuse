import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { DbShape, Invite, Playlist, Share, ShareType, Track, User, UserRole } from "./types.js";
import type { AppStore } from "./store.contract.js";

const initialDb: DbShape = {
  users: [],
  invites: [],
  tracks: [],
  playlists: [],
  shares: []
};

export class FileStore implements AppStore {
  private readonly dbFile: string;
  private readonly uploadsDir: string;

  constructor(private readonly baseDir: string) {
    this.dbFile = path.join(baseDir, "db.json");
    this.uploadsDir = path.join(baseDir, "uploads");
  }

  public async init(): Promise<void> {
    await fs.mkdir(this.baseDir, { recursive: true });
    await fs.mkdir(this.uploadsDir, { recursive: true });
    try {
      await fs.access(this.dbFile);
    } catch {
      await this.writeDb(initialDb);
    }
  }

  public getUploadsDir(): string {
    return this.uploadsDir;
  }

  public async listTracks(): Promise<Track[]> {
    const db = await this.readDb();
    return db.tracks;
  }

  public async listUsers(): Promise<User[]> {
    const db = await this.readDb();
    return db.users;
  }

  public async getUserById(userId: string): Promise<User | undefined> {
    const users = await this.listUsers();
    return users.find((user) => user.id === userId);
  }

  public async getUserByEmail(email: string): Promise<User | undefined> {
    const users = await this.listUsers();
    return users.find((user) => user.email.toLowerCase() === email.toLowerCase());
  }

  public async ownerExists(): Promise<boolean> {
    const users = await this.listUsers();
    return users.some((user) => user.role === "owner");
  }

  public async createUser(input: {
    name: string;
    email: string;
    role: UserRole;
    passwordHash: string;
  }): Promise<User> {
    const db = await this.readDb();
    const user: User = {
      id: randomUUID(),
      name: input.name,
      email: input.email.toLowerCase(),
      role: input.role,
      passwordHash: input.passwordHash,
      createdAt: new Date().toISOString()
    };
    db.users.unshift(user);
    await this.writeDb(db);
    return user;
  }

  public async createInvite(input: {
    createdByUserId: string;
    role: Exclude<UserRole, "owner">;
    expiresInHours?: number;
  }): Promise<Invite> {
    const db = await this.readDb();
    const now = new Date();
    const expiresAt =
      typeof input.expiresInHours === "number" && input.expiresInHours > 0
        ? new Date(now.getTime() + input.expiresInHours * 60 * 60 * 1000).toISOString()
        : null;

    const invite: Invite = {
      token: randomUUID(),
      role: input.role,
      createdByUserId: input.createdByUserId,
      createdAt: now.toISOString(),
      expiresAt
    };
    db.invites.unshift(invite);
    await this.writeDb(db);
    return invite;
  }

  public async getInvite(token: string): Promise<Invite | undefined> {
    const db = await this.readDb();
    return db.invites.find((invite) => invite.token === token);
  }

  public async consumeInvite(token: string): Promise<boolean> {
    const db = await this.readDb();
    const before = db.invites.length;
    db.invites = db.invites.filter((invite) => invite.token !== token);
    const changed = db.invites.length !== before;
    if (changed) {
      await this.writeDb(db);
    }
    return changed;
  }

  public async getTrack(trackId: string): Promise<Track | undefined> {
    const tracks = await this.listTracks();
    return tracks.find((track) => track.id === trackId);
  }

  public async addTrack(input: Omit<Track, "id" | "createdAt">): Promise<Track> {
    const db = await this.readDb();
    const track: Track = {
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString()
    };
    db.tracks.unshift(track);
    await this.writeDb(db);
    return track;
  }

  public async updateTrack(
    trackId: string,
    patch: Partial<Pick<Track, "title" | "artist" | "album">>
  ): Promise<Track | undefined> {
    const db = await this.readDb();
    const track = db.tracks.find((item) => item.id === trackId);
    if (!track) {
      return undefined;
    }

    if (typeof patch.title === "string") {
      track.title = patch.title;
    }
    if (typeof patch.artist === "string") {
      track.artist = patch.artist;
    }
    if (typeof patch.album === "string") {
      track.album = patch.album;
    }

    await this.writeDb(db);
    return track;
  }

  public async deleteTrack(trackId: string): Promise<Track | undefined> {
    const db = await this.readDb();
    const index = db.tracks.findIndex((track) => track.id === trackId);
    if (index === -1) {
      return undefined;
    }

    const [removed] = db.tracks.splice(index, 1);
    for (const playlist of db.playlists) {
      playlist.trackIds = playlist.trackIds.filter((id) => id !== trackId);
    }
    db.shares = db.shares.filter((share) => !(share.type === "track" && share.targetId === trackId));
    await this.writeDb(db);
    return removed;
  }

  public async listPlaylists(): Promise<Playlist[]> {
    const db = await this.readDb();
    return db.playlists;
  }

  public async createPlaylist(name: string): Promise<Playlist> {
    const db = await this.readDb();
    const playlist: Playlist = {
      id: randomUUID(),
      name,
      trackIds: [],
      createdAt: new Date().toISOString()
    };
    db.playlists.unshift(playlist);
    await this.writeDb(db);
    return playlist;
  }

  public async addTrackToPlaylist(playlistId: string, trackId: string): Promise<Playlist | undefined> {
    const db = await this.readDb();
    const playlist = db.playlists.find((item) => item.id === playlistId);
    if (!playlist) {
      return undefined;
    }

    if (!playlist.trackIds.includes(trackId)) {
      playlist.trackIds.push(trackId);
    }
    await this.writeDb(db);
    return playlist;
  }

  public async removeTrackFromPlaylist(
    playlistId: string,
    trackId: string
  ): Promise<Playlist | undefined> {
    const db = await this.readDb();
    const playlist = db.playlists.find((item) => item.id === playlistId);
    if (!playlist) {
      return undefined;
    }
    playlist.trackIds = playlist.trackIds.filter((id) => id !== trackId);
    await this.writeDb(db);
    return playlist;
  }

  public async createShare(type: ShareType, targetId: string, expiresInHours?: number): Promise<Share> {
    const db = await this.readDb();
    const now = new Date();
    const expiresAt =
      typeof expiresInHours === "number" && expiresInHours > 0
        ? new Date(now.getTime() + expiresInHours * 60 * 60 * 1000).toISOString()
        : null;

    const share: Share = {
      token: randomUUID(),
      type,
      targetId,
      createdAt: now.toISOString(),
      expiresAt
    };
    db.shares.unshift(share);
    await this.writeDb(db);
    return share;
  }

  public async getShare(token: string): Promise<Share | undefined> {
    const db = await this.readDb();
    return db.shares.find((share) => share.token === token);
  }

  public async listShares(): Promise<Share[]> {
    const db = await this.readDb();
    return db.shares;
  }

  public async revokeShare(token: string): Promise<boolean> {
    const db = await this.readDb();
    const before = db.shares.length;
    db.shares = db.shares.filter((share) => share.token !== token);
    const changed = db.shares.length !== before;
    if (changed) {
      await this.writeDb(db);
    }
    return changed;
  }

  private async readDb(): Promise<DbShape> {
    const raw = await fs.readFile(this.dbFile, "utf-8");
    const parsed = JSON.parse(raw) as Partial<DbShape>;
    return {
      users: parsed.users ?? [],
      invites: parsed.invites ?? [],
      tracks: parsed.tracks ?? [],
      playlists: parsed.playlists ?? [],
      shares: parsed.shares ?? []
    };
  }

  private async writeDb(db: DbShape): Promise<void> {
    await fs.writeFile(this.dbFile, `${JSON.stringify(db, null, 2)}\n`, "utf-8");
  }
}
