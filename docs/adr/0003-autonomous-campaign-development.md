# ADR 0003 — Autonomous Campaign Development

**Status:** Accepted  
**Date:** 2026-08-16

## Context

The owner wants long-running, near-unattended development, primarily through Kimi Code CLI swarm mode, without feature-by-feature exhaustive QA or host-input interference.

## Decision

Use bulk implementation campaigns with partitioned parallel coder agents, orchestrator-owned convergence, risk-based light validation after waves, and full hardening only when explicitly invoked by the owner.

One dedicated Android emulator is the default expensive runtime environment. Routine automation cannot hijack the host mouse/keyboard or desktop focus.

## Consequences

Architecture must minimize shared edit hotspots, provide durable repository state, and expose strong autonomous QA instrumentation.
