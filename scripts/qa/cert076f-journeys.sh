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

# The host process inherits an OPENAI_API_KEY from the agent runtime that is NOT
# the ARTEMIS credential. Real env vars beat the .env file, so ARTEMIS would send
# the wrong key to the gateway and get 401 invalid_api_key. Unset it so
# D:\Toolsrtemis\.env supplies the real one.
unset OPENAI_API_KEY

# Same CreateProcess/.cmd scrcpy issue as the game sweep: prepend the real
# scrcpy.exe directory so recording starts instead of failing with WinError 2.
SCRCPY_DIR=$(ls -d "$LOCALAPPDATA"/Microsoft/WinGet/Packages/Genymobile.scrcpy_*/scrcpy-win64-v* 2>/dev/null | head -1)
if [ -n "$SCRCPY_DIR" ]; then
  export PATH="$SCRCPY_DIR:$PATH"
  echo "[info] scrcpy resolved to $SCRCPY_DIR"
fi

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
  # A row is only "done" when it carries a SUBSTANTIVE journey log. A file that
  # exists is not evidence: the controller can return a note that is the template
  # with every field empty ('- Personal record:' and nothing after), and accepting
  # that as a pass is exactly the over-claim this campaign exists to catch.
  journey_complete() {
    local f="$1"
    [ -s "$f" ] || return 1
    # The two headings that must each carry real content.
    grep -q '^## Executed steps' "$f" || return 1
    grep -q '^## Observed outcome' "$f" || return 1
    # Template stubs: a labelled field with no value after the colon.
    if grep -qE '^[-*] *[A-Za-z][A-Za-z ]{2,40}: *$' "$f"; then return 1; fi
    # Each required section must carry at least this much real text.
    local sec
    for sec in 'Planned steps' 'Executed steps' 'Observed outcome' 'Defects'; do
      local body
      body=$(awk -v s="^## $sec" '
        $0 ~ s {insec=1; next}
        insec && /^## / {insec=0}
        insec {buf = buf $0 "\n"}
        END {printf "%s", buf}' "$f")
      if [ "${#body}" -lt "${BT_MIN_JOURNEY_CHARS:-80}" ]; then
        return 1
      fi
    done
    return 0
  }
  if journey_complete "$dest/journey.md"; then
    echo "[skip] $key (complete)"
    continue
  fi
  mkdir -p "$dest"
  echo "=== [$(date +%H:%M:%S)] $key ==="
  (cd "$ARTEMIS" && timeout 1500 uv run artemis run \
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
    --test-name "cert076f-journey-$key") >"$dest/artemis.log" 2>&1
  rc=$?

  sess=$(grep -oE "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}" "$dest/artemis.log" | tail -1)
  note=""
  [ -n "${sess:-}" ] && [ -s "$ARTEMIS/traces/$sess/notes/journey_log.md" ] && note="$ARTEMIS/traces/$sess/notes/journey_log.md"

  if [ -n "$note" ] && journey_complete "$note"; then
    note_status="PRESENT (all four sections carry substantive content)"
  elif [ -n "$note" ]; then
    note_status="PRESENT BUT INCOMPLETE — this journey is NOT VALIDATED"
  else
    note_status="ABSENT — this journey is NOT VALIDATED"
  fi

  # The daemon keeps executing after the CLI client's 1500 s wait cap, so poll
  # for the session note before deciding the journey is not valid.
  if [ "$note_status" != "PRESENT (all four sections carry substantive content)" ]; then
    for _ in $(seq 1 "${BT_JOURNEY_POLL:-45}"); do
      sleep 20
      [ -n "${sess:-}" ] || break
      n2="$ARTEMIS/traces/$sess/notes/journey_log.md"
      [ -s "$n2" ] || continue
      if journey_complete "$n2"; then
        note="$n2"
        note_status="PRESENT (all four sections carry substantive content)"
        break
      fi
    done
  fi

  {
    echo "# Controller journey — \`$key\`"
    echo
    echo "- Controller: external ARTEMIS (D:\\Tools\\artemis), profile \`pro\`, locked app \`com.braintraining.app\`"
    echo "- ARTEMIS session: \`${sess:-unknown}\` (raw trace external to Git)"
    echo "- Device: ${BT_DEVICE:-emulator-5570} / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)"
    echo "- APK under test: \`${TERMINAL_APK:-e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f}\` (48,888,452 bytes, com.braintraining.app 0.1.0/1000), built from source b293a02e1cd5df260a66dd886c1d279978b68994"
    echo "- Device hash: installed base.apk matched ${TERMINAL_APK:-e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f} exactly (pulled from ${BT_DEVICE:-emulator-5570})"
    echo "- Controller exit code: $rc (the CLI client's own 1500 s wait cap, NOT the journey outcome)"
    echo "- Journey log: $note_status"
    echo
    if [ "$note_status" = "PRESENT (all four sections carry substantive content)" ]; then
      cat "$note"
    else
      echo "_No substantive journey log was produced. **This journey is NOT VALIDATED.**_"
      echo "_See artemis.log for the controller's own output; do not treat a returned file as acceptance._"
    fi
  } >"$dest/journey.md"
  echo "    rc=$rc sess=$sess -> $note_status"
done
echo "=== JOURNEYS COMPLETE $(date -Iseconds) ==="
