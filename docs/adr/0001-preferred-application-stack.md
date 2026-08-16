# ADR 0001 — Preferred Application Stack

**Status:** Accepted  
**Date:** 2026-08-16

## Context

The product targets Android+iOS, Android-first autonomous development, a large modular mini-game catalog, high-quality animation, and non-interfering Android emulator QA.

## Decision

Prefer React Native + Expo + TypeScript, SQLite for canonical local persistence, Reanimated for motion/interactions, and Skia only where specific game rendering benefits justify it.

Native Swift/Kotlin modules require demonstrated need; no wholesale native rewrite is planned.

## Consequences

The stack should maximize shared Android/iOS code and fit the Android emulator automation strategy while preserving a path to native specialization when evidence warrants it.
