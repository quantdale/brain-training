# Design — Campaign 049

Use the Metro-independent release APK on `emulator-5554` for a bounded matrix
of Home, Games, Game Detail, Progress, Profile, and Data Management surfaces.
Capture light/dark plus compact and system font-scale-2 profiles, preserving
the XML hierarchy beside every screenshot. Run the repository accessibility
auditor with the matching emulator density. Its `clipped` entries are an
explicit viewport/tab-bar measurement boundary and are not target-size
violations; undersized or unlabelled interactive nodes remain failures.

Reuse existing Campaigns 038, 042, 043, 045, 046, 047, and 048 evidence for
reduced-motion, system document/share, workout/result, persistence, offline,
and state coverage when the product source is unchanged. Record inherited
evidence separately from newly executed checks. Restore the dedicated
emulator's display, theme, font, rotation, and animation settings after each
profile. If a real responsive defect is observed, make the smallest scoped
repair and rerun the affected surfaces and regression tests.
