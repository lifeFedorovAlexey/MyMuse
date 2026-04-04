# Test Traceability Matrix

## F-0001 Track Upload

- `AC-1` -> `apps/server/test/f0001-track-upload.test.ts` (`uploads valid file and returns 201 with track id`)
- `AC-2` -> `apps/server/test/f0001-track-upload.test.ts` (`persists uploaded file in storage`)
- `AC-3` -> `apps/server/test/f0001-track-upload.test.ts` (`returns 400 when multipart request has no file`)

## F-0002 Track Streaming with HTTP Range

- `AC-1` -> `apps/server/test/f0002-track-streaming-range.test.ts` (`streams full content with 200`)
- `AC-2` -> `apps/server/test/f0002-track-streaming-range.test.ts` (`returns partial content with 206 and range headers`)
- `AC-3` -> `apps/server/test/f0002-track-streaming-range.test.ts` (`returns 416 for invalid range`)

## F-0003 Playlists CRUD (MVP Scope)

- `AC-1` -> `apps/server/test/f0003-playlists-crud.test.ts` (`creates playlist with 201`)
- `AC-2` -> `apps/server/test/f0003-playlists-crud.test.ts` (`adds existing track to playlist`)
- `AC-3` -> `apps/server/test/f0003-playlists-crud.test.ts` (`returns 404 when adding missing track`)

## F-0004 Share Links for Track/Playlist

- `AC-1` -> `apps/server/test/f0004-share-links.test.ts` (`creates and resolves track share`)
- `AC-2` -> `apps/server/test/f0004-share-links.test.ts` (`returns 403 for expired share token`)
- `AC-3` -> `apps/server/test/f0004-share-links.test.ts` (`serves public share page for valid token`)

## F-0005 Library Management

- `AC-1` -> `apps/server/test/f0005-library-management.test.ts` (`updates track metadata`)
- `AC-2` -> `apps/server/test/f0005-library-management.test.ts` (`deletes track and returns 204`)
- `AC-3` -> `apps/server/test/f0005-library-management.test.ts` (`removes track from playlist via delete endpoint`)

## F-0006 Share Manager

- `AC-1` -> `apps/server/test/f0006-share-manager.test.ts` (`lists active shares with public url`)
- `AC-2` -> `apps/server/test/f0006-share-manager.test.ts` (`revokes share and hides it from list`)
- `AC-3` -> `apps/server/test/f0006-share-manager.test.ts` (`revokes share and hides it from list`)

## F-0007 Authentication (Owner + Invite)

- `AC-1` -> `apps/server/test/f0007-auth-owner-invite.test.ts` (`registers owner and logs in`)
- `AC-2` -> `apps/server/test/f0007-auth-owner-invite.test.ts` (`blocks private endpoint without bearer token`)
- `AC-3` -> `apps/server/test/f0007-auth-owner-invite.test.ts` (`creates invite and accepts it as regular user`)
