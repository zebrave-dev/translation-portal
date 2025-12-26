# Translation Portal

Private translation management system for Kingshot Gear Optimizer (gear_optimizer).

## Repository Structure

```
translation-portal/
├── data/
│   ├── source-strings.json          # All extracted English strings (2,092 strings, 107K chars)
│   ├── glossary.json                 # Gaming terms glossary (50+ terms, 10 categories)
│   └── translations/
│       ├── ko.json                   # Korean (AI pre-translated)
│       ├── es.json                   # Spanish (started)
│       ├── pt.json                   # Portuguese (AI pre-translated)
│       └── fr.json                   # French (started)
├── scripts/
│   ├── extract_strings.py            # Pulls strings from gear_optimizer
│   ├── export_translations.py        # Pushes translations to app
│   └── ai_translate.py               # Batch AI pre-translation (Google Translate)
├── site/
│   ├── index.html                    # Main translator UI
│   ├── app.js                        # UI logic
│   ├── style.css                     # Styling
│   ├── glossary-curation.html        # Admin tool for glossary decisions
│   └── data/                         # Deployed data (copy from /data before deploy)
│       ├── source-strings.json
│       ├── glossary.json
│       ├── translations/
│       └── glossary-curation-data.json
└── README.md
```

## Deployment

- **Hosting**: Cloudflare Pages at `translation-portal.pages.dev`
- **Access Control**: Cloudflare Zero Trust (configured Dec 2025)
- **SEO**: Blocked via robots.txt and meta tags
- **Data sync**: Copy `data/` files to `site/data/` before committing for deployment

## Key Workflows

### 1. Extract Strings from gear_optimizer
```bash
python3 scripts/extract_strings.py
```
Extracts from:
- `gear_optimizer/src/components/**/*.vue` - Vue template text
- `gear_optimizer/content/**/*.md` - Markdown content

Note: Extraction pulls from local gear_optimizer repo. Keep that repo on the staging branch to translate ahead of production.

### 2. Sync Data for Deployment
After extraction or translation changes:
```bash
cp data/source-strings.json site/data/
cp data/glossary.json site/data/
cp -r data/translations site/data/
```

### 3. AI Pre-Translation
```bash
python3 scripts/ai_translate.py          # All languages
python3 scripts/ai_translate.py ko       # Specific language
```
Uses Google Translate via `deep_translator` package. Saves as `ai_suggestion` for human review.

### 4. Human Translation (Web UI)
1. Start local server: `cd site && python3 -m http.server 8080`
2. Or visit deployed site (requires Zero Trust auth)
3. Select language, review AI suggestions, approve translations
4. Export translations to download

### 5. Export to App
```bash
python3 scripts/export_translations.py
python3 scripts/export_translations.py --lang ko --dry-run
```
Generates:
- `gear_optimizer/src/locales/{lang}.json` - Vue-i18n format

## Translator UI Features

### Main View (index.html)
- **Progress bar**: Shows approved/submitted/draft percentages by character count
- **Section sidebar**: Navigate by source file, shows completion count
- **Filters**: All, Pending, Needs Review, Drafts, Submitted, Approved
- **Status workflow**: Pending → Draft → Submitted → Approved
- **AI suggestions**: "Use AI" button copies suggestion to input
- **Local storage**: Auto-saves drafts locally

### Glossary View
- **Gaming terms**: Consistent translations for Kingshot-specific terms
- **Categories**: Troop types, resources, gear materials, stats, UI terms
- **Priority**: Use official in-game translations when available

### Glossary Curation Tool (glossary-curation.html)
- **Admin only** - Red warning banner, accessible via main UI
- Admin tool to decide which terms go into v1 glossary
- Compares website terms vs code-extracted terms
- Shows usage examples from codebase
- Export curated glossary as JSON

## Languages

| Code | Language | Status | AI Pre-translated |
|------|----------|--------|-------------------|
| ko | Korean | AI Ready | Yes |
| es | Spanish | Not Started | Partial |
| pt | Portuguese (BR) | AI Ready | Yes |
| fr | French | Not Started | Partial |

## Data Formats

### source-strings.json
```json
{
  "meta": {
    "total_strings": 2092,
    "total_chars": 106756
  },
  "sections": {
    "gear_optimizer/vue/components/CostTables": {
      "source_file": "src/components/CostTables.vue",
      "type": "vue_component",
      "strings": [
        {
          "id": "vue.components.CostTables.0",
          "en": "Cavalry Helmet & Chest",
          "chars": 22,
          "hash": "c82c8aaa"
        }
      ]
    }
  }
}
```

### translations/{lang}.json
```json
{
  "_meta": { "language": "ko" },
  "glossary": {
    "Infantry": {
      "text": "보병",
      "ai_suggestion": "보병",
      "status": "approved",
      "official_game_term": true
    }
  },
  "vue.components.CostTables.0": {
    "text": "기병 투구 & 갑옷",
    "ai_suggestion": "기병 투구 및 가슴",
    "status": "approved",
    "translator": "Kim",
    "timestamp": "2025-12-23T..."
  }
}
```

## Translation Status Values

- `pending` - Not yet touched
- `needs_review` - Has AI suggestion, needs human review
- `draft` - Human started editing
- `submitted` - Ready for review
- `approved` - Verified and ready for export

## Dependencies

```bash
pip3 install deep-translator  # For AI translation script
```

## Security Notes

- **PRIVATE REPO** - Do not make public
- No API keys in code (uses free Google Translate)
- Zero Trust authentication required for deployed site
- Translator names stored for attribution

## Integration with gear_optimizer

```
┌────────────────────┐     extract      ┌──────────────────┐
│   gear_optimizer   │ ───────────────> │  translation-    │
│   (Vue app)        │                  │     portal       │
│                    │                  │                  │
│   /staging branch  │                  │  source-strings  │
│                    │                  │  translations/   │
└────────────────────┘                  └────────┬─────────┘
                                                 │
                                                 │ export
                                                 v
                                    ┌────────────────────┐
                                    │   gear_optimizer   │
                                    │   /src/locales/    │
                                    └────────────────────┘
```

## TODO / Next Steps

1. **Finish glossary curation** - Mark all terms as include/later/no
2. **Korean translation** - Highest priority, has AI suggestions ready
3. **Portuguese translation** - Second priority after Korean
4. **Implement server-side save** - Currently uses localStorage + file download
5. **Add sync/diff for source changes** - `--sync` flag exists but not fully implemented
