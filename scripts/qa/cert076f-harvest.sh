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

REPO="D:/Documents/tryPython/brain-training"
ARTEMIS="D:/Tools/artemis"
EV="$REPO/openspec/changes/076-f-final-product-certification/evidence/current-device"
export BT_AVD_NAME=braintraining-ui35

mkdir -p "$EV"
harvested=0
missing=0

for dest in "$EV"/*/; do
  g="$(basename "$dest")"
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
  if [ -n "${sess:-}" ] && [ -s "$ARTEMIS/traces/$sess/notes/game_state_review_log.md" ]; then
    note="$ARTEMIS/traces/$sess/notes/game_state_review_log.md"
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
