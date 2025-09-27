# Strategy Assets (derived)

This repository previously included strategy runtime assets under `data/appdata/strategy/`.
These files are generated or derived from Quackle distributions and should not be versioned.

Policy:
- Do not commit `data/appdata/strategy/**` contents.
- Keep directory structure with `.keep` placeholders only.
- Use runtime bootstrap scripts (see Wave 2 `bootstrap_lexica`) to provision assets.

Rationale:
- Reduce repository size and history bloat.
- Avoid licensing ambiguity for redistributed generated binaries.
- Ensure reproducibility via scripted bootstrap.
