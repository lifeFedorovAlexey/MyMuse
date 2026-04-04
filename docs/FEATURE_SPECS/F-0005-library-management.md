# F-0005 Library Management

## 1. Meta

- Feature ID: `F-0005`
- Title: Manage track metadata and deletion lifecycle
- Author: MyMuse Team
- Status: approved
- Related epic: MVP Core
- Target release: Demo+

## 2. Business Goal

Let users maintain clean library data and remove unwanted content.

## 5. Functional Requirements

- `FR-1`: Update track metadata (title, artist, album).
- `FR-2`: Delete track from library and storage.
- `FR-3`: Remove track from a playlist.
- `FR-4`: Keep playlist integrity after track delete.

## 11. Acceptance Criteria

- `AC-1`: Track metadata update is persisted.
- `AC-2`: Track deletion returns `204` and track disappears from library.
- `AC-3`: Removing track from playlist updates `trackIds`.

## 12. Test Plan (Mandatory)

- `TC-1` integration: patch metadata and verify response (`AC-1`).
- `TC-2` integration: delete track and verify library list (`AC-2`).
- `TC-3` integration: remove playlist item via delete endpoint (`AC-3`).
