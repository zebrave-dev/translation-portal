#!/usr/bin/env python3
"""
Export approved translations back to gear_optimizer.

Generates:
- gear_optimizer/src/locales/{lang}.json (for vue-i18n)

Usage:
    python3 scripts/export_translations.py           # Export all languages
    python3 scripts/export_translations.py --lang ko # Export specific language
    python3 scripts/export_translations.py --dry-run # Preview without writing
"""

import json
import os
import argparse
from pathlib import Path
from datetime import datetime

# Paths
DATA_PATH = Path("/Users/albertajstamper/dev/translation-portal/data")
GEAR_OPTIMIZER_PATH = Path("/Users/albertajstamper/dev/gear_optimizer")

LANGUAGES = ["ko", "es", "pt", "fr"]

def load_source_strings():
    """Load the source strings file."""
    source_file = DATA_PATH / "source-strings.json"
    with open(source_file, 'r', encoding='utf-8') as f:
        return json.load(f)

def load_translations(lang):
    """Load translations for a specific language."""
    trans_file = DATA_PATH / "translations" / f"{lang}.json"
    if trans_file.exists():
        with open(trans_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def export_gear_optimizer(lang, translations, source_data, dry_run=False):
    """
    Export translations for gear_optimizer in vue-i18n format.

    Output format:
    {
        "nav": {
            "dashboard": "대시보드",
            "settings": "설정"
        },
        "faq": {
            "q1": "질문 1",
            "a1": "답변 1"
        }
    }
    """
    output = {}
    exported_count = 0

    for section_name, section_data in source_data["sections"].items():
        if not section_name.startswith("gear_optimizer/"):
            continue

        for string_data in section_data["strings"]:
            string_id = string_data["id"]

            # Check if we have a translation
            if string_id in translations:
                trans_entry = translations[string_id]
                # Only export approved or submitted translations
                if trans_entry.get("status") in ["approved", "submitted", "draft"]:
                    # Convert dot notation to nested dict
                    # e.g., "gear_optimizer.vue.layout.AppHeader.0" -> nested structure
                    keys = string_id.split(".")

                    # Simplify the key structure for vue-i18n
                    # Take the last meaningful parts
                    if len(keys) >= 3:
                        category = keys[-2] if keys[-2] not in ["header", "paragraph", "list_item"] else keys[-3]
                        index = keys[-1]
                        simple_key = f"{category}.{index}"
                    else:
                        simple_key = string_id

                    # Build nested structure
                    current = output
                    key_parts = simple_key.split(".")
                    for part in key_parts[:-1]:
                        if part not in current:
                            current[part] = {}
                        current = current[part]
                    current[key_parts[-1]] = trans_entry.get("text", "")
                    exported_count += 1

    # Also create a flat version for easier lookup
    flat_output = {
        "_meta": {
            "language": lang,
            "exported_at": datetime.now().isoformat(),
            "string_count": exported_count
        },
        "strings": {}
    }

    for section_name, section_data in source_data["sections"].items():
        if not section_name.startswith("gear_optimizer/"):
            continue
        for string_data in section_data["strings"]:
            string_id = string_data["id"]
            if string_id in translations:
                trans_entry = translations[string_id]
                if trans_entry.get("status") in ["approved", "submitted", "draft"]:
                    flat_output["strings"][string_id] = {
                        "en": string_data["en"],
                        lang: trans_entry.get("text", ""),
                        "status": trans_entry.get("status")
                    }

    # Output paths
    locales_dir = GEAR_OPTIMIZER_PATH / "src" / "locales"

    if not dry_run:
        locales_dir.mkdir(parents=True, exist_ok=True)

        # Write nested format (for vue-i18n)
        nested_file = locales_dir / f"{lang}.json"
        with open(nested_file, 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2, ensure_ascii=False)

        # Write flat format (for easy lookup)
        flat_file = locales_dir / f"{lang}-flat.json"
        with open(flat_file, 'w', encoding='utf-8') as f:
            json.dump(flat_output, f, indent=2, ensure_ascii=False)

        print(f"  Exported {exported_count} strings to {nested_file}")
    else:
        print(f"  [DRY RUN] Would export {exported_count} strings to {locales_dir}/{lang}.json")

    return exported_count

def main():
    parser = argparse.ArgumentParser(description='Export translations to gear_optimizer')
    parser.add_argument('--lang', help='Export specific language only')
    parser.add_argument('--dry-run', action='store_true', help='Preview without writing')
    args = parser.parse_args()

    languages = [args.lang] if args.lang else LANGUAGES

    print("=" * 60)
    print("EXPORT TRANSLATIONS")
    print("=" * 60)

    source_data = load_source_strings()
    print(f"Loaded {source_data['meta']['total_strings']} source strings")
    print()

    total_exported = 0

    for lang in languages:
        print(f"\n[{lang.upper()}]")
        translations = load_translations(lang)

        if not translations:
            print(f"  No translations found for {lang}")
            continue

        # Count by status
        status_counts = {}
        for entry in translations.values():
            status = entry.get("status", "unknown")
            status_counts[status] = status_counts.get(status, 0) + 1

        print(f"  Loaded {len(translations)} translations")
        for status, count in status_counts.items():
            print(f"    - {status}: {count}")

        # Export to gear_optimizer
        gear_count = export_gear_optimizer(lang, translations, source_data, args.dry_run)
        total_exported += gear_count

    print(f"\n{'=' * 60}")
    print(f"TOTAL EXPORTED: {total_exported} strings")
    print("=" * 60)

if __name__ == "__main__":
    main()
