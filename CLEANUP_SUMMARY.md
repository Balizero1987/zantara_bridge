Repository cleanup summary (automated)

Removed
- Duplicate files with suffix " 2.*" under src/** (ts, json, js, bak)
- Legacy JS duplicates in src/: services/{conversationMemory,languageDetection,openai}.js
- Stray file: {error:invalid api key}

Moved
- Root test files to scripts/tests/
- Scratch/examples to scripts/examples/

Ignored (git)
- Added deploy.log and out.json to .gitignore

Notes
- No runtime logic changed; endpoints and build config unaffected.
- Tests and examples continue to work from their new locations.

