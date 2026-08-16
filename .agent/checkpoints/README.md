# Durable Checkpoints

Use checkpoints at meaningful recovery boundaries during long campaigns, especially before/after large swarm waves or consequential migrations.

A checkpoint should summarize:

- current commit/working state
- completed work
- in-progress work
- next action
- validation evidence
- blockers/risks

Do not dump raw agent session transcripts, credentials, or Kimi wire/session files here.
