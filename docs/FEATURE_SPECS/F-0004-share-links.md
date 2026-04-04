# F-0004 Share Links for Track/Playlist

## 1. Meta

- Feature ID: `F-0004`
- Title: Generate and resolve share links
- Author: MyMuse Team
- Status: approved
- Related epic: Sharing
- Target release: Demo MVP

## 2. Business Goal

Allow controlled sharing of tracks/playlists using tokenized links.

## 3. In Scope

- Create share token for track/playlist.
- Optional TTL.
- Resolve share content by token.
- Public share page route.

## 4. Out of Scope

- Fine-grained ACL per recipient.
- One-time links.
- Revocation UI.

## 5. Functional Requirements

- `FR-1`: Share token can be created for valid target.
- `FR-2`: Share response includes absolute URL.
- `FR-3`: Expired token is rejected.
- `FR-4`: Unknown token returns `404`.

## 6. Non-Functional Requirements

- `NFR-1` Token must be non-guessable.
- `NFR-2` Resolve endpoint must be read-only.

## 7. Architecture Design

Interface:
- `POST /api/shares`
- `GET /api/shares/:token`
- `GET /s/:token`

## 11. Acceptance Criteria

- `AC-1`: Valid share token returns linked entity.
- `AC-2`: Expired share returns forbidden.
- `AC-3`: Public share page returns HTTP 200 for valid token.

## 12. Test Plan (Mandatory)

- `TC-1` integration: create and resolve track share (`AC-1`).
- `TC-2` integration: create short TTL share and verify expiry (`AC-2`).
- `TC-3` contract: `GET /s/:token` returns `200` for valid token (`AC-3`).
