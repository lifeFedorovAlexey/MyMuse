# F-0006 Share Manager

## 1. Meta

- Feature ID: `F-0006`
- Title: List and revoke share links
- Author: MyMuse Team
- Status: approved
- Related epic: Sharing
- Target release: Demo+

## 2. Business Goal

Give instance owners control over public links lifecycle.

## 5. Functional Requirements

- `FR-1`: List all active shares with generated URL.
- `FR-2`: Revoke share by token.
- `FR-3`: Revoked share cannot be resolved anymore.

## 11. Acceptance Criteria

- `AC-1`: Active shares are visible via API list endpoint.
- `AC-2`: Revocation endpoint returns `204` for existing token.
- `AC-3`: Revoked token resolves as `404`.

## 12. Test Plan (Mandatory)

- `TC-1` integration: create share and list it (`AC-1`).
- `TC-2` integration: revoke share and validate status (`AC-2`).
- `TC-3` contract: revoked share resolve returns `404` (`AC-3`).
