# MyMuse Architecture Map

## Purpose

MyMuse is a self-hosted audio terminal with:

- `apps/server/src/*`: Fastify API, auth, storage, share links, streaming, metadata inference.
- `apps/server/public/*`: browser UI for auth, library, playlists, access management, and player.
- `apps/server/test/*`: Vitest coverage for backend flows and frontend behavior contracts.
- `docs/*`: API and architecture documentation.

## Current module map

### Backend

- `apps/server/src/index.ts`
  Starts the HTTP server.
- `apps/server/src/server.ts`
  Registers routes, auth gatekeeping, rate limits, health/ready endpoints, uploads, streams, CRUD.
- `apps/server/src/store.ts`
  Local filesystem-backed persistence.
- `apps/server/src/pg-store.ts`
  Postgres-backed persistence.
- `apps/server/src/auth.ts`
  Token and auth helpers.
- `apps/server/src/types.ts`
  Shared domain types.
- `apps/server/src/config.ts`
  Environment and runtime configuration.

### Frontend shell

- `apps/server/public/index.html`
  Static shell and top-level slots only.
- `apps/server/public/styles.css`
  Global visual system, layout, responsive behavior, CRT treatment.
- `apps/server/public/js/main.js`
  Frontend composition root. Wires boot flow, API calls, rendering, forms, and player controls.
- `apps/server/public/js/state.js`
  Shared client state container.
- `apps/server/public/js/dom.js`
  Single DOM lookup registry.
- `apps/server/public/js/helpers.js`
  Shared UI helpers.
- `apps/server/public/js/api.js`
  Browser API wrapper.

### Frontend feature modules

- `apps/server/public/js/render.js`
  Screen orchestration and list rendering.
- `apps/server/public/js/player.js`
  Audio element control, EQ behavior, volume behavior, playback state sync.
- `apps/server/public/js/crtTextWave.js`
  CRT text highlight effect.

### Frontend UI components

- `apps/server/public/js/components/hudMenu.js`
  Header HUD renderer.
- `apps/server/public/js/components/leftMenu.js`
  Left navigation renderer.

## Hard requirements

These rules are mandatory for all future changes.

1. `main.js` is the composition root only.
   It may wire modules together, but must not absorb feature logic or inline rendering logic.

2. Every reusable UI unit must live in its own file.
   If a UI element is rendered in more than one place, extract it into `public/js/components/*`.

3. Repeated button construction must be centralized.
   Shared button patterns must use one helper/component instead of open-coded DOM creation in multiple branches.

4. `dom.js` is the only place for global DOM queries.
   Feature modules must consume `refs`, not call scattered `getElementById` or `querySelector` at runtime.

5. Feature logic must stay feature-local.
   Player behavior stays in `player.js`, screen composition in `render.js`, network I/O in `api.js`.

6. Static HTML should define slots, not full repeated feature markup.
   When a block has internal states or repeated subparts, prefer rendering through a component module.

7. Visual tokens must be reused.
   Colors, spacing, border language, and motion should come from existing CSS variables and shared classes before adding new one-off values.

8. Responsive behavior is not optional.
   Every desktop layout change must be checked against tablet and mobile layout rules in the same patch.

9. Every interactive control must have a behavior test.
   Buttons, toggles, and player controls require Vitest coverage for click behavior and resulting state changes.

10. UI refactors must preserve existing contracts.
    Public ids used by logic and tests should only change together with coordinated updates in `dom.js`, tests, and behavior modules.

11. New shared UI patterns require tests and documentation in the same PR.
    If a new reusable component is introduced, add at least one test that covers its contract or the feature using it.

12. No decorative fake behavior when real state exists.
    Audio meters, playback state, mute state, and stream progress must derive from live state, not CSS-only imitation.

## UI quality bar

Every screen should satisfy all of the following:

- Clear primary action hierarchy.
- Minimum 44px comfortable hit area for touchable controls.
- No orphan controls floating without relation to their content.
- No duplicated information blocks unless comparison is the goal.
- No hidden overflow clipping important controls or overlays.
- Motion should be expressive but never disorienting.
- Labels and icons must remain understandable without relying on color alone.
- Mobile layouts must stack intentionally, not merely collapse desktop grids.

## Immediate refactor targets

These areas still require active discipline:

- Extract reusable action-button creation from `render.js`.
- Keep player controls visually grouped and test-covered.
- Prevent future regression where overlays are positioned relative to the wrong column or clipped by frame edges.
