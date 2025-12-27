#!/usr/bin/env python3
"""
Build glossary curation data from gear_optimizer code.
Extracts game-specific terms that need consistent translation.
"""

import json
import re
from collections import defaultdict
from pathlib import Path
from datetime import datetime

# Paths
SOURCE_STRINGS = Path("/Users/albertajstamper/dev/translation-portal/data/source-strings.json")
OUTPUT = Path("/Users/albertajstamper/dev/translation-portal/site/data/glossary-curation-data.json")

# Game terms to look for, organized by category
TERM_CATEGORIES = {
    "troop_types": {
        "name": "Troop Types",
        "terms": ["Infantry", "Cavalry", "Archery", "Archer", "Siege"],
        "note": "Check in-game troop menu for official translations"
    },
    "stats": {
        "name": "Stats & Attributes",
        "terms": ["Attack", "Defense", "Health", "Lethality", "Damage", "March Speed", "Load"],
        "note": "Check gear stats screen for official translations"
    },
    "resources": {
        "name": "Resources",
        "terms": ["Food", "Bread", "Wood", "Stone", "Iron", "Gold", "Gems", "Truegold", "Stamina", "VIP"],
        "note": "Check resource bar and inventory for official translations"
    },
    "gear_materials": {
        "name": "Gear Materials",
        "terms": ["Mithril", "Satin", "Gilded Threads", "Forgehammer", "Forgehammers", "Enhancement XP"],
        "note": "Check gear upgrade screen for official translations"
    },
    "gear_pieces": {
        "name": "Gear Pieces",
        "terms": ["Helmet", "Chest", "Weapon", "Gloves", "Legs", "Boots"],
        "note": "Check gear inventory for official translations"
    },
    "rarity": {
        "name": "Rarity Tiers",
        "terms": ["Common", "Rare", "Epic", "Mythic", "Legendary"],
        "note": "Check gear quality colors/names in-game"
    },
    "game_features": {
        "name": "Game Features",
        "terms": ["Governor Gear", "Hero Gear", "Charm", "Charms", "Academy", "Alliance", "Kingdom", "KvK"],
        "note": "Check main menu and feature names in-game"
    },
    "hero_related": {
        "name": "Hero Related",
        "terms": ["Hero Shard", "Conquest Skill", "Expedition Skill"],
        "note": "Check hero menu for official translations"
    }
}

def normalize_term(term):
    """Normalize term to title case for grouping."""
    # Special cases
    special = {
        "kvk": "KvK",
        "vip": "VIP",
        "xp": "XP",
        "enhancement xp": "Enhancement XP",
    }
    lower = term.lower()
    if lower in special:
        return special[lower]
    return term.title()

def get_category(term):
    """Find which category a term belongs to."""
    term_lower = term.lower()
    for cat_id, cat_info in TERM_CATEGORIES.items():
        for t in cat_info["terms"]:
            if t.lower() == term_lower:
                return cat_id, cat_info["name"]
    return "other", "Other"

def main():
    print("Building glossary curation data from gear_optimizer...\n")

    # Load source strings
    with open(SOURCE_STRINGS) as f:
        data = json.load(f)

    # Build regex pattern from all terms
    all_terms = []
    for cat_info in TERM_CATEGORIES.values():
        all_terms.extend(cat_info["terms"])

    # Sort by length descending to match longer terms first
    all_terms = sorted(set(all_terms), key=len, reverse=True)
    pattern = r'\b(' + '|'.join(re.escape(t) for t in all_terms) + r')\b'

    # Find all occurrences
    term_data = defaultdict(lambda: {
        "count": 0,
        "examples": [],
        "sections": set()
    })

    for sec_name, sec in data["sections"].items():
        source_type = "vue" if "/vue/" in sec_name else "content"
        for s in sec["strings"]:
            text = s["en"]
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches:
                normalized = normalize_term(match)
                term_data[normalized]["count"] += 1
                term_data[normalized]["sections"].add(sec_name)
                # Store example with context
                if len(term_data[normalized]["examples"]) < 3:
                    example = {
                        "text": text[:120] + ("..." if len(text) > 120 else ""),
                        "source": sec["source_file"],
                        "type": source_type
                    }
                    # Avoid duplicate examples
                    if not any(e["text"] == example["text"] for e in term_data[normalized]["examples"]):
                        term_data[normalized]["examples"].append(example)

    # Build output structure
    terms_list = []
    for term, info in sorted(term_data.items(), key=lambda x: (-x[1]["count"], x[0])):
        cat_id, cat_name = get_category(term)
        terms_list.append({
            "term": term,
            "category": cat_id,
            "categoryName": cat_name,
            "occurrences": info["count"],
            "sectionCount": len(info["sections"]),
            "examples": info["examples"],
            "includeV1": "undecided",  # For curation
            "officialTranslation": "",  # To be filled by translator
            "notes": ""
        })

    # Add category notes
    category_notes = {cat_id: info["note"] for cat_id, info in TERM_CATEGORIES.items()}

    output = {
        "description": "Game terms extracted from gear_optimizer for translation glossary",
        "generated": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "source": "gear_optimizer (Vue components + Markdown content)",
        "totalTerms": len(terms_list),
        "categoryNotes": category_notes,
        "terms": terms_list
    }

    # Save
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, 'w') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"Extracted {len(terms_list)} game terms\n")
    print("By category:")
    cat_counts = defaultdict(int)
    for t in terms_list:
        cat_counts[t["categoryName"]] += 1
    for cat, count in sorted(cat_counts.items(), key=lambda x: -x[1]):
        print(f"  {cat}: {count} terms")

    print(f"\nOutput: {OUTPUT}")

if __name__ == "__main__":
    main()
