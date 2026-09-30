# ADR 0001 — Preferred Application Stack

**Status:** Accepted  
**Date:** 2026-08-16

## Context

The product targets Android+iOS, Android-first autonomous development, a large modular mini-game catalog, high-quality animation, and non-interfering Android emulator QA.

## Decision

Prefer React Native + Expo + TypeScript, SQLite for canonical local persistence, and Skia only where specific game rendering benefits justify it.

**Amended 2026-09-30 (Change 071).** This ADR originally listed Reanimated for
motion/interactions. The shipped app does not use it: animation goes through
React Native's `Animated` via the shared `usePressFeedback` hook, and
`react-native-reanimated` has zero first-party imports. It remains in the tree
only because it is a **required peer dependency of `expo-router`**. The
preference is retained for a future migration, not as a description of the
present.

Native Swift/Kotlin modules require demonstrated need; no wholesale native rewrite is planned.

## Consequences

The stack should maximize shared Android/iOS code and fit the Android emulator automation strategy while preserving a path to native specialization when evidence warrants it.
