# Inventory: Big Files (initial)

This report lists large files worth reviewing for debloat. Update via CI script to keep current.

- Candidate directories to inspect:
  - `service-quackle/bridge/`, `quackle_fork/`, `logs/`, `data/`
  - Nota: `engine/` è legacy e non è più usato per build runtime; può rimanere pesante se presente localmente ma non influisce sul deploy.

TODO: Automate this report using a CI step (e.g., `git ls-files -z | xargs -0 du -h | sort -h | tail -n 100`).
