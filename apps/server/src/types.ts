export type Track = {
  id: string;
  title: string;
  artist: string;
  album: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

export type Playlist = {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: string;
};

export type ShareType = "track" | "playlist";
export type UserRole = "owner" | "user";

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  passwordHash: string;
  createdAt: string;
};

export type Invite = {
  token: string;
  role: Exclude<UserRole, "owner">;
  createdByUserId: string;
  createdAt: string;
  expiresAt: string | null;
};

export type Share = {
  token: string;
  type: ShareType;
  targetId: string;
  createdAt: string;
  expiresAt: string | null;
};

export type DbShape = {
  users: User[];
  invites: Invite[];
  tracks: Track[];
  playlists: Playlist[];
  shares: Share[];
};
