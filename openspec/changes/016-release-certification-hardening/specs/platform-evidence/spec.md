# Platform Evidence Requirements

## Requirement PE-1 — Android current-head proof
Post-015 Android runtime claims SHALL use evidence generated from the current candidate SHA, not only earlier campaign certification.

## Requirement PE-2 — Dedicated-device ownership
Android certification SHALL use the dedicated brain-training AVD/device and SHALL fail closed on foreign-app/device contamination.

## Requirement PE-3 — Bounded environment recovery
If the emulator crashes, the agent SHALL execute a bounded compatibility matrix and record evidence. Repeated blind retries are prohibited.

## Requirement PE-4 — iOS compile proof
The repository SHALL provide macOS/Xcode build-smoke evidence for iOS source compatibility, with code signing disabled. This requirement does not imply store signing or TestFlight.

## Requirement PE-5 — Honest unavailable evidence
Manual SAF sheets, TalkBack/manual UX, physical-device refresh-rate behavior, and iOS runtime UX SHALL remain NOT VALIDATED unless actually performed.
