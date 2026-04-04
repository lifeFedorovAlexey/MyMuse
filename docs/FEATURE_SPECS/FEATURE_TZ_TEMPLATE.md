# Feature TZ Template

## 1. Meta

- Feature ID: `F-XXXX`
- Title:
- Author:
- Status: `draft | approved | in-progress | done`
- Related epic:
- Target release:

## 2. Business Goal

Describe what user/system problem this feature solves.

## 3. In Scope

- 

## 4. Out of Scope

- 

## 5. Functional Requirements

List explicit requirements with stable IDs.

- `FR-1`:
- `FR-2`:

## 6. Non-Functional Requirements

- `NFR-1` Performance:
- `NFR-2` Reliability:
- `NFR-3` Security:
- `NFR-4` Observability:

## 7. Architecture Design

Required sections:
1. Domain changes
2. Application/use-case changes
3. Infrastructure changes
4. Interface/API changes
5. Data model changes
6. Dependency direction check

## 8. API Contract (if applicable)

- Endpoint:
- Method:
- Request schema:
- Response schema:
- Error cases:

## 9. Data and Migration Plan

- New tables/fields/indexes:
- Migration steps:
- Rollback strategy:

## 10. Security and Compliance

- Threats considered:
- Access control model:
- Abuse/rate-limit plan:
- Content/legal implications:

## 11. Acceptance Criteria

Each criterion must be testable and linked to tests.

- `AC-1`:
- `AC-2`:

## 12. Test Plan (Mandatory)

Map each AC to automated tests.

- `TC-1` Type: `unit | integration | contract | e2e`
  - Covers: `AC-...`
  - Scenario:
  - Expected result:

## 13. Monitoring and Metrics

- Success metrics:
- Error metrics:
- Logs/events to emit:

## 14. Rollout Plan

- Feature flag:
- Environment rollout order:
- Backward compatibility notes:

## 15. Risks and Mitigations

- `R-1`:
- `R-2`:

## 16. Definition of Done Checklist

- [ ] Architecture constraints validated.
- [ ] All AC covered by tests.
- [ ] Tests pass in CI.
- [ ] Documentation updated.
- [ ] Rollback plan documented.
