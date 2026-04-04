# F-0007 Authentication (Owner + Invite)

## 1. Meta

- Feature ID: `F-0007`
- Title: Owner authentication and invite-based onboarding
- Author: MyMuse Team
- Status: approved
- Related epic: Auth and Access
- Target release: Demo+

## 2. Business Goal

Protect private library endpoints and support secure onboarding to self-hosted instance.

## 5. Functional Requirements

- `FR-1`: Register first owner account.
- `FR-2`: Login with email/password returns access token.
- `FR-3`: Private API requires bearer token.
- `FR-4`: Owner can create invite token.
- `FR-5`: Invite can be accepted to create regular user.

## 11. Acceptance Criteria

- `AC-1`: Owner registration and login succeed with valid credentials.
- `AC-2`: Private endpoint without token returns `401`.
- `AC-3`: Invite flow creates user with role `user`.

## 12. Test Plan (Mandatory)

- `TC-1` integration: register owner and login (`AC-1`).
- `TC-2` contract: unauthorized access to private endpoint (`AC-2`).
- `TC-3` integration: create and accept invite (`AC-3`).
