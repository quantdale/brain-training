#!/usr/bin/env bash
# 076-f — re-run ONLY the games whose current-device row is NOT VALIDATED.
#
# The generic sweep prompt produced three failure modes that were caught by
# review rather than silently filed:
#   1. the controller mis-navigated and played a DIFFERENT game (a detailed,
#      convincing note about the wrong board);
#   2. the note was an unfilled skeleton ("(To be populated)");
#   3. the run died before producing a note at all.
#
# This repair pass tightens the prompt against (1) specifically: the controller
# must first READ the on-screen game title and restate it verbatim, and must
# stop and report NOT THE TARGET GAME if it does not match. Identity is then
# checked by the reviewer, not inferred.
#
# It does not overwrite a row that a reviewer has already marked PASS in
# current-device/manual-review.json.
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

GAMES=("${@:-}")

prompt_for() {
  cat <<EOF
Locked app: com.braintraining.app.
STEP -1 - RESET (mandatory, do this BEFORE anything else):
Force-stop and cold-launch the app first. A deep link delivered to an app that
is ALREADY FOREGROUND on a different game is silently ignored (Android reports
"Activity not started, intent has been delivered to currently running top-most
instance") and you will play the WRONG game. So: force-stop com.braintraining.app,
launch it fresh, THEN open the deep link. Confirm the reset worked by checking
that the game title changed.

STEP 0 - IDENTITY CHECK (do this FIRST and do not skip it):
Open the deep link braintraining://game/$1. Read the game title actually shown
on screen. In your note, the VERY FIRST line must be exactly:
  On-screen game title: <the title you read>
If the title you read does not correspond to the game "$1", STOP IMMEDIATELY,
write the note with first line 'WRONG GAME: <title you saw>' and report status
'failed'. Do not play a different game.

STEP 1 - JOURNEY (only if identity matched):
Play the journey FIRST and observe everything. Do NOT create the note until the
journey is finished and you have real observations for every heading. A note
created early with placeholder text is worthless and will be discarded.

Only then write note key 'game_state_review_log' with exactly these headings:
## 1. Active Play Board  (board/stimulus content, EVERY visible control and its
   literal label, round/score/timer chips, whether instructions are visible,
   whether the board is legible with clear hierarchy)
## 2. Scored Feedback   (tap answers until a SCORED FEEDBACK appears - a
   correct/incorrect verdict or timeout reveal. Quote the EXACT verdict text.
   An intro screen or an unanswered board is NOT feedback)
## 3. Pause & Resume     (open the PAUSE overlay, quote its buttons, then RESUME)
## 4. Final Result Screen (report every score/stat line and the reward exactly)
## 5. Input & Exit       (did taps register immediately? then exit to the games
   list and re-open this same game to prove safe exit and return)
## 6. Defects            (clipped text, low contrast, hidden/unreachable action,
   overlap, unresponsive input - or 'none observed')

Do not write '(To be populated)', '(To be filled during execution)',
'(Pending observation)' or any placeholder. Every heading must contain a real
observation you actually made, or the literal 'not reached'. If you cannot
complete a heading, write 'not reached' - never a promise to fill it in later.
End on the final RESULT screen.
EOF
}

ARTEMIS_FLAGS=(
  --profile pro
  --locked-app com.braintraining.app
  --disable-step-summarizer
  --disable-checker
  --without-video-recording-tools
  --disable-committee
  --disable-planner-validation
)

for g in ${GAMES[@]+"${GAMES[@]}"}; do
  dest="$EV/$g"
  mkdir -p "$dest"
  # Never clobber a row the reviewer already passed.
  if [ -s "$dest/../manual-review.json" ] && grep -q "\"$g\"" "$dest/../manual-review.json" &&
    grep -A3 "\"$g\"" "$dest/../manual-review.json" | grep -q '"status": "PASS"'; then
    echo "[skip-passed] $g"
    continue
  fi
  echo "=== [$(date +%H:%M:%S)] REPAIR $g ==="
  (cd "$ARTEMIS" && timeout 2400 uv run artemis run "$(prompt_for "$g")" \
    "${ARTEMIS_FLAGS[@]}" --test-name "cert076f-game-$g") >"$dest/artemis.log" 2>&1
  echo "    rc=$? sess=$(grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' "$dest/artemis.log" | tail -1)"
done
echo "=== REPAIR PASS COMPLETE $(date -Iseconds) ==="
