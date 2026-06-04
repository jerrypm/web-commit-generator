# Commit — Git Commit Message Generator

Clean, offline tool that turns plain-language change descriptions into
[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) messages.
Pure HTML/CSS/JS — no frameworks, no CDNs, no backend.

![Commit generator preview](image-preview.png)

## Features

- **11-type chip grid** (`feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`, `perf`, `build`, `ci`, `revert`) with color dots + live explanation. Auto-detects type from your wording unless you pick one.
- **Description input** normalized to an imperative subject — strips filler, drops redundant nouns (`fix bug` → `fix`), converts past tense (`added` → `add`), picks context verbs (crash → `prevent`, error → `handle`).
- **Optional scope** with suggestion chips + keyword inference (`logout` → `auth`).
- **Preview card** with color-coded length meter against the 50/72-char limits and one-click copy.
- **Quality score** /100 across Clarity · Grammar · Conventional · Brevity.
- **3 alternatives**, each tap-to-copy.
- **Recent history** (localStorage), **dark/light toggle** (persists), `⌘/Ctrl+↵` to generate.
- Fully responsive desktop + mobile.

## Run

No build step. Open the file:

```bash
open index.html
```

Or serve locally:

```bash
python3 -m http.server 8000
# visit http://localhost:8000
```

## Files

| File | Purpose |
|------|---------|
| `index.html` | Markup: header, input/output panels, history, footer, toast |
| `styles.css` | Design tokens, dark/light themes, layout, components |
| `script.js` | Rule-based generation engine + UI wiring |

## How it works

The engine is deterministic and rule-based (no network, no LLM). It normalizes
wording, infers type/scope, rewrites the description into an imperative subject,
scores quality, and produces alternative phrasings. Ambiguous or very complex
sentences clean up less fluidly than an LLM would — by design, for full offline use.

## Example

Input:

```
fix bug when user logout and app crash
```

Output:

```
fix: prevent app crash during logout
```
