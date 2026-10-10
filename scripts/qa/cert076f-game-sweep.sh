#!/usr/bin/env bash
# 076-f current-device game acceptance sweep.
#
# Drives each registered game through the AUTHORISED external controller
# (ARTEMIS at D:\Tools\artemis). No ADB gameplay driving: ADB is used only for
# install/screenshot/hierarchy capture and diagnostics (AGENTS.md boundary).
#
# Per game it files into the change evidence directory:
#   <game>/review.md    scrubbed controller state-review log + run metadata
#   <game>/result.png   terminal-APK device frame (uiautomator hierarchy too)
#   <game>/result.xml
#
# Resumable: a game whose review.md already exists is skipped.
set -u

# The host process inherits an OPENAI_API_KEY from the agent runtime that is NOT
# the ARTEMIS credential. Real env vars beat the .env file, so ARTEMIS would send
# the wrong key to the gateway and get 401 invalid_api_key. Unset it so
# D:\Toolsrtemis\.env supplies the real one.
unset OPENAI_API_KEY

# ARTEMIS spawns `scrcpy` through CreateProcess, which cannot execute a .cmd
# wrapper. The only scrcpy on this host PATH is the .cmd shim, so every spawn
# failed with WinError 2 and the video-segment tools retried until timeout.
SCRCPY_DIR=$(ls -d "$LOCALAPPDATA"/Microsoft/WinGet/Packages/Genymobile.scrcpy_*/scrcpy-win64-v* 2>/dev/null | head -1)
if [ -n "$SCRCPY_DIR" ]; then
  export PATH="$SCRCPY_DIR:$PATH"
  echo "[info] scrcpy resolved to $SCRCPY_DIR"
else
  echo "[warn] scrcpy directory not found"
fi

REPO="D:/Documents/tryPython/brain-training"
ARTEMIS="D:/Tools/artemis"
EV="$REPO/openspec/changes/076-f-final-product-certification/evidence/current-device"

# Terminal artifact identity, from evidence/TERMINAL_IDENTITY.json and verified
# on this device in this session: the installed base.apk hashes to the same
# SHA-256 as the host release APK (48,888,452 bytes, com.braintraining.app
# 0.1.0/1000, ABI x86_64). The pre-076-f rows below were graded on the
# superseded de6c5fcd... APK and are archived under _superseded-de6c5fcd/.
TERMINAL_APK="e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f"
TERMINAL_APK_BYTES="48,888,452"
TERMINAL_SOURCE="b293a02e1cd5df260a66dd886c1d279978b68994"
BT_DEVICE="${BT_DEVICE:-emulator-5570}"
export BT_AVD_NAME=braintraining-ui35

# Ordered so the 20 games whose PARENT redesign task is still unchecked (076-f
# tasks 3.1-3.20) run first: those gate the parent acceptance ledger. The
# remaining 22 (task 3.21) are covered afterwards. attention-target-count is
# already filed and is skipped by the resume guard.
GAMES=(
  attention-odd-one-out
  attention-sustained-vigilance
  attention-symbol-tracker
  attention-visual-search
  flexibility-color-stroop
  flexibility-task-switch
  language-context-fit
  language-word-chain
  language-word-match
  language-word-scramble
  logic-code-cracker
  math-equation-builder
  math-fast-math
  math-number-line-estimation
  math-value-ordering
  memory-prospective-cue
  memory-running-order
  spatial-grid-nav
  speed-quick-compare
  speed-tap-rush
  attention-target-count
  flexibility-card-sort
  flexibility-cue-shift
  flexibility-rule-flip
  language-sentence-builder
  logic-deduction-table
  logic-next-sequence
  logic-order-path
  logic-rule-grid
  math-missing-operator
  memory
  memory-grid-recall
  memory-pair-recall
  memory-pattern-tap-back
  memory-sequence-memory
  spatial-coordinate-turn
  spatial-fold-match
  spatial-mental-rotation
  spatial-transform-match
  speed-color-match
  speed-order-sweep
  speed-reaction-time
)

mkdir -p "$EV"

# Optional subset override for resumable batching: BT_GAME_LIST="a b c" runs only
# those games (still subject to the per-game resume guard below).
if [ -n "${BT_GAME_LIST:-}" ]; then
  read -r -a GAMES <<<"$BT_GAME_LIST"
fi


prompt_for() {
  cat <<EOF
Locked app: com.braintraining.app. The deep link braintraining://game/$1 opens this game directly.
Perform ONE current-device game-state acceptance journey for THIS game ($1) and record it in note key 'game_state_review_log' with exactly these headings:
## 1. Active Play Board  (board/stimulus content, every visible control and its literal label, round/score/timer chips, whether instructions are visible, whether the board is legible with clear hierarchy)
## 2. Scored Feedback   (a correct/incorrect verdict OR a timeout reveal both count. Report the EXACT verdict text. An intro screen or unanswered board is NOT feedback)
## 3. Pause & Resume     (open the PAUSE overlay, quote its buttons, then RESUME)
## 4. Final Result Screen (report every score/stat line and the reward exactly)
## 5. Input & Exit       (did taps register immediately? then exit to the games list and re-open this game to prove safe exit and return)
## 6. Defects            (clipped text, low contrast, hidden/unreachable action, overlap, unresponsive input - or 'none observed')

START HERE, IN THIS ORDER:
1. Force-stop the app and fire the deep link from a cold state: run 'adb shell am force-stop com.braintraining.app' then 'adb shell am start -a android.intent.action.VIEW -d braintraining://game/$1'. Do NOT rely on whatever game is already on screen - a previous game may still be open and its board looks nothing like this one.
2. CONFIRM IDENTITY BEFORE PLAYING: read the on-screen game title and confirm it is this game's own title and mechanic description. If the screen is a different game, re-fire the deep link from cold. A journey recorded for the wrong game is worthless.
3. Only then start the game and work through sections 1-6 in order.

EFFICIENCY CONTRACT - you have a hard wall-clock budget and an incomplete note is worth nothing:
- Fill EVERY heading, in order, before you end. A note with a '_Pending' section is rejected.
- Round timers here are roughly 10-15 seconds. Do NOT spend many turns trying to land an answer tap: after at most 3 unsuccessful answer attempts in a round, LET THE ROUND TIME OUT and capture the timeout reveal - that is valid scored feedback for section 2.
- The round timer freezes while the PAUSE overlay is up, so open Pause and use 'adb shell uiautomator dump' beneath the overlay when you need the full board tree in one step.
- Use 'adb shell uiautomator dump' + 'adb shell screencap' for evidence; do not wait on the LLM to describe a screenshot.
- Reaching the RESULT screen requires playing every round. Waiting out timeouts is a legitimate and often the only way to get there - prefer it over burning turns.
- Keep note updates SHORT and factual. Update the note once per heading, not once per observation.
End on the final RESULT screen with all six headings filled.
EOF
}


# Pro, not Flash: measured on the same game (attention-odd-one-out) the Flash
# reactive loop ran UNBOUNDED - 120 steps / 351 LLM calls and never wrote its
# review note - while Pro's planner + convergence gate completed the identical
# journey in 17 steps / 73 calls WITH the note. Pro is the cheaper and the
# better-evidenced profile here.
#
# The external Google credential is free tier and the only model with budget is
# capped at 15 requests/minute, so the auxiliary LLM sub-agents (checker, step
# summarizer, committee, planner validation, video analyzer) are disabled to fit
# that budget. The reviewer's own inspection of the filed device frames supplies
# the verification those sub-agents would otherwise provide. See
# evidence/CONTROLLER.md.
ARTEMIS_FLAGS=(
  --profile pro
  --locked-app com.braintraining.app
  --disable-step-summarizer
  --disable-checker
  --without-video-recording-tools
  --disable-committee
  --disable-planner-validation
)

# Hard wall-clock budget per game. Measured on this provider: a complete journey
# needs ~35-45 min (six rounds of a ~12s timer plus LLM latency on ~150k-token
# prompts). 1500s cut runs off with only sections 5-6 unfilled, which is worth
# nothing, so the budget is set above the measured completion time.
ARTEMIS_TIMEOUT="${BT_GAME_TIMEOUT:-3000}"
for g in "${GAMES[@]}"; do
  dest="$EV/$g"
  if [ -s "$dest/review.md" ]; then
    echo "[skip] $g"
    continue
  fi
  mkdir -p "$dest"
  name="cert076f-game-$g"
  # Reset the app to a cold state BEFORE handing the device to the controller.
  # Without this the previous game stays foregrounded and its deep link is
  # delivered to the already-running instance, so the journey documents the
  # WRONG game's board. Measured three times in this campaign: tasks for
  # attention-visual-search filed notes describing Signal Watch's GO mechanic.
  # This is an app reset, not gameplay driving - AGENTS.md allows ADB to
  # 'install, log, screenshot, dump hierarchy' and 'APK install/reset'.
  echo "    resetting app state (force-stop)"
  adb -s "$BT_DEVICE" shell am force-stop com.braintraining.app >/dev/null 2>&1
  sleep 2
  echo "=== [$(date +%H:%M:%S)] $g ==="
  (cd "$ARTEMIS" && timeout "$ARTEMIS_TIMEOUT" uv run artemis run "$(prompt_for "$g")" \
    "${ARTEMIS_FLAGS[@]}" --test-name "$name") \
    >"$dest/artemis.log" 2>&1
  rc=$?
  echo "    client rc=$rc"
  # The ARTEMIS CLI hard-codes a 1800 s client-side wait (`interfaces/cli/commands/run.py`
  # `wait_for_daemon_task(..., timeout=1800.0)`). Measured on this provider a complete
  # game journey needs ~35-60 min, so the client returns "Timed out after 1800.0s"
  # (rc=1) while the DAEMON keeps executing: the task finishes minutes later and its
  # note is completed then. So the client return code alone is not the outcome —
  # poll the daemon's session notes until the note has all six headings filled.
  POLL_BUDGET="${BT_POLL_BUDGET:-3000}"
  # Only harvest a session created during THIS game's attempt. Without this a
  # previous run's trace for the same game would be mistaken for this run's.
  SESSION_MAX_AGE="${BT_SESSION_MAX_AGE:-5400}"
  # Identity: a session belongs to THIS game when its task plan or review log
  # names the game's own deep link / registry id. The test name never lands in
  # stdout.log, and matching on the newest session alone mis-attributes a run
  # (measured: one sweep harvested a note describing the PREVIOUS game), so the
  # match is always on the game id.
  find_note() {
    # Echo the note path for the newest FRESH session that genuinely documents
    # THIS game. Three conditions, all required: the session is fresh, it names
    # the game's deep link (or id) in its plan, the note is complete, AND the note
    # body names this game's own display title. The last one is what rejects a
    # note that carried the right id in its header but documented another game.
    local cand n age
    for cand in $(ls -t "$ARTEMIS/traces" 2>/dev/null | grep -E "^[0-9a-f]{8}-" | head -10); do
      n="$ARTEMIS/traces/$cand/notes/game_state_review_log.md"
      [ -s "$n" ] || continue
      age=$(( $(date +%s) - $(stat -c %Y "$ARTEMIS/traces/$cand" 2>/dev/null || stat -f %m "$ARTEMIS/traces/$cand" 2>/dev/null || echo 0) ))
      [ "$age" -le "$SESSION_MAX_AGE" ] || continue
      if grep -q "game/$g\b" "$ARTEMIS/traces/$cand/notes/task_plan.md" 2>/dev/null ||
         grep -q "game/$g\b" "$n" 2>/dev/null; then
        if note_complete "$n"; then
          echo "$n"
          return 0
        fi
      fi
    done
    return 1
  }
  # The registry display name for this game, so a note can be REJECTED when it
  # describes a different game. Measured failure: the controller wrote a note whose
  # own header named the right game id but whose sections documented the PREVIOUS
  # game (its result screen carried attention-odd-one-out.results ids). A header
  # naming the id proves nothing; the body must name this game's own title.
  expected_name() {
    # Print the registry display name for this game id.
    (cd "$REPO" && node scripts/qa/game-name.mjs "$g" 2>/dev/null)
  }
  WANT_NAME=$(expected_name)
  # Every section of the log must carry real content. Two guards, because one is
  # not enough: a section can be long yet still be a template stub. Measured:
  # a note whose sections 2-6 read "- Exact verdict text:" / "- Source round:"
  # with nothing after them cleared a 60-char floor and was accepted.
  #  - length: valid measured sections run 300-1350 chars; stubs run 90-120.
  #  - stub field: a '- Some label:' with an empty value is a field never filled.
  # Both guards are scoped to the SECTION body, never to the whole file: a stub
  # line in one section must not reject a note whose other sections are real.
  MIN_SECTION_CHARS="${BT_MIN_SECTION_CHARS:-200}"
  section_body() {
    awk -v s="^## $1[.]" '
      $0 ~ s {insec=1; next}
      inseci && /^## / {insec=0}
      insec {buf = buf $0 "\n"}
      END {printf "%s", buf}' "$2"
  }
  # A section is a template when MOST of its lines are labelled fields left empty
  # ("- Exact verdict text:" with nothing after). A single such line followed by a
  # real list is legitimate content, so this is a ratio, not a presence test:
  # measured stubs run 3-4 empty fields out of 4 lines, real notes run 0-1 out of 7.
  body_is_template() {
    local body="$1" total stubs ratio_num ratio_den
    total=$(printf '%s\n' "$body" | grep -cE '[^[:space:]]')
    stubs=$(printf '%s\n' "$body" | grep -cE '^[-*] *[^:]{2,60}: *$')
    [ "$total" -gt 0 ] || return 0
    [ "$stubs" -gt 0 ] || return 1
    ratio_num=$(( stubs * 2 ))
    ratio_den=$total
    [ "$ratio_num" -ge "$ratio_den" ]
  }
  note_complete() {
    local f="$1"
    [ -s "$f" ] || return 1
    grep -qi "_Pending" "$f" && return 1
    # The body must name this game's own title. A case-folded substring match is
    # used because Git Bash's grep aborts on `-i` combined with `-F`.
    if [ -n "$WANT_NAME" ]; then
      local fold="$(printf '%s' "$WANT_NAME" | tr '[:upper:]' '[:lower:]')"
      local hay="$(tr '[:upper:]' '[:lower:]' < "$f")"
      case "$hay" in
        *"$fold"*) : ;;
        *) return 1 ;;
      esac
    fi
    local sec
    for sec in 1 2 3 4 5 6; do
      local body
      body=$(section_body "$sec" "$f")
      # A section that is only a labelled-but-empty field list is a template.
      if [ "${#body}" -lt "$MIN_SECTION_CHARS" ] || body_is_template "$body"; then
        return 1
      fi
    done
    return 0
  }

  echo "    polling daemon for up to ${POLL_BUDGET}s (client rc is not the outcome)..."
  waited=0
  note=""
  idle=0
  while [ "$waited" -lt "$POLL_BUDGET" ]; do
    if note=$(find_note); then
      if note_complete "$note"; then
        echo "    note complete after ${waited}s of daemon polling"
        break
      fi
    fi
    # A finished task with an incomplete note must not hold the sweep for the
    # whole poll budget. The daemon keeps a task's process alive only while it
    # runs, so 'no artemis process AND no trace touched recently' means this
    # game is not going to finish and the row will be NOT VALIDATED.
    if ! pgrep -f "artemis run" >/dev/null 2>&1; then
      newest=$(ls -t "$ARTEMIS/traces" 2>/dev/null | head -1)
      if [ -n "$newest" ]; then
        age=$(( $(date +%s) - $(stat -c %Y "$ARTEMIS/traces/$newest" 2>/dev/null || echo 0) ))
        if [ "$age" -gt 240 ]; then
          idle=$((idle + 20))
          if [ "$idle" -ge 120 ]; then
            echo "    daemon task ended with an incomplete note — moving on"
            break
          fi
        else
          idle=0
        fi
      else
        idle=$((idle + 20))
        if [ "$idle" -ge 120 ]; then break; fi
      fi
    else
      idle=0
    fi
    sleep 20
    waited=$((waited + 20))
  done
  note=$(find_note || true)
  sess=$(basename "$(dirname "$(dirname "${note:-/x/y}")")" 2>/dev/null || echo none)

  {
    echo "# Current-device acceptance — \`$g\`"
    echo
    echo "- Date: $(date -Iseconds)"
    echo "- Controller: external ARTEMIS (D:\\Tools\\artemis), profile \`pro\` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md), locked app \`com.braintraining.app\`"
    echo "- Test name: \`$name\`"
    echo "- ARTEMIS session: \`$sess\` (raw trace external to Git)"
    echo "- Device: $BT_DEVICE / AVD braintraining-ui35 (Android 15, SDK 35, sdk_gphone64_x86_64 1080x2400)"
    echo "- APK under test: \`$TERMINAL_APK\` ($TERMINAL_APK_BYTES bytes, com.braintraining.app 0.1.0/1000), built from source $TERMINAL_SOURCE"
    echo "- Device hash: installed base.apk matched $TERMINAL_APK exactly (pulled from $BT_DEVICE)"
    echo "- Controller exit code: $rc (the CLI client's own 1800 s wait cap, NOT the journey outcome)"
    if note_complete "${note:-/dev/null}"; then
      echo "- Controller review note: PRESENT (all six headings filled)"
    elif [ -n "$note" ]; then
      echo "- Controller review note: PRESENT BUT INCOMPLETE — this row is NOT VALIDATED"
    else
      echo "- Controller review note: ABSENT — this row is NOT VALIDATED"
    fi
    echo
    echo "## Controller state-review log (scrubbed)"
    echo
    if [ -n "$note" ]; then
      cat "$note"
    else
      echo "_No controller review note was produced. **This game is NOT VALIDATED.**_"
      echo "_See artemis.log for the failure; do not treat the device frame below as acceptance._"
    fi
    echo
    echo "## Device frame filed alongside"
    echo
    echo "\`result.png\` + \`result.xml\` are captured from the terminal APK on the"
    echo "current device after the journey, and are the reviewer's independent check"
    echo "on the controller report above."
  } >"$dest/review.md"

  (cd "$REPO" && bash scripts/android/screenshot.sh --dir "$dest" --name result >/dev/null 2>&1)
  # hierarchy.sh --save is anchored to qa-artifacts/, so capture then move.
  (cd "$REPO" && bash scripts/android/hierarchy.sh --save "${g}-result.xml" >/dev/null 2>&1 &&
    mv "$REPO/qa-artifacts/${g}-result.xml" "$dest/result.xml" >/dev/null 2>&1)
  echo "    filed -> $dest"
done
echo "=== SWEEP COMPLETE $(date -Iseconds) ==="
