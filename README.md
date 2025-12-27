# Translation Portal

Private translation management system for Kingshot Gear Optimizer.

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          TRANSLATION WORKFLOW                            │
└─────────────────────────────────────────────────────────────────────────┘

   SOURCE REPO                      TRANSLATION PORTAL                 OUTPUT
   ───────────                      ──────────────────                 ──────

 ┌──────────────────┐            ┌──────────────────┐          ┌──────────────────┐
 │  gear_optimizer  │            │                  │          │  gear_optimizer  │
 │  *.vue, *.md     │ ──────────>│  source-strings  │  ──────> │  /locales/       │
 └──────────────────┘  extract   │      .json       │  export  │    ko.json       │
                                 │                  │          │    es.json       │
                                 │  2,092 strings   │          │    pt.json       │
                                 │  106,756 chars   │          │    fr.json       │
                                 └────────┬─────────┘          └──────────────────┘
                                          │
                                          v
                                 ┌──────────────────┐
                                 │  TRANSLATOR UI   │
                                 │  (Cloudflare)    │
                                 │                  │
                                 │  • Google Trans  │
                                 │  • Human edit    │
                                 │  • Approve       │
                                 └────────┬─────────┘
                                          │
                                          v
                                 ┌──────────────────┐
                                 │  translations/   │
                                 │    ko.json       │
                                 │    es.json       │
                                 │    pt.json       │
                                 │    fr.json       │
                                 └──────────────────┘
```

## Quick Start

### 1. Extract strings from gear_optimizer
```bash
python3 scripts/extract_strings.py
```

### 2. AI pre-translate (optional)
```bash
python3 scripts/ai_translate.py pt  # Portuguese
python3 scripts/ai_translate.py ko  # Korean
```

### 3. Use translator UI
Visit the deployed site (Cloudflare Pages with Zero Trust auth)

### 4. Export approved translations to app
```bash
python3 scripts/export_translations.py
```

## Directory Structure

```
translation-portal/
├── data/
│   ├── source-strings.json      # All extracted English text
│   └── translations/
│       ├── ko.json              # Korean translations
│       ├── es.json              # Spanish translations
│       ├── pt.json              # Portuguese translations
│       └── fr.json              # French translations
├── scripts/
│   ├── extract_strings.py       # Pull strings from gear_optimizer
│   ├── export_translations.py   # Push translations to gear_optimizer
│   └── ai_translate.py          # Batch Google Translate pre-translation
├── site/
│   ├── index.html               # Translator UI
│   ├── app.js                   # UI logic
│   └── style.css                # Styling
├── functions/                   # Cloudflare Pages Functions (API)
│   └── api/
│       ├── auth.js              # User authentication
│       ├── translations/        # Save/load translations
│       └── glossary.js          # Glossary management
└── README.md
```

## Languages

| Code | Language | Status |
|------|----------|--------|
| ko | Korean | AI Ready |
| es | Spanish | New |
| pt | Portuguese | AI Ready |
| fr | French | New |

## Features

- **Source change detection**: Flags translations when English text changes
- **Contributor tracking**: Shows who translated what with percentages
- **Role-based access**: Admins can edit anything, translators only their own work
- **Google Translate suggestions**: AI pre-translation for faster workflow
- **Real-time save**: Cloudflare KV storage, no manual export needed

## Security

This repo is **PRIVATE**.
- Cloudflare Zero Trust authentication required
- Admin emails configured in functions/api/auth.js
