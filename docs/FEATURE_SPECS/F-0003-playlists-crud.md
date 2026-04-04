# F-0003 Playlists CRUD (MVP Scope)

## 1. Meta

- Feature ID: `F-0003`
- Title: Create playlists and attach tracks
- Author: MyMuse Team
- Status: approved
- Related epic: MVP Core
- Target release: Demo MVP

## 2. Business Goal

Allow users to organize tracks into curated collections.

## 3. In Scope

- Create playlist.
- List playlists with embedded track info.
- Add track to playlist.

## 4. Out of Scope

- Reorder tracks.
- Remove track from playlist.
- Playlist permissions model.

## 5. Functional Requirements

- `FR-1`: Playlist can be created with non-empty name.
- `FR-2`: Playlist list returns assigned tracks.
- `FR-3`: Track can be attached to existing playlist.
- `FR-4`: Duplicate track attach is idempotent (no duplicates).

## 6. Non-Functional Requirements

- `NFR-1` API validation for input payloads.
- `NFR-2` Deterministic error codes for missing track/playlist.

## 7. Architecture Design

Domain:
- Playlist aggregate with `trackIds`.

Interface:
- `GET /api/playlists`
- `POST /api/playlists`
- `POST /api/playlists/:id/tracks`

## 11. Acceptance Criteria

- `AC-1`: Create playlist returns `201` and playlist id.
- `AC-2`: Add track returns updated playlist.
- `AC-3`: Adding non-existing track returns `404`.

## 12. Test Plan (Mandatory)

- `TC-1` contract: create playlist with valid name -> `201` (`AC-1`).
- `TC-2` integration: add existing track -> playlist contains track (`AC-2`).
- `TC-3` contract: add missing track -> `404` (`AC-3`).
