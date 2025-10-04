# Inventory: Big Files (initial)

This report lists large files worth reviewing for debloat. Update via CI script to keep current.

- Candidate directories to inspect:
  - `service-quackle/bridge/`, `quackle_fork/`, `logs/`, `data/`

TODO: Automate this report using a CI step (e.g., `git ls-files -z | xargs -0 du -h | sort -h | tail -n 100`).
