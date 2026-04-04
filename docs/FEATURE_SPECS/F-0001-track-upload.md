# F-0001 Track Upload

## 1. Meta

- Feature ID: `F-0001`
- Title: Upload local audio track to self-hosted library
- Author: MyMuse Team
- Status: approved
- Related epic: MVP Core
- Target release: Demo MVP

## 2. Business Goal

Allow the instance owner/user to add local audio files into personal library.

## 3. In Scope

- Multipart file upload endpoint.
- Persist file in storage adapter.
- Persist metadata record in library store.

## 4. Out of Scope

- Advanced metadata extraction (ID3 parse).
- Duplicate detection and dedup policy.

## 5. Functional Requirements

- `FR-1`: API accepts multipart field `track`.
- `FR-2`: File is stored with generated safe filename.
- `FR-3`: Track metadata entry is created with id and timestamps.
- `FR-4`: Upload rejects empty request without file.

## 6. Non-Functional Requirements

- `NFR-1` Max file size limit enforced.
- `NFR-2` Path traversal is impossible.
- `NFR-3` Upload error returns deterministic status/message.

## 7. Architecture Design

Domain:
- Track entity fields.

Application:
- Upload use-case orchestration.

Infrastructure:
- File storage write.
- Metadata persistence.

Interface:
- HTTP endpoint `POST /api/tracks/upload`.

## 8. API Contract

- Endpoint: `/api/tracks/upload`
- Method: `POST`
- Request: `multipart/form-data`
- Response `201`: `{ track: {...} }`
- Errors: `400` if file missing, `413` if too large.

## 11. Acceptance Criteria

- `AC-1`: Valid audio file creates a track record.
- `AC-2`: Uploaded file physically exists in upload storage.
- `AC-3`: Missing file returns 400.

## 12. Test Plan (Mandatory)

- `TC-1` integration: upload valid file -> 201 and track id returned (covers `AC-1`).
- `TC-2` integration: upload valid file -> file exists on disk (covers `AC-2`).
- `TC-3` contract: upload without file -> 400 (covers `AC-3`).
