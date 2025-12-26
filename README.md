# Translation Portal

Private translation management system for Kingshot tools.

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          TRANSLATION WORKFLOW                            │
└─────────────────────────────────────────────────────────────────────────┘

   SOURCE REPOS                    TRANSLATION PORTAL                 OUTPUT
   ───────────                     ──────────────────                 ──────

 ┌──────────────────┐            ┌──────────────────┐          ┌──────────────────┐
 │  gear_optimizer  │            │                  │          │  gear_optimizer  │
 │  *.vue, *.md     │ ──────────>│  source-strings  │          │  /locales/       │
 └──────────────────┘  extract   │      .json       │          │    ko.json       │
                                 │                  │          │    es.json       │
 ┌──────────────────┐            │  2,657 strings   │          │    pt.json       │
 │ kingshot-data    │ ──────────>│  120,366 chars   │          │    fr.json       │
 │  templates/*.html│  extract   │                  │          └────────┬─────────┘
 └──────────────────┘            └────────┬─────────┘                   │
                                          │                             │
                                          v                             │
                                 ┌──────────────────┐                   │
                                 │  TRANSLATOR UI   │                   │
                                 │  (site/index.html)│                   │
                                 │                  │                   │
                                 │  • AI suggestion │                   │
                                 │  • Human edit    │                   │
                                 │  • Approve       │                   │
                                 └────────┬─────────┘                   │
                                          │                             │
                                          v                             │
                                 ┌──────────────────┐                   │
                                 │  translations/   │                   │
                                 │    ko.json       │ ──────────────────┤
                                 │    es.json       │     export        │
                                 │    pt.json       │                   │
                                 │    fr.json       │                   │
                                 └──────────────────┘                   │
                                                                        v
                                                              ┌──────────────────┐
                                                              │ kingshot-data    │
                                                              │ /scripts/locales/│
                                                              │    ko.json       │
                                                              └──────────────────┘
```

## Quick Start

### 1. Extract strings from source repos
```bash
python3 scripts/extract_strings.py
```

### 2. Start translator UI
```bash
# Option A: Python simple server
cd site && python3 -m http.server 8080

# Option B: Use Live Server in VS Code
```
Open http://localhost:8080

### 3. Export approved translations to apps
```bash
python3 scripts/export_translations.py
```

## Directory Structure

```
translation-portal/
├── data/
│   ├── source-strings.json      # All extracted English text
│   ├── translations/
│   │   ├── ko.json              # Korean translations
│   │   ├── es.json              # Spanish translations
│   │   ├── pt.json              # Portuguese translations
│   │   └── fr.json              # French translations
│   └── snapshots/               # Version history for diffing
├── scripts/
│   ├── extract_strings.py       # Pull strings from source repos
│   ├── export_translations.py   # Push translations to apps
│   ├── sync_changes.py          # Detect source string changes
│   └── ai_translate.py          # Batch AI pre-translation
├── site/
│   ├── index.html               # Translator UI
│   ├── app.js                   # UI logic
│   └── style.css                # Styling
└── README.md
```

## Languages

| Code | Language | Status |
|------|----------|--------|
| ko | Korean | 🆕 New |
| es | Spanish | 🆕 New |
| pt | Portuguese | 🆕 New |
| fr | French | 🆕 New |

## Statistics

- **Total strings**: 2,657
- **Total characters**: 120,366
- **Sections**: 60 (Vue components, markdown content, Jinja templates)

## Monthly Sync Process

1. Run extraction: `python3 scripts/extract_strings.py --sync`
2. Review flagged changes in UI (new strings, changed source text)
3. Assign to translators
4. Export when complete

## Security

This repo is **PRIVATE**. Do not:
- Push to public GitHub
- Share source-strings.json publicly
- Include API keys in commits
