# Inkwell: browser extension for light novel translation

# Stack: WXT, pnpm

# Important function: translation
Doing quality translation is HARD.

We use various algorithm and trick to:
1. detect structure change using complex algorithm
2. Focus on detail such as whitespaces on line without actual content get trimmed to single newline(save token)

## Browser extension context
Browser extension has two part:
- background worker: can access resource like OPFS/indexDB
- context script: use context of tab, cannot access resource like OPFS/indexDB(avoid conflict with javascript on the site)
