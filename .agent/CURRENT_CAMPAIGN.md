# Campaign 006R — Core Integrity Correction

**Status:** ACTIVE — spec-driven corrective gate  
**Campaign id:** `006r-core-integrity-correction`  
**OpenSpec change:** `openspec/changes/006r-core-integrity-correction/`  
**Execution entry:** `openspec/changes/006r-core-integrity-correction/EXECUTION.md`  
**Parent:** Campaign 006 Platform Hardening and Polish is SUSPENDED until 006R validates.

## Source of truth

The active OpenSpec change is the authoritative implementation contract for 006R:

1. `proposal.md` — scope and success definition
2. `design.md` — architecture/invariants
3. `specs/**/spec.md` — normative requirements/scenarios
4. `tasks.md` — ordered executable checklist
5. `EXECUTION.md` — fresh-agent recovery/execution protocol

The older `.agent/specs/006r-core-integrity-correction/**` files are retained as deep-audit working papers and supporting detail, but if wording conflicts, the OpenSpec change wins (below the Project Constitution).

## Immediate action

Sync canonical `main`, read the OpenSpec change, then execute the first unchecked task in `tasks.md`. The initial blocking objective is to restore a trustworthy green baseline before implementing the semantic repairs.

## Campaign constraints

- No new game modules.
- No content expansion merely to increase counts.
- No fake green; unavailable validation is NOT VALIDATED/BLOCKED.
- Preserve historical completed-session evidence.
- No routine force-push.
- One Android emulator by default; no host mouse/keyboard automation.
- Up to 7 coder agents only with explicit disjoint write ownership.
- Shared DB/navigation/registry generator/Game SDK/CI/package/durable-state files are orchestrator convergence surfaces.
- Every coherent normal push must be locally typecheck-clean and pass its required risk-based checks.

## Exit

Campaign 006R is complete only when every normative OpenSpec requirement and task is validated, the full-catalog exit gate passes, no Critical/High defect remains, final CI is green when available, durable state/checkpoint matches reality, and clean `main` is pushed.