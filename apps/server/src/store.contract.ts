import type { Invite, Playlist, Share, ShareType, Track, User, UserRole } from "./types.js";

export type AppStore = {
  init(): Promise<void>;
  getUploadsDir(): string;

  listUsers(): Promise<User[]>;
  getUserById(userId: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  ownerExists(): Promise<boolean>;
  createUser(input: { name: string; email: string; role: UserRole; passwordHash: string }): Promise<User>;

  createInvite(input: {
    createdByUserId: string;
    role: Exclude<UserRole, "owner">;
    expiresInHours?: number;
  }): Promise<Invite>;
  getInvite(token: string): Promise<Invite | undefined>;
  consumeInvite(token: string): Promise<boolean>;

  listTracks(): Promise<Track[]>;
  getTrack(trackId: string): Promise<Track | undefined>;
  addTrack(input: Omit<Track, "id" | "createdAt">): Promise<Track>;
  updateTrack(trackId: string, patch: Partial<Pick<Track, "title" | "artist" | "album">>): Promise<Track | undefined>;
  deleteTrack(trackId: string): Promise<Track | undefined>;

  listPlaylists(): Promise<Playlist[]>;
  createPlaylist(name: string): Promise<Playlist>;
  addTrackToPlaylist(playlistId: string, trackId: string): Promise<Playlist | undefined>;
  removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<Playlist | undefined>;

  createShare(type: ShareType, targetId: string, expiresInHours?: number): Promise<Share>;
  getShare(token: string): Promise<Share | undefined>;
  listShares(): Promise<Share[]>;
  revokeShare(token: string): Promise<boolean>;
};
