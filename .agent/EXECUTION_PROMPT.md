# Execution Prompt — Campaign 022: Release-Candidate Certification

**Status:** VALIDATED
**Change:** `022-release-candidate-certification`
**Start-SHA:** `76a58dccf819c57364d5531c2ca4c2bc3c375e46`
**Planned-At:** 2026-09-05
**Target-Branch:** `main`
**Predecessor:** `021-release-gate-reconvergence` (VALIDATED)
**Terminal verdict:** **CONDITIONAL GO**

## Archived execution prompt — DO NOT RESTART

The campaign objective was to move the repository from repository-owned automation completeness to the strongest defensible release candidate through debt disposition, clean release-artifact inspection, standalone/broad Android runtime certification, lifecycle/data/offline/security checks, honest platform-evidence classification, final automated/CI convergence, and an evidence-backed GO / CONDITIONAL GO / NO-GO verdict.

That objective was completed. Exact results and limitations live in `.agent/VALIDATION.md`; the current release-readiness classification is CONDITIONAL GO. Manual/external evidence that was unavailable remains unavailable and was not converted into PASS.

A fresh agent must not execute this prompt. Read `.agent/GOVERNANCE.json` and `.agent/STATE.md`; if `activeCampaign` is null, planning or new owner authorization is required before another implementation campaign begins.
