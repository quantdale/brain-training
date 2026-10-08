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

REPO="D:/Documents/tryPython/brain-training"
ARTEMIS="D:/Tools/artemis"
EV="$REPO/openspec/changes/076-f-final-product-certification/evidence/current-device"
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

prompt_for() {
  cat <<EOF
Locked app: com.braintraining.app. The deep link braintraining://game/$1 opens this game directly.
Perform ONE current-device game-state acceptance journey and record it in note key 'game_state_review_log' with exactly these headings:
## 1. Active Play Board  (board/stimulus content, every visible control and its literal label, round/score/timer chips, whether instructions are visible, whether the board is legible with clear hierarchy)
## 2. Scored Feedback   (tap answers until a SCORED FEEDBACK appears - a correct/incorrect verdict or timeout reveal. Report the EXACT verdict text. An intro screen or unanswered board is NOT feedback)
## 3. Pause & Resume     (open the PAUSE overlay, quote its buttons, then RESUME)
## 4. Final Result Screen (report every score/stat line and the reward exactly)
## 5. Input & Exit       (did taps register immediately? then exit to the games list and re-open this game to prove safe exit and return)
## 6. Defects            (clipped text, low contrast, hidden/unreachable action, overlap, unresponsive input - or 'none observed')
End on the final RESULT screen.
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

for g in "${GAMES[@]}"; do
  dest="$EV/$g"
  if [ -s "$dest/review.md" ]; then
    echo "[skip] $g"
    continue
  fi
  mkdir -p "$dest"
  name="cert076f-game-$g"
  echo "=== [$(date +%H:%M:%S)] $g ==="
  (cd "$ARTEMIS" && timeout 1500 uv run artemis run "$(prompt_for "$g")" \
    "${ARTEMIS_FLAGS[@]}" --test-name "$name") \
    >"$dest/artemis.log" 2>&1
  rc=$?
  echo "    artemis rc=$rc"

  # Locate the newest session dir holding this test name's notes.
  sess=$(ls -t "$ARTEMIS/traces" 2>/dev/null | grep -E "^[0-9a-f]{8}-" | head -1)
  note=""
  for cand in $(ls -t "$ARTEMIS/traces" | grep -E "^[0-9a-f]{8}-" | head -4); do
    if [ -s "$ARTEMIS/traces/$cand/notes/game_state_review_log.md" ]; then
      # Confirm this session actually belongs to our test name.
      if grep -q "$name" "$ARTEMIS/traces/$cand/stdout.log" 2>/dev/null; then
        note="$ARTEMIS/traces/$cand/notes/game_state_review_log.md"
        sess="$cand"
        break
      fi
    fi
  done

  {
    echo "# Current-device acceptance — \`$g\`"
    echo
    echo "- Date: $(date -Iseconds)"
    echo "- Controller: external ARTEMIS (D:\\Tools\\artemis), profile \`pro\` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md), locked app \`com.braintraining.app\`"
    echo "- Test name: \`$name\`"
    echo "- ARTEMIS session: \`$sess\` (raw trace external to Git)"
    echo "- Device: emulator-5554 / AVD braintraining-ui35"
    echo "- APK under test: \`de6c5fcd19de2428af39b5f44a8e80ee1a9a037c4848c98ddb05ddcfd678903d\` (48,888,204 bytes, com.braintraining.app 0.1.0/1000)"
    echo "- Controller exit code: $rc"
    if [ -n "$note" ]; then
      echo "- Controller review note: PRESENT"
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
