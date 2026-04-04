# Technical Requirements (TZ)

## 1. Scope and Intent

This document is mandatory for all implementation work in MyMuse.
Any feature must comply with this TZ before merge.

## 2. Architecture Policy (Mandatory)

1. Clean Architecture is required.
2. No ad-hoc hacks, hidden side effects, or "temporary" logic in production paths.
3. Layer boundaries must be explicit:
- `domain`: entities, value objects, business rules.
- `application`: use-cases, orchestration.
- `infrastructure`: db, file storage, external APIs.
- `interface`: HTTP handlers, DTO mappers, UI adapters.
4. Dependencies are inward-only (outer layers depend on inner layers, never vice versa).
5. Any new module must document its place in architecture.

## 3. Production Standards

1. Strong typing and input validation on all public boundaries.
2. Backward-compatible API changes unless major version explicitly planned.
3. Observability required for feature-critical flows:
- structured logs,
- error context,
- measurable success/failure signals.
4. Security by default:
- authz/authn checks,
- path traversal prevention,
- safe token handling,
- rate limiting for public endpoints.
5. Feature flags for risky/experimental behavior.

## 4. Testing Policy (Mandatory)

Each implemented feature must include tests and cannot be accepted without them.

Required minimum:
1. Unit tests for core domain/application rules.
2. Integration tests for data/storage/API interactions.
3. API contract tests for endpoint behavior (status, schema, error cases).
4. Regression test for each fixed bug.

Coverage rule:
1. Every acceptance criterion in feature TZ must map to at least one automated test.
2. PR must include test evidence (test names/results).

## 5. Feature Lifecycle (Mandatory)

For every feature, follow this order:
1. Create detailed feature TZ document (separate file).
2. Review and approve TZ.
3. Implement feature according to TZ.
4. Add/adjust tests to fully cover TZ criteria.
5. Run validation checklist and only then merge.

No implementation starts without step 1.

## 6. Definition of Done

A feature is done only if:
1. Feature TZ exists and is up to date.
2. Architecture constraints are satisfied.
3. All required tests are implemented and passing.
4. Error paths are covered.
5. Docs/changelog updated where relevant.

## 7. Traceability

Each PR must link:
1. Feature TZ file.
2. Acceptance criteria IDs.
3. Test cases that validate each criterion.
