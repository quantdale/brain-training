#!/usr/bin/env bash
# 076-f section 6 — the nine required controller-led journeys.
#
# These are STATEFUL journeys and are executed through the authorised external
# runtime controller (ARTEMIS). Per the change spec: "Host mouse, host keyboard,
# and gameplay-driving ADB automation MUST NOT be counted as the controller
# result", and "A successful controller request that does not execute the
# journey MUST NOT be recorded as PASS." So each row records what was actually
# executed, not that a request succeeded.
#
# Run AFTER the game sweep (they share the single device lock).
#   bash scripts/qa/cert076f-journeys.sh
set -u

REPO="D:/Documents/tryPython/brain-training"
ARTEMIS="D:/Tools/artemis"
EV="$REPO/openspec/changes/076-f-final-product-certification/evidence/journeys"

mkdir -p "$EV"

# key|goal
JOURNEYS=(
  "first-run|Complete first-run onboarding from a fresh install state: launch the app, complete the welcome/first-run flow, and land on the home screen. Report each screen you saw and what the app asked for."
  "daily-workout|From the home screen, start today's daily workout and enter the first game of the workout. Report the workout composition shown and the transition into gameplay."
  "scored-gameplay|Play a full game and report an actual SCORED outcome: the exact verdict text shown for a correct/incorrect/timeout answer, and the running score before and after."
  "interrupted-resume|Start a workout, play partway, put the app in the background and bring it back, then confirm the workout resumed where it left off. Report exactly what was preserved."
  "standalone-completion|Open a single game directly, play it to its final result screen, and report the full result including score, stats and reward."
  "workout-completion|Complete a full multi-game workout end to end and report the workout-complete screen, total reward and what the app offers next."
  "results-and-progress|Open the results and progress surfaces after playing, and report what personal record, streak and progress data is shown."
  "diagnostics-recovery|Open the app's data-management/diagnostics surface and report what backup, restore and storage information it exposes. If a storage-unavailable or bootstrap-recovery state is reachable, report it."
  "background-foreground|While a game is actively running, switch to another app and back, and report whether the game state, timer and score survived the interruption."
)

for entry in "${JOURNEYS[@]}"; do
  key="${entry%%|*}"
  goal="${entry#*|}"
  dest="$EV/$key"
  if [ -s "$dest/journey.md" ] && ! grep -q "NOT VALIDATED" "$dest/journey.md"; then
    echo "[skip] $key"
    continue
  fi
  mkdir -p "$dest"
  echo "=== [$(date +%H:%M:%S)] $key ==="
  ( cd "$ARTEMIS" && timeout 1500 uv run artemis run \
      "Locked app: com.braintraining.app. JOURNEY: $goal
Record what you actually executed in note key 'journey_log' with headings:
## Planned steps
## Executed steps  (what you really did, in order)
## Observed outcome (quote exact on-screen text)
## Defects (or 'none observed')
A request that did not execute the journey is NOT a pass - say so explicitly." \
      --profile pro --locked-app com.braintraining.app \
      --disable-step-summarizer --disable-checker \
      --without-video-recording-tools --disable-committee \
      --disable-planner-validation \
      --test-name "cert076f-journey-$key" ) > "$dest/artemis.log" 2>&1
  rc=$?

  sess=$(grep -oE "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}" "$dest/artemis.log" | tail -1)
  note=""
  [ -n "${sess:-}" ] && [ -s "$ARTEMIS/traces/$sess/notes/journey_log.md" ] && note="$ARTEMIS/traces/$sess/notes/journey_log.md"

  if [ -n "$note" ]; then
    note_status="PRESENT"
  else
    note_status="ABSENT — this journey is NOT VALIDATED"
  fi

  {
    echo "# Controller journey — \`$key\`"
    echo
    echo "- Controller: external ARTEMIS (D:\\Tools\\artemis), profile \`pro\`, locked app \`com.braintraining.app\`"
    echo "- ARTEMIS session: \`${sess:-unknown}\` (raw trace external to Git)"
    echo "- Device: emulator-5554 / AVD braintraining-ui35"
    echo "- APK under test: \`de6c5fcd19de2428af39b5f44a8e80ee1a9a037c4848c98ddb05ddcfd678903d\`"
    echo "- Controller exit code: $rc"
    echo "- Journey log: $note_status"
    echo
    if [ -n "$note" ]; then
      cat "$note"
    else
      echo "_No journey log produced. **NOT VALIDATED** — see artemis.log._"
    fi
  } > "$dest/journey.md"
  echo "    rc=$rc sess=$sess"
done
echo "=== JOURNEYS COMPLETE $(date -Iseconds) ==="
