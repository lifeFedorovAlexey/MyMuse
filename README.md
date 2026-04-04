# MyMuse Demo

Self-hosted demo music service:

- users store music on their own infrastructure;
- tracks can be streamed online;
- playlists are supported;
- share links can be generated for tracks/playlists;
- built-in web UI is available for quick demo usage.

## Content Responsibility

Users are fully responsible for legality of uploaded and shared content.
MyMuse provides tooling, not licensed music catalog distribution.

## Project Structure

- `docs/PRODUCT_PLAN.md` - product plan.
- `docs/ARCHITECTURE.md` - architecture overview.
- `docs/LEGAL_CONTENT_POLICY.md` - legal boundaries and policy.
- `docs/MVP_BACKLOG.md` - backlog roadmap.
- `docs/TECHNICAL_REQUIREMENTS.md` - mandatory engineering standards.
- `docs/FEATURE_SPECS/` - one detailed TZ per feature.
- `docs/TEST_TRACEABILITY.md` - acceptance criteria to tests mapping.
- `apps/server` - backend and embedded web demo.

## Run Demo

```bash
npm install
npm run dev:server
```

Open:

- `http://localhost:8080` - demo UI
- `http://localhost:8080/health` - healthcheck

First run:

1. Register owner account in UI.
2. Login with created credentials.
3. Start managing library.

## Run Tests

```bash
npm run test:server
```

## Implemented in Demo

- track upload to local storage;
- track library listing;
- HTTP range-based streaming;
- playlist creation;
- adding tracks to playlists;
- share link generation and public share page.
- track metadata editing and deletion.
- remove track from playlist.
- active share listing and share revocation.
- owner authentication, invite creation and invite acceptance API.

## Local Data

By default demo data is stored in `apps/server/data`:

- `db.json` - metadata records;
- `uploads/` - uploaded audio files.
