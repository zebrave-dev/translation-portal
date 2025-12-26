#!/usr/bin/env python3
"""
Extract all translatable strings from source repos.
Generates source-strings.json with all text to translate.

Usage:
    python3 scripts/extract_strings.py
    python3 scripts/extract_strings.py --sync  # Compare with previous extraction
"""

import json
import re
import os
import hashlib
from pathlib import Path
from datetime import datetime
import argparse

# Source repositories
GEAR_OPTIMIZER_PATH = Path("/Users/albertajstamper/dev/gear_optimizer")
OUTPUT_PATH = Path("/Users/albertajstamper/dev/translation-portal/data")

# Files/sections to exclude (developer documentation, not user-facing)
EXCLUDED_FILES = {
    "README.md",      # Developer documentation
    "CLAUDE.md",      # AI instructions
    "CHANGELOG.md",   # Dev changelog (different from user-facing release notes)
}

def hash_string(s):
    """Create short hash of string for change detection."""
    return hashlib.md5(s.encode()).hexdigest()[:8]

def extract_vue_strings(file_path):
    """Extract translatable strings from Vue components."""
    strings = []

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except:
        return strings

    # Extract from <template> section
    template_match = re.search(r'<template[^>]*>(.*?)</template>', content, re.DOTALL)
    if template_match:
        template = template_match.group(1)

        # Find text in common patterns:
        # 1. Button/label text: >Text<
        # 2. Placeholder attributes: placeholder="Text"
        # 3. Title attributes: title="Text"
        # 4. aria-label: aria-label="Text"

        # Pattern: >Text content< (excluding {{ }} interpolations for now)
        text_pattern = r'>([^<>{}\n]+?)<'
        for match in re.finditer(text_pattern, template):
            text = match.group(1).strip()
            if text and len(text) > 1 and not text.startswith(':') and not text.startswith('@'):
                # Filter out things that look like code
                if not re.match(r'^[\d\.\-\+\*\/\%\$\#\@]+$', text):
                    strings.append(text)

        # Pattern: placeholder="Text"
        attr_patterns = [
            r'placeholder="([^"]+)"',
            r'title="([^"]+)"',
            r'aria-label="([^"]+)"',
            r'label="([^"]+)"',
        ]
        for pattern in attr_patterns:
            for match in re.finditer(pattern, template):
                text = match.group(1).strip()
                if text and not text.startswith(':') and not text.startswith('{'):
                    strings.append(text)

    return list(set(strings))  # Dedupe

def extract_markdown_strings(file_path):
    """Extract translatable strings from Markdown files."""
    strings = []

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except:
        return strings

    # For markdown, we extract:
    # 1. Headers (lines starting with #)
    # 2. Paragraphs (blocks of text)
    # 3. List items

    lines = content.split('\n')
    current_block = []

    for line in lines:
        stripped = line.strip()

        # Headers
        if stripped.startswith('#'):
            header_text = re.sub(r'^#+\s*', '', stripped)
            if header_text:
                strings.append(('header', header_text))

        # List items
        elif stripped.startswith('- ') or stripped.startswith('* ') or re.match(r'^\d+\.\s', stripped):
            item_text = re.sub(r'^[-\*\d\.]+\s*', '', stripped)
            if item_text:
                strings.append(('list_item', item_text))

        # Paragraphs (non-empty lines that aren't code blocks)
        elif stripped and not stripped.startswith('```') and not stripped.startswith('|'):
            if current_block or stripped:
                current_block.append(stripped)

        # Empty line = end of paragraph
        elif not stripped and current_block:
            para = ' '.join(current_block)
            if para and len(para) > 10:  # Skip very short fragments
                strings.append(('paragraph', para))
            current_block = []

    # Don't forget last block
    if current_block:
        para = ' '.join(current_block)
        if para and len(para) > 10:
            strings.append(('paragraph', para))

    return strings

def extract_jinja_strings(file_path):
    """Extract translatable strings from Jinja2 templates."""
    strings = []

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except:
        return strings

    # Extract text from HTML elements
    # 1. Element text: >Text<
    # 2. Button/link text
    # 3. Table headers: <th>Text</th>
    # 4. Labels

    # Skip Jinja blocks {{ }} and {% %}
    # Pattern: >Text< but not {{ or {%
    text_pattern = r'>([^<>{%}]+?)<'
    for match in re.finditer(text_pattern, content):
        text = match.group(1).strip()
        if text and len(text) > 1:
            # Filter out whitespace-only and code-like strings
            if not re.match(r'^[\s\d\.\-\+\*\/\%\$\#\@\&\;]+$', text):
                if not text.startswith('{{') and not text.startswith('{%'):
                    strings.append(text)

    # Placeholder and title attributes
    attr_patterns = [
        r'placeholder="([^"{%]+)"',
        r'title="([^"{%]+)"',
        r'aria-label="([^"{%]+)"',
    ]
    for pattern in attr_patterns:
        for match in re.finditer(pattern, content):
            text = match.group(1).strip()
            if text:
                strings.append(text)

    return list(set(strings))

def extract_gear_optimizer():
    """Extract all strings from gear_optimizer repo."""
    sections = {}

    # 1. Vue Components
    vue_dir = GEAR_OPTIMIZER_PATH / "src" / "components"
    if vue_dir.exists():
        for vue_file in vue_dir.rglob("*.vue"):
            rel_path = vue_file.relative_to(GEAR_OPTIMIZER_PATH)
            section_name = f"vue/{rel_path.parent.name}/{vue_file.stem}"

            strings = extract_vue_strings(vue_file)
            if strings:
                sections[section_name] = {
                    "source_file": str(rel_path),
                    "type": "vue_component",
                    "strings": []
                }
                for i, text in enumerate(strings):
                    string_id = f"{section_name.replace('/', '.')}.{i}"
                    sections[section_name]["strings"].append({
                        "id": string_id,
                        "en": text,
                        "chars": len(text),
                        "hash": hash_string(text)
                    })

    # 2. Markdown Content
    content_dir = GEAR_OPTIMIZER_PATH / "content"
    if content_dir.exists():
        for md_file in content_dir.rglob("*.md"):
            # Skip excluded files (developer documentation)
            if md_file.name in EXCLUDED_FILES:
                continue

            rel_path = md_file.relative_to(GEAR_OPTIMIZER_PATH)
            section_name = f"content/{md_file.stem}"

            strings = extract_markdown_strings(md_file)
            if strings:
                sections[section_name] = {
                    "source_file": str(rel_path),
                    "type": "markdown",
                    "strings": []
                }
                for i, (str_type, text) in enumerate(strings):
                    string_id = f"{section_name.replace('/', '.')}.{str_type}.{i}"
                    sections[section_name]["strings"].append({
                        "id": string_id,
                        "en": text,
                        "chars": len(text),
                        "hash": hash_string(text),
                        "context": str_type
                    })

    return sections


def calculate_stats(data):
    """Calculate total strings and characters."""
    total_strings = 0
    total_chars = 0

    for section in data["sections"].values():
        for s in section["strings"]:
            total_strings += 1
            total_chars += s["chars"]

    return total_strings, total_chars

def main():
    parser = argparse.ArgumentParser(description='Extract translatable strings')
    parser.add_argument('--sync', action='store_true', help='Compare with previous extraction')
    args = parser.parse_args()

    OUTPUT_PATH.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("STRING EXTRACTION")
    print("=" * 60)

    # Extract from gear_optimizer only
    print("\nExtracting from gear_optimizer...")
    gear_sections = extract_gear_optimizer()

    # Build sections
    all_sections = {f"gear_optimizer/{k}": v for k, v in gear_sections.items()}

    # Build output structure
    output = {
        "meta": {
            "extracted_at": datetime.now().isoformat(),
            "version": datetime.now().strftime("%Y%m%d_%H%M%S"),
            "sources": [str(GEAR_OPTIMIZER_PATH)]
        },
        "sections": all_sections
    }

    # Calculate stats
    total_strings, total_chars = calculate_stats(output)
    output["meta"]["total_strings"] = total_strings
    output["meta"]["total_chars"] = total_chars

    # Save
    output_file = OUTPUT_PATH / "source-strings.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\n{'=' * 60}")
    print("EXTRACTION COMPLETE")
    print(f"{'=' * 60}")
    print(f"Sections: {len(all_sections)}")
    print(f"Total strings: {total_strings}")
    print(f"Total characters: {total_chars:,}")
    print(f"Output: {output_file}")

    # If sync mode, compare with previous
    if args.sync:
        snapshot_dir = OUTPUT_PATH / "snapshots"
        snapshot_dir.mkdir(exist_ok=True)

        # Find latest snapshot
        snapshots = sorted(snapshot_dir.glob("source-strings-*.json"))
        if snapshots:
            print(f"\nComparing with previous snapshot: {snapshots[-1].name}")
            # TODO: Implement diff logic

        # Save new snapshot
        snapshot_file = snapshot_dir / f"source-strings-{output['meta']['version']}.json"
        with open(snapshot_file, 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        print(f"Snapshot saved: {snapshot_file}")

    # Print section summary
    print(f"\n{'=' * 60}")
    print("SECTIONS")
    print(f"{'=' * 60}")
    for section_name, section_data in sorted(all_sections.items()):
        string_count = len(section_data["strings"])
        char_count = sum(s["chars"] for s in section_data["strings"])
        print(f"  {section_name}: {string_count} strings ({char_count:,} chars)")

if __name__ == "__main__":
    main()
