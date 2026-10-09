#!/usr/bin/env bash
# 076-f — rebuild current-device game evidence rows from the ARTEMIS sessions.
#
# The sweep's client log records the ARTEMIS session UUID ("Session: <uuid>"),
# and the session dir holds notes/game_state_review_log.md. Matching on the test
# name inside stdout.log does NOT work: the daemon never writes the test name
# there, so a naive lookup silently files "no note produced" over evidence that
# actually exists. This harvester keys on the session UUID instead.
#
# It also reclassifies a row honestly: a session whose review note is missing is
# filed as NOT VALIDATED rather than as a plausible-looking empty row.
#
# Run after the sweep:  bash scripts/qa/cert076f-harvest.sh
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

mkdir -p "$EV"

# NEVER clobber a row a reviewer has already accepted. manual-review.json is the
# reviewer's verdict record; if it marks this game PASS or FIXED, its review.md is
# evidence that has already been inspected and must be left exactly as filed.
# (Learned the hard way: the harvester overwrote an accepted flexibility-color-
# stroop row and the content had to be restored from git.)
accepted_status() {
  python -c "
import json,sys,os
p=os.path.join('openspec/changes/076-f-final-product-certification/evidence/current-device/manual-review.json')
try:
    v=json.load(open(p,encoding='utf-8')).get('verdicts',{}).get(sys.argv[1],{})
    print(v.get('status',''))
except Exception:
    print('')
" "$1" 2>/dev/null
}

harvested=0
missing=0

for dest in "$EV"/*/; do
  g="$(basename "$dest")"
  if [ "$(accepted_status "$g")" = "PASS" ] || [ "$(accepted_status "$g")" = "FIXED" ]; then
    echo "[skip-accepted] $g"
    continue
  fi
  log="$dest/artemis.log"
  [ -s "$log" ] || continue

  # Session UUID printed by the ARTEMIS CLI client. The client wraps the line
  # ("... (Session:" then the UUID on the next line), so match the UUID shape
  # rather than the "Session:" prefix - and use the LAST one in the file, which
  # is the run this row belongs to.
  sess=$(grep -oE "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}" "$log" | tail -1)
  note=""
  # ONLY the client-log session UUID is trusted. A fallback that scanned nearby
  # sessions by name matching produced real mis-attribution (attention-target-
  # count was filed from attention-sustained-vigilance's session) - the exact
  # failure this review process exists to catch. If the UUID does not resolve to
  # a note, the row is NOT VALIDATED. No guessing.
  # The controller does not always honour the requested note key: it has been
  # observed writing the review under 'journey_observations' instead. Accept any
  # note in the session that carries the state-review headings, preferring the
  # requested key. Matching on CONTENT (not filename) is what makes this robust.
  if [ -n "${sess:-}" ]; then
    for cand in "$ARTEMIS/traces/$sess/notes/game_state_review_log.md"                 "$ARTEMIS/traces/$sess/notes/journey_observations.md"; do
      if [ -s "$cand" ] && grep -qiE "^## .*Active Play Board|^## 1\. Active" "$cand"; then
        note="$cand"
        break
      fi
    done
    if [ -z "$note" ]; then
      for cand in "$ARTEMIS/traces/$sess/notes/"*.md; do
        if [ -s "$cand" ] && grep -qiE "^## .*Active Play Board|^## 1\. Active" "$cand" 2>/dev/null; then
          note="$cand"
          break
        fi
      done
    fi
  fi

  # A note that is still an unfilled skeleton is NOT evidence. The controller
  # writes the headings first and fills them in as it plays, so a run cut short
  # leaves "(To be populated)" / "(To be filled during execution)" /
  # "(Pending observation)" in place of observations. That must not be filed as
  # a reviewed row - it is the "filename as feedback" failure the change spec
  # forbids, in note form.
  if [ -n "$note" ] && grep -qiE "to be (filled|populated|recorded)|pending (execution|observation|review)|\[pending|\(pending|not yet (filled|recorded|observed)" "$note"; then
    echo "[skeleton-note] $g — unfilled skeleton, treating as no-note"
    note=""
  fi

  # A note must also contain real observed content: at least four non-empty,
  # non-heading body lines. A three-line skeleton is not a reviewed state.
  if [ -n "$note" ]; then
    body_lines=$(grep -cE '^[^#[:space:]].{15,}' "$note")
    if [ "${body_lines:-0}" -lt 4 ]; then
      echo "[thin-note] $g — only ${body_lines:-0} substantive lines, treating as no-note"
      note=""
    fi
  fi

  if [ -z "$note" ]; then
    missing=$((missing + 1))
    echo "[no-note] $g"
  else
    harvested=$((harvested + 1))
    echo "[ok] $g  <- $sess"
  fi

  {
    echo "# Current-device acceptance — \`$g\`"
    echo
    echo "- Controller: external ARTEMIS (D:\\Tools\\artemis), profile \`pro\` (lean: checker/step-summarizer/committee/planner-validation/video disabled - see ../../CONTROLLER.md)"
    echo "- Locked app: \`com.braintraining.app\`"
    echo "- ARTEMIS session: \`${sess:-unknown}\` (raw trace external to Git)"
    echo "- Device: emulator-5554 / AVD braintraining-ui35"
    echo "- APK under test: \`de6c5fcd19de2428af39b5f44a8e80ee1a9a037c4848c98ddb05ddcfd678903d\` (48,888,204 bytes, com.braintraining.app 0.1.0/1000)"
    echo "- Controller review note: $([ -n "$note" ] && echo 'PRESENT' || echo 'ABSENT — this row is NOT VALIDATED')"
    echo
    echo "## Controller state-review log (scrubbed)"
    echo
    if [ -n "$note" ]; then
      cat "$note"
    else
      echo "_No controller review note was produced. **This game is NOT VALIDATED.**_"
      echo "_See the session log for the failure; the device frame below is not acceptance._"
    fi
  } >"$dest/review.md"
done

echo "=== harvest complete: $harvested rows with notes, $missing without ==="
