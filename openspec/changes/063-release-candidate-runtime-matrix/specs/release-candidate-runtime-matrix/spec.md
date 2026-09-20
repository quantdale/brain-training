# Spec — release-candidate-runtime-matrix

## ADDED Requirements

### Requirement: Authoritative release artifact identity

The change SHALL produce exactly one release APK built from the recorded
source checkpoint, with SHA-256, byte size, package/version, signing
status, and Metro independence recorded. No executable source SHALL drift
after certification without rebuild + re-certification.

#### Scenario: Artifact pinned

- GIVEN a completed release build
- WHEN recorded
- THEN hash, size, package, version, signing, and Metro independence are
  all stated (no "the APK" without identity).

### Requirement: Startup matrix on the exact artifact

On a clean install the artifact SHALL reach Home on cold first launch,
warm relaunch, offline launch, and force-stop relaunch, with zero ANR
dialogs and zero filtered fatal/ANR/SQLite/OOM markers across the
bounded launch sample.

#### Scenario: Clean startup sample

- GIVEN a clean install
- WHEN launched cold (first), warm, offline, and after force-stop
- THEN every launch renders Home with no ANR dialog and no fatal log
  markers.

### Requirement: Route and recovery matrix

The artifact SHALL render Home, Games, Game Detail, Progress, Profile,
Rewards, and Data Management route-verified and nonblank, and SHALL
recover to safe fallbacks on unknown/oversized/malformed game ids,
a valid Game Detail id, and unknown results ids. (Games search
interaction and compact/font-scale/dark-interaction matrices stay with
067; captures here cover default/light/dark.)

#### Scenario: Invalid routes recover

- GIVEN deep links with unknown/oversized game ids and unknown results ids
- WHEN opened
- THEN the app shows its recoverable fallback (no crash, no blank
  strand).

### Requirement: Provider and lifecycle boundaries

The system share sheet SHALL open from the export flow and cancel back
to the app with no ANR; the system Files picker SHALL open from the
import flow (Load from file) and cancel back with no ANR (no import
applied — retained-data boundary; 054 remains the technical authority
for apply/merge). Background/foreground cycles SHALL preserve state
via auto-pause without data loss.

#### Scenario: Share sheet opens and cancels safely

- GIVEN the export flow
- WHEN the system share sheet opens and the user cancels
- THEN the app returns intact with no ANR dialog.

#### Scenario: Files picker opens and cancels safely

- GIVEN the import flow's Load from file control
- WHEN the system Files picker opens and the user cancels
- THEN the app returns intact with no ANR dialog and no import applied.

### Requirement: Completion persistence on device (weak path certified)

A representative game SHALL complete with real interaction to a persisted
weak-path result carrying canonical normalized performance and
participation XP; force-stop + relaunch SHALL retain it; the device
database SHALL pass integrity, foreign-key, schema, and duplicate
audits. Mid/strong scaling, workout-leg linkage, and post-relaunch
Progress/history UI are explicitly deferred to 067.

#### Scenario: Real session persists across relaunch

- GIVEN a completed game session on the artifact
- WHEN the app is force-stopped and relaunched
- THEN Home/history reflects the session and SQLite audits stay clean.

## MODIFIED Requirements

None. Certification only (plus minimal repairs if reproduced).

## REMOVED Requirements

None.
