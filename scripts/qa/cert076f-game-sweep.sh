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

REPO="D:/Documents/tryPython/brain-training"
ARTEMIS="D:/Tools/artemis"
EV="$REPO/openspec/changes/076-f-final-product-certification/evidence/current-device"
export BT_AVD_NAME=braintraining-ui35

GAMES=(
  attention-odd-one-out
  attention-sustained-vigilance
  attention-symbol-tracker
  attention-target-count
  attention-visual-search
  flexibility-card-sort
  flexibility-color-stroop
  flexibility-cue-shift
  flexibility-rule-flip
  flexibility-task-switch
  language-context-fit
  language-sentence-builder
  language-word-chain
  language-word-match
  language-word-scramble
  logic-code-cracker
  logic-deduction-table
  logic-next-sequence
  logic-order-path
  logic-rule-grid
  math-equation-builder
  math-fast-math
  math-missing-operator
  math-number-line-estimation
  math-value-ordering
  memory
  memory-grid-recall
  memory-pair-recall
  memory-pattern-tap-back
  memory-prospective-cue
  memory-running-order
  memory-sequence-memory
  spatial-coordinate-turn
  spatial-fold-match
  spatial-grid-nav
  spatial-mental-rotation
  spatial-transform-match
  speed-color-match
  speed-order-sweep
  speed-quick-compare
  speed-reaction-time
  speed-tap-rush
)

mkdir -p "$EV"

prompt_for() {
  cat <<EOF
Locked app: com.braintraining.app. The deep link braintraining://game/$1 opens this game directly.
Perform ONE current-device game-state acceptance journey and record it in note key 'game_state_review_log' using exactly these headings:
## 1. Active Play Board  (report the board/stimulus content, every visible control and its literal label, the round/score/timer chips, whether instructions are visible, and whether the board is legible with clear hierarchy)
## 2. Scored Feedback   (tap answers until a SCORED FEEDBACK appears - a correct/incorrect verdict or a timeout reveal. Report the EXACT verdict text. Do not treat an intro screen or an unanswered board as feedback)
## 3. Pause & Resume     (open the PAUSE overlay, confirm it rendered and quote its buttons, then RESUME back to active play)
## 4. Final Result Screen (continue play to the final RESULT screen and report every score/stat line and the reward exactly)
## 5. Input & Exit       (report whether taps registered immediately, then exit back to the games list and re-open this same game to prove safe exit and return)
## 6. Defects            (report any clipped text, low-contrast text, hidden or unreachable action, overlap, or unresponsive input. Write 'none observed' if there are none)
End with the app left on this game's final RESULT screen.
EOF
}

for g in "${GAMES[@]}"; do
  dest="$EV/$g"
  if [ -s "$dest/review.md" ]; then
    echo "[skip] $g"
    continue
  fi
  mkdir -p "$dest"
  name="cert076f-game-$g"
  echo "=== [$(date +%H:%M:%S)] $g ==="
  ( cd "$ARTEMIS" && timeout 1200 uv run artemis run "$(prompt_for "$g")" \
      --profile pro --locked-app com.braintraining.app --test-name "$name" ) \
      > "$dest/artemis.log" 2>&1
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
    echo "- Controller: external ARTEMIS (D:\\Tools\\artemis), profile \`pro\`, locked app \`com.braintraining.app\`"
    echo "- Test name: \`$name\`"
    echo "- ARTEMIS session: \`$sess\` (raw trace external to Git)"
    echo "- Device: emulator-5554 / AVD braintraining-ui35"
    echo "- APK under test: \`de6c5fcd19de2428af39b5f44a8e80ee1a9a037c4848c98ddb05ddcfd678903d\` (48,888,204 bytes, com.braintraining.app 0.1.0/1000)"
    echo "- Controller exit code: $rc"
    echo
    echo "## Controller state-review log (scrubbed)"
    echo
    if [ -n "$note" ]; then
      cat "$note"
    else
      echo "_No controller review note was produced; see artemis.log tail._"
    fi
    echo
    echo "## Device frame filed alongside"
    echo
    echo "\`result.png\` + \`result.xml\` are captured from the terminal APK on the"
    echo "current device after the journey, and are the reviewer's independent check"
    echo "on the controller report above."
  } > "$dest/review.md"

  ( cd "$REPO" && bash scripts/android/screenshot.sh --dir "$dest" --name result >/dev/null 2>&1 )
  # hierarchy.sh --save is anchored to qa-artifacts/, so capture then move.
  ( cd "$REPO" && bash scripts/android/hierarchy.sh --save "${g}-result.xml" >/dev/null 2>&1 \
      && mv "$REPO/qa-artifacts/${g}-result.xml" "$dest/result.xml" >/dev/null 2>&1 )
  echo "    filed -> $dest"
done
echo "=== SWEEP COMPLETE $(date -Iseconds) ==="
