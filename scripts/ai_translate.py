#!/usr/bin/env python3
"""
AI Translation Script - Uses Google Translate (free) to pre-translate strings.
Saves translations as ai_suggestion for human review.
"""

import json
import time
import sys
from pathlib import Path
from deep_translator import GoogleTranslator

# Force unbuffered output
import functools
print = functools.partial(print, flush=True)

# Language codes for Google Translate
LANGUAGE_MAP = {
    'ko': 'ko',     # Korean
    'es': 'es',     # Spanish
    'pt': 'pt',     # Portuguese (Portugal) - deep-translator uses 'pt' for European
    'fr': 'fr',     # French
}

def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def translate_text(text, target_lang, retries=3):
    """Translate text with retry logic."""
    for attempt in range(retries):
        try:
            translator = GoogleTranslator(source='en', target=target_lang)
            result = translator.translate(text)
            return result
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(1)  # Rate limit protection
            else:
                print(f"  Failed to translate: {str(e)[:50]}")
                return None
    return None

def translate_strings(source_strings, translations, target_lang, skip_existing=True):
    """Translate all strings for a language."""
    google_lang = LANGUAGE_MAP.get(target_lang, target_lang)
    total = 0
    translated = 0
    skipped = 0

    for section_name, section_data in source_strings['sections'].items():
        for string in section_data['strings']:
            total += 1
            string_id = string['id']
            english_text = string['en']

            # Skip if already has AI suggestion
            if skip_existing and string_id in translations:
                if translations[string_id].get('ai_suggestion'):
                    skipped += 1
                    continue

            # Translate
            result = translate_text(english_text, google_lang)

            if result:
                if string_id not in translations:
                    translations[string_id] = {}

                translations[string_id]['ai_suggestion'] = result

                # Only set status if not already translated by human
                if not translations[string_id].get('text'):
                    translations[string_id]['status'] = 'needs_review'

                translated += 1

                # Progress indicator
                if translated % 50 == 0:
                    print(f"  Translated {translated} strings...")

                # Rate limiting - be nice to the free API
                time.sleep(0.1)

    return total, translated, skipped

def translate_glossary(glossary, translations, target_lang):
    """Translate glossary terms."""
    google_lang = LANGUAGE_MAP.get(target_lang, target_lang)
    translated = 0

    if 'glossary' not in translations:
        translations['glossary'] = {}

    for category_key, category_data in glossary['categories'].items():
        terms_list = category_data.get('terms', [])
        for term_data in terms_list:
            term = term_data['en']  # English term

            # Skip if already has AI suggestion
            if term in translations['glossary'] and translations['glossary'][term].get('ai_suggestion'):
                continue

            # Translate the term
            result = translate_text(term, google_lang)

            if result:
                if term not in translations['glossary']:
                    translations['glossary'][term] = {}

                translations['glossary'][term]['ai_suggestion'] = result
                if not translations['glossary'][term].get('text'):
                    translations['glossary'][term]['status'] = 'needs_review'

                translated += 1
                time.sleep(0.1)

    return translated

def main():
    script_dir = Path(__file__).parent
    data_dir = script_dir.parent / 'data'

    # Load source data
    print("Loading source strings...")
    source_strings = load_json(data_dir / 'source-strings.json')
    glossary = load_json(data_dir / 'glossary.json')

    total_strings = source_strings['meta']['total_strings']
    print(f"Found {total_strings} strings to translate")

    # Languages to translate
    languages = list(LANGUAGE_MAP.keys())

    # Check for specific language argument
    if len(sys.argv) > 1:
        lang_arg = sys.argv[1]
        if lang_arg in LANGUAGE_MAP:
            languages = [lang_arg]
        else:
            print(f"Unknown language: {lang_arg}")
            print(f"Available: {', '.join(LANGUAGE_MAP.keys())}")
            sys.exit(1)

    for lang in languages:
        print(f"\n{'='*50}")
        print(f"Translating to {lang.upper()}...")
        print('='*50)

        # Load existing translations
        trans_file = data_dir / 'translations' / f'{lang}.json'
        if trans_file.exists():
            translations = load_json(trans_file)
        else:
            translations = {'_meta': {'language': lang, 'code': lang}}

        # Translate glossary first
        print("\nTranslating glossary terms...")
        glossary_count = translate_glossary(glossary, translations, lang)
        print(f"  Translated {glossary_count} glossary terms")

        # Translate strings
        print("\nTranslating page strings...")
        total, translated, skipped = translate_strings(
            source_strings,
            translations,
            lang,
            skip_existing=True
        )
        print(f"  Total: {total}, Translated: {translated}, Skipped: {skipped}")

        # Save
        save_json(trans_file, translations)
        print(f"\nSaved to {trans_file}")

    print("\n" + "="*50)
    print("DONE! AI suggestions added to translation files.")
    print("Translators can now review in the portal.")
    print("="*50)

if __name__ == '__main__':
    main()
