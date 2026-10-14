# Native preview 02 — intermediate evidence and unresolved acceptance

Built from the inventoried app source of commit
918c20ed1760e1691bf7a601aa6c8db1161bd495. This preview does not contain the
subsequent observation, flexibility, remaining input or Progress wave.
Local artifacts: qa-artifacts/campaign077/native-preview02/.

## Identity and saved data

- Build PASS: 532 tasks, 14m5s. Inventory: 1103 files, zero source differences;
  SHA256 02a946c803fcb9ad50664772d9b94c337d534beefc2e23c1b796c6540ae4a62c.
- APK SHA256 949915d17e11e3f350481f6b1b6a1db621f51cc2d13111b893a5749d38401b57,
  52,264,147 bytes; com.braintraining.app 0.1.0/1000, x86_64, debug-signed release.
- Install-r SUCCESS. Exact pre-install SQLite db/wal/shm preserved; verification
  used a separate working copy. Post-install integrity ok and six saved sessions.
  Persisted System preference was absent/default, directly witnessed and bound
  to the installed APK. Settings snapshot SHA256
  a50813e8b2f4cf43007e4974865a96f85f080e8db3b32d006edee347b9cc2ec9.
- Cold launch observed 10,593ms / WaitTime 10,686ms during this checkpoint.
  This observation is not a performance PASS or a matched baseline comparison.

## Captures and independent review

routes-default/manifest.json contains 12/12 structurally valid frames: Home,
Games, Profile, Rewards, Memory detail and Coordinate Turn detail in both directly
witnessed themes. Structural validity does not imply visual acceptance.
The independent reviewer inspected all 12, four relevant preview01 frames and
baseline Games/Profile.

| Severity | Concrete evidence | Disposition |
|---|---|---|
| P1 acceptance blocker | default/light/profile.png has an entirely invisible identity card; XML still exposes Player, XP, streak, coins and cosmetics in its bounds. Dark Profile is visible. | Preserve failed frame. Exact source contains Entrance index1. Later source disables that identity entrance so essential content paints immediately; the same navigation sequence still needs new-APK default-motion proof. |
| P2 | Both Games frames show only four category chips with no overflow cue for the other skills. | Later source adds a persistent swipe hint. Native acceptance pending. |
| P3 | START HERE, Suggested next and a numbered Suggested because row repeat the recommendation framing. | Later source retains the heading and direct rationale, removes redundant eyebrow/number. Native acceptance pending. |
| P3 | All four details expose raw implementation versions by default. | Later source puts preserved version information behind Game information. Native acceptance pending. |

The prior corrections are visible: calmer library artwork, human recommendation
language, one first-run detail state, labeled cosmetic slots and one primary
Claim all action. The other eleven default frames have no obvious essential
text overlap. This review does not cover compact/2×/below-fold/gameplay states.

## Profile diagnostic controls

On this same APK, profile-animation-diagnostic/reduced-motion/light/profile.png
and profile-default-control/default/light/profile.png each passed their 1/1
capture gate and were directly inspected: the identity card is visible in both.
The original blank frame remains a failure. These controls suggest a transient
sequence/motion interaction; they do not establish its cause or close it through
retries. Verify the source correction on a new build through Home → Games →
Profile with default motion, then the required other profiles.

Shared CTA vertical padding and compact/large-text ReportRow/ListRow reflow are
later source changes and are absent from this APK. The earlier resized compact
matrix stays FAILED; a separate density-only 320dp Home diagnostic passed 1/1
with intact system icons. Neither qualifies the complete current-source matrix.

## Checkpoint CI and remaining boundaries

At ebcb45e821c598bc2d408de62efeb8a57a0be8f6 all four GitHub workflows completed
successfully: App CI 38590943062, Repository Integrity 38590943337, Android Build
Smoke 38590943431 and iOS Build Smoke 38590943042. These qualify that checkpoint,
not an eventual Campaign077 ending SHA.

No new gameplay qualification is inferred from these screenshots or CI.
ARTEMIS provider access works; traces stay external. Current-source native
gameplay, full profile/state review, data/offline/performance journeys, actual
clean-checkout certification, ending-SHA CI and final visible Home handoff remain
open. PHYSICAL_ANDROID and IOS_RUNTIME remain NOT VALIDATED.
