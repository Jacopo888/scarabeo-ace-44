# Inventory: Long Files (initial)

List of longest files by LOC to aid refactoring. Update via CI script to keep current.

- Expected top candidates: `service-quackle/quackle_service/main.py`, large configs.

TODO: Automate using a CI step (e.g., `git ls-files | xargs wc -l | sort -n | tail -n 100`).
