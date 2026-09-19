## Context

See [proposal.md](proposal.md). The repository is a validated offline-first
Expo/React Native product at Campaign 053 with a 42-game catalog, SQLite
persistence, an offline-first boundary, and a broad gated Jest suite. The
terminal Campaign 053 state has documented counts that disagreed with its own
commit message, historical known issues still phrased as current, and runtime
observations not yet re-tested on the exact final artifact. External CI has
failed before runner steps since 2026-09-05 under a provider account/policy
annotation, and the local release APK is debug-signed.

## Goals / Non-Goals

**Goals:**

- Produce a single defensible answer to "what is actually open right now?"
- Close every repository-owned gap that current tools, the dedicated emulator,
  and the repository's own validators can honestly close.
- Preserve historical truth while making current state unambiguous.
- Leave governance, OpenSpec, evidence, and Git in one coherent terminal state.

**Non-Goals:**

- No product feature or design work.
- No human/platform/store claims that the environment cannot support.
- No speculative repair of non-reproduced observations.

## Decisions

- **Disposition taxonomy over a blanket "known issues" bucket.** Each gap ends
  in exactly one auditable disposition.
- **Authoritative run over recorded counts.** The reconciliation command runs
  on the current tree; intermediate counts stay as historical records.
- **Byte-identity over trust.** The release APK is rebuilt with a forced Metro
  re-bundle and compared by SHA-256 to the prior artifact.
- **Bounded repetition over single samples.** Startup and provider re-tests
  use repeated cycles, including a true emulator cold boot.
- **Provider failure attribution.** The system DocumentsUI path is tested
  separately from app invocation; only app-side defects would be repaired.
- **Safe remediation only.** Only in-range dependency fixes may be applied;
  everything else keeps or renews an explicit time-bounded disposition.
- **Adversarial review before verdict.** A second pass challenges every
  closure claim, then a single terminal ledger records the final verdict.

## Risks / Trade-offs

- Bounded re-tests cannot prove absence of a rare ANR; results are recorded as
  bounded non-reproduction, never as a guarantee.
- The external GitHub account/policy blocker is outside repository authority;
  it remains a verified external boundary with current run evidence.
- Emulator-only evidence cannot replace physical-device or human validation;
  those remain explicit manual/platform boundaries with executable handoffs.
