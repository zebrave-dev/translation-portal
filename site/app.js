/**
 * Translation Portal - Main Application
 */

// State
let sourceStrings = null;
let translations = {};
let currentLanguage = 'pt';  // Default to Portuguese for testing
let currentSection = null;
let currentFilter = 'all';
let searchQuery = '';

// User role
let currentUserEmail = '';
let isAdmin = false;

// Supported languages with their display info
const LANGUAGES = {
    'ko': { name: 'Korean', flag: '🇰🇷' },
    'es': { name: 'Spanish', flag: '🇪🇸' },
    'pt': { name: 'Portuguese (BR)', flag: '🇧🇷' },
    'fr': { name: 'French', flag: '🇫🇷' }
};

// Cache for language stats
let languageStats = {};

// DOM Elements
const languageSelect = document.getElementById('language-select');
const translatorName = document.getElementById('translator-name');
const sectionList = document.getElementById('section-list');
const stringsContainer = document.getElementById('strings-container');
const searchBox = document.getElementById('search-box');
const filterButtons = document.querySelectorAll('.filter-btn');

// Glossary data
let glossary = null;
let currentView = 'strings'; // 'strings' or 'glossary'

// Calculate language status
async function getLanguageStatus(lang) {
    try {
        const response = await fetch(`/data/translations/${lang}.json`);
        if (!response.ok) return { status: 'not_started', percent: 0 };

        const langData = await response.json();

        // Count approved/submitted strings
        let totalChars = 0;
        let translatedChars = 0;

        for (const section of Object.values(sourceStrings.sections)) {
            for (const str of section.strings) {
                totalChars += str.chars;
                const trans = langData[str.id];
                if (trans && trans.text && (trans.status === 'approved' || trans.status === 'submitted')) {
                    translatedChars += str.chars;
                }
            }
        }

        const percent = totalChars > 0 ? Math.round((translatedChars / totalChars) * 100) : 0;

        if (percent >= 100) return { status: 'completed', percent };
        if (percent > 0) return { status: 'in_progress', percent };

        // Check if has AI suggestions
        const hasAiSuggestions = Object.values(langData).some(v => v && v.ai_suggestion);
        if (hasAiSuggestions) return { status: 'ai_ready', percent: 0 };

        return { status: 'not_started', percent: 0 };
    } catch (e) {
        return { status: 'not_started', percent: 0 };
    }
}

// Populate language dropdown with status
async function populateLanguageDropdown() {
    languageSelect.innerHTML = '';

    for (const [code, info] of Object.entries(LANGUAGES)) {
        const stats = await getLanguageStatus(code);
        languageStats[code] = stats;

        let statusText = '';
        switch (stats.status) {
            case 'completed':
                statusText = ' ✅ Completed!';
                break;
            case 'in_progress':
                statusText = ` (${stats.percent}% Done)`;
                break;
            case 'ai_ready':
                statusText = ' (AI Ready)';
                break;
            default:
                statusText = ' (Not Started)';
        }

        const option = document.createElement('option');
        option.value = code;
        option.textContent = `${info.flag} ${info.name}${statusText}`;
        if (code === currentLanguage) option.selected = true;
        languageSelect.appendChild(option);
    }
}

// Check user authentication and role
async function checkAuth() {
    try {
        const response = await fetch('/api/auth');
        if (response.ok) {
            const auth = await response.json();
            currentUserEmail = auth.email;
            isAdmin = auth.isAdmin;
            console.log(`Authenticated as: ${currentUserEmail} (${auth.role})`);

            // Show admin indicator if admin
            if (isAdmin) {
                const userInfo = document.getElementById('user-info');
                userInfo.innerHTML = `<span style="color: var(--success); margin-right: 0.5rem;">👑 Admin</span> ` + userInfo.innerHTML;
            } else {
                // Hide admin-only link for non-admins
                const adminLink = document.querySelector('.admin-link');
                if (adminLink) adminLink.style.display = 'none';
            }
        }
    } catch (e) {
        console.log('Auth API not available (local dev mode)');
        // In local dev, default to admin for testing
        isAdmin = true;
    }
}

// Initialize
async function init() {
    // Check authentication first
    await checkAuth();

    // Load saved translator name
    translatorName.value = localStorage.getItem('translatorName') || '';
    translatorName.addEventListener('change', () => {
        localStorage.setItem('translatorName', translatorName.value);
    });

    // Load source strings
    try {
        const response = await fetch('/data/source-strings.json');
        sourceStrings = await response.json();
        console.log(`Loaded ${sourceStrings.meta.total_strings} source strings`);
    } catch (e) {
        console.error('Failed to load source strings:', e);
        showToast('Failed to load source strings. Make sure to run extract_strings.py first.', 'error');
        return;
    }

    // Load glossary (try API first, fallback to static file)
    try {
        const apiResponse = await fetch('/api/glossary');
        if (apiResponse.ok) {
            const apiData = await apiResponse.json();
            if (apiData.categories && Object.keys(apiData.categories).length > 0) {
                glossary = apiData;
                console.log(`Loaded glossary from API with ${Object.keys(glossary.categories).length} categories`);
            }
        }
    } catch (e) {
        console.log('API glossary not available, trying static file');
    }

    // Fallback to static file
    if (!glossary) {
        try {
            const response = await fetch('/data/glossary.json');
            glossary = await response.json();
            console.log(`Loaded glossary from static file with ${Object.keys(glossary.categories).length} categories`);
        } catch (e) {
            console.error('Failed to load glossary:', e);
        }
    }

    // Populate language dropdown with status
    await populateLanguageDropdown();

    // Load translations for current language
    await loadTranslations(currentLanguage);

    // Setup event listeners
    languageSelect.addEventListener('change', async (e) => {
        currentLanguage = e.target.value;
        await loadTranslations(currentLanguage);
        renderSections();
        renderCurrentView();
        updateProgress();
    });

    searchBox.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        renderCurrentView();
    });

    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderCurrentView();
        });
    });

    // View tabs (Page Text vs Glossary)
    document.querySelectorAll('.view-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.view-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentView = tab.dataset.view;

            // Show/hide filters based on view
            document.getElementById('string-filters').style.display =
                currentView === 'strings' ? 'flex' : 'none';

            renderCurrentView();
        });
    });

    // Contributors panel toggle
    document.getElementById('toggle-contributors').addEventListener('click', () => {
        const panel = document.getElementById('contributors-panel');
        const btn = document.getElementById('toggle-contributors');
        if (panel.style.display === 'none') {
            panel.style.display = 'block';
            btn.textContent = '👥 Hide Contributors';
        } else {
            panel.style.display = 'none';
            btn.textContent = '👥 Contributors';
        }
    });

    // Initial render
    renderSections();
    renderCurrentView();
    updateProgress();
}

// Render based on current view
function renderCurrentView() {
    if (currentView === 'glossary') {
        renderGlossary();
    } else {
        renderStrings();
    }
}

// Load translations for a language
async function loadTranslations(lang) {
    // Always load static file first (has ai_suggestions from Google Translate)
    let staticTranslations = {};
    try {
        const response = await fetch(`/data/translations/${lang}.json`);
        if (response.ok) {
            staticTranslations = await response.json();
            console.log(`Loaded ${Object.keys(staticTranslations).length} translations for ${lang} from static file`);
        }
    } catch (e) {
        console.log(`No static translations file for ${lang}`);
    }

    // Try to load from API (KV storage) - user edits are stored here
    let apiTranslations = {};
    try {
        const apiResponse = await fetch(`/api/translations/${lang}`);
        if (apiResponse.ok) {
            const apiData = await apiResponse.json();
            // Check if API has actual translations (more than just _meta and empty structures)
            const hasRealData = Object.keys(apiData).some(key =>
                key !== '_meta' && key !== 'glossary' && key !== 'strings' &&
                apiData[key] && apiData[key].text
            );
            if (hasRealData) {
                apiTranslations = apiData;
                console.log(`Loaded translations for ${lang} from API`);
            }
        }
    } catch (e) {
        console.log(`API not available for ${lang}`);
    }

    // Merge: static (ai_suggestions) + API (user edits) - API takes precedence
    translations = { ...staticTranslations };
    for (const [key, value] of Object.entries(apiTranslations)) {
        if (key === '_meta') continue;
        if (value && value.text) {
            // Merge user edits with ai_suggestion from static
            translations[key] = {
                ...staticTranslations[key],  // Keep ai_suggestion
                ...value                      // Override with user's text/status
            };
        }
    }

    console.log(`Final translations for ${lang}: ${Object.keys(translations).length} keys`);
}

// Save translations to server
async function saveToServer() {
    try {
        const response = await fetch(`/api/translations/${currentLanguage}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(translations)
        });

        if (response.ok) {
            const result = await response.json();
            console.log('Saved to server:', result);
            return true;
        } else {
            console.error('Failed to save to server:', response.status);
            return false;
        }
    } catch (e) {
        console.error('Error saving to server:', e);
        return false;
    }
}

// Save translations (to server and optionally download)
async function saveTranslations() {
    const data = JSON.stringify(translations, null, 2);

    // Save to localStorage as backup
    localStorage.setItem(`translations_${currentLanguage}`, data);

    // Try to save to server
    const savedToServer = await saveToServer();

    if (savedToServer) {
        showToast('Translations saved to server!', 'success');
    } else {
        // Fallback: offer download
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentLanguage}.json`;
        a.click();
        showToast('Server unavailable. Download started as backup.', 'warning');
    }
}

// Render sections in sidebar
function renderSections() {
    const sections = Object.keys(sourceStrings.sections).sort();

    sectionList.innerHTML = sections.map(section => {
        const sectionData = sourceStrings.sections[section];
        const totalStrings = sectionData.strings.length;
        const translatedStrings = sectionData.strings.filter(s =>
            translations[s.id] && translations[s.id].text
        ).length;

        const shortName = section.split('/').slice(-1)[0];
        const isActive = currentSection === section;

        return `
            <div class="section-item ${isActive ? 'active' : ''}"
                 onclick="selectSection('${section}')">
                <span>${shortName}</span>
                <span class="section-count">${translatedStrings}/${totalStrings}</span>
            </div>
        `;
    }).join('');
}

// Select a section
function selectSection(section) {
    currentSection = currentSection === section ? null : section;
    renderSections();
    renderStrings();
}

// Get all strings (optionally filtered)
function getFilteredStrings() {
    let allStrings = [];

    const sections = currentSection
        ? [currentSection]
        : Object.keys(sourceStrings.sections);

    for (const section of sections) {
        const sectionData = sourceStrings.sections[section];
        for (const str of sectionData.strings) {
            const trans = translations[str.id] || {};
            const status = trans.status || 'pending';

            allStrings.push({
                ...str,
                section,
                translation: trans.text || '',
                aiSuggestion: trans.ai_suggestion || '',
                status,
                translator: trans.translator || '',
                timestamp: trans.timestamp || ''
            });
        }
    }

    // Apply filter
    if (currentFilter !== 'all') {
        allStrings = allStrings.filter(s => s.status === currentFilter);
    }

    // Apply search
    if (searchQuery) {
        allStrings = allStrings.filter(s =>
            s.en.toLowerCase().includes(searchQuery) ||
            s.translation.toLowerCase().includes(searchQuery) ||
            s.id.toLowerCase().includes(searchQuery)
        );
    }

    return allStrings;
}

// Render glossary
function renderGlossary() {
    if (!glossary) {
        stringsContainer.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                Glossary not loaded. Make sure glossary.json exists.
            </div>
        `;
        return;
    }

    const langTranslations = translations.glossary || {};
    let allTerms = [];

    // Flatten glossary categories into array
    for (const [categoryKey, categoryData] of Object.entries(glossary.categories)) {
        const termsList = categoryData.terms || [];
        for (const termData of termsList) {
            const term = termData.en;  // English term
            const trans = langTranslations[term] || {};
            const status = trans.status || 'pending';

            // Apply search filter
            if (searchQuery) {
                const matchesTerm = term.toLowerCase().includes(searchQuery);
                const matchesContext = (termData.context || '').toLowerCase().includes(searchQuery);
                const matchesTranslation = (trans.text || '').toLowerCase().includes(searchQuery);
                if (!matchesTerm && !matchesContext && !matchesTranslation) {
                    continue;
                }
            }

            allTerms.push({
                term: term,
                context: termData.context || '',
                category: categoryKey,
                categoryName: categoryData.name || categoryKey,
                translation: trans.text || '',
                aiSuggestion: trans.ai_suggestion || '',
                status,
                translator: trans.translator || '',
                timestamp: trans.timestamp || '',
                isOfficial: trans.official_game_term || false
            });
        }
    }

    if (allTerms.length === 0) {
        stringsContainer.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                No glossary terms match your search.
            </div>
        `;
        return;
    }

    // Group by category for display
    const byCategory = {};
    for (const term of allTerms) {
        if (!byCategory[term.category]) {
            byCategory[term.category] = [];
        }
        byCategory[term.category].push(term);
    }

    let html = `
        <div class="glossary-info" style="background: var(--warning-bg, #fef3cd); border: 1px solid var(--warning-border, #ffc107); border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem; color: var(--warning-text, #856404);">
            <strong>⚠️ Important:</strong> For glossary terms, use the <strong>exact translation shown in the game</strong>.
            Open Kingshot in your language and find how each term appears in-game (menus, tooltips, item descriptions).
            The Google Translate suggestion is just a starting point - the game's official translation should take priority.
        </div>
    `;

    for (const [category, terms] of Object.entries(byCategory)) {
        // Use the categoryName from first term (they all have same category)
        const displayName = terms[0]?.categoryName || category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        html += `<div class="glossary-category">
            <h3 style="margin: 1rem 0; color: var(--primary); border-bottom: 1px solid var(--border);">${displayName}</h3>
        `;

        for (const term of terms) {
            const termIdSafe = term.term.replace(/[^a-zA-Z0-9]/g, '_');
            const termEscaped = term.term.replace(/'/g, "\\'");

            html += `
                <div class="string-card ${term.status}" data-term="${escapeHtml(term.term)}">
                    <div class="string-header">
                        <span class="string-id">${escapeHtml(term.term)}</span>
                        <span class="string-status ${term.status}">${getStatusLabel(term.status)}</span>
                    </div>

                    <div class="source-label">Context</div>
                    <div class="source-text" style="font-size: 0.9rem; color: var(--text-secondary);">${escapeHtml(term.context)}</div>

                    ${term.aiSuggestion ? `
                        <div class="ai-suggestion">
                            <div class="ai-suggestion-text">
                                <div class="source-label">Google Translate Suggestion</div>
                                ${escapeHtml(term.aiSuggestion)}
                            </div>
                            ${isAdmin ? `<button class="use-ai-btn" onclick="useGlossaryAi('${termEscaped}')">Use This</button>` : ''}
                        </div>
                    ` : ''}

                    <div class="source-label">Translation</div>
                    <textarea class="translation-input"
                              id="glossary-input-${termIdSafe}"
                              placeholder="${isAdmin ? 'Enter official game translation...' : 'Only admins can edit glossary terms'}"
                              ${!isAdmin ? 'disabled' : ''}
                              onchange="updateGlossaryDraft('${termEscaped}', this.value)">${escapeHtml(term.translation)}</textarea>

                    ${isAdmin ? `
                        <div class="string-actions">
                            <button class="btn-save" onclick="saveGlossaryDraft('${termEscaped}')">Save Draft</button>
                            <button class="btn-approve" onclick="approveGlossary('${termEscaped}')">Approve</button>
                        </div>
                    ` : ''}

                    ${term.translator ? `
                        <div class="string-meta">
                            Last edited by ${term.translator} on ${formatDate(term.timestamp)}
                        </div>
                    ` : ''}
                </div>
            `;
        }
        html += '</div>';
    }

    stringsContainer.innerHTML = html;
}

// Glossary actions
function useGlossaryAi(term) {
    const trans = translations.glossary?.[term] || {};
    const inputId = `glossary-input-${term.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const input = document.getElementById(inputId);
    if (input && trans.ai_suggestion) {
        input.value = trans.ai_suggestion;
        updateGlossaryDraft(term, trans.ai_suggestion);
    }
}

function updateGlossaryDraft(term, value) {
    if (!translations.glossary) {
        translations.glossary = {};
    }
    if (!translations.glossary[term]) {
        translations.glossary[term] = {};
    }
    translations.glossary[term].text = value;
    translations.glossary[term].status = translations.glossary[term].status || 'draft';
}

async function saveGlossaryDraft(term) {
    const inputId = `glossary-input-${term.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const input = document.getElementById(inputId);
    if (!input || !input.value.trim()) {
        showToast('Please enter a translation first', 'error');
        return;
    }

    if (!translatorName.value.trim()) {
        showToast('Please enter your name first (top right)', 'error');
        translatorName.focus();
        return;
    }

    if (!translations.glossary) {
        translations.glossary = {};
    }
    if (!translations.glossary[term]) {
        translations.glossary[term] = {};
    }

    translations.glossary[term].text = input.value;
    translations.glossary[term].status = 'draft';
    translations.glossary[term].translator = translatorName.value || 'Anonymous';
    translations.glossary[term].timestamp = new Date().toISOString();

    localStorage.setItem(`translations_${currentLanguage}`, JSON.stringify(translations));

    // Save to server
    const saved = await saveToServer();
    showToast(saved ? 'Glossary term saved!' : 'Saved locally', 'success');

    // Update card status
    const card = document.querySelector(`.string-card[data-term="${term}"]`);
    if (card) {
        card.className = 'string-card draft';
        card.querySelector('.string-status').className = 'string-status draft';
        card.querySelector('.string-status').textContent = '📝 Draft';
    }
}

async function approveGlossary(term) {
    const inputId = `glossary-input-${term.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const input = document.getElementById(inputId);
    if (!input || !input.value.trim()) {
        showToast('Please enter a translation first', 'error');
        return;
    }

    if (!translatorName.value.trim()) {
        showToast('Please enter your name first (top right)', 'error');
        translatorName.focus();
        return;
    }

    if (!translations.glossary) {
        translations.glossary = {};
    }
    if (!translations.glossary[term]) {
        translations.glossary[term] = {};
    }

    translations.glossary[term].text = input.value;
    translations.glossary[term].status = 'approved';
    translations.glossary[term].translator = translatorName.value || 'Anonymous';
    translations.glossary[term].timestamp = new Date().toISOString();
    translations.glossary[term].official_game_term = true;

    localStorage.setItem(`translations_${currentLanguage}`, JSON.stringify(translations));

    // Save to server
    const saved = await saveToServer();
    showToast(saved ? 'Glossary term approved!' : 'Approved (saved locally)', 'success');

    // Update card status
    const card = document.querySelector(`.string-card[data-term="${term}"]`);
    if (card) {
        card.className = 'string-card approved';
        card.querySelector('.string-status').className = 'string-status approved';
        card.querySelector('.string-status').textContent = '✅ Approved';
    }
}

// Render strings
function renderStrings() {
    const strings = getFilteredStrings();

    if (strings.length === 0) {
        stringsContainer.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                ${currentSection ? 'No strings match your filter.' : 'Select a section from the sidebar, or search/filter strings.'}
            </div>
        `;
        return;
    }

    stringsContainer.innerHTML = strings.slice(0, 50).map(str => {
        const userCanEdit = canEdit(str.translator);
        const lockedClass = !userCanEdit ? 'locked' : '';

        return `
        <div class="string-card ${str.status} ${lockedClass}" data-id="${str.id}">
            <div class="string-header">
                <span class="string-id">${str.id}</span>
                <span class="string-status ${str.status}">${getStatusLabel(str.status)}</span>
                ${!userCanEdit ? `<span style="color: var(--text-secondary); font-size: 0.75rem;">🔒 ${escapeHtml(str.translator)}'s</span>` : ''}
            </div>

            <div class="source-label">English (${str.chars} chars)</div>
            <div class="source-text">${escapeHtml(str.en)}</div>

            ${str.aiSuggestion ? `
                <div class="ai-suggestion">
                    <div class="ai-suggestion-text">
                        <div class="source-label">Google Translate Suggestion</div>
                        ${escapeHtml(str.aiSuggestion)}
                    </div>
                    ${userCanEdit ? `<button class="use-ai-btn" onclick="useAiSuggestion('${str.id}')">Use This ➜</button>` : ''}
                </div>
            ` : ''}

            <div class="source-label">Translation</div>
            <textarea class="translation-input"
                      id="input-${str.id}"
                      placeholder="${userCanEdit ? 'Enter translation...' : 'Locked - ' + str.translator + "'s translation"}"
                      ${!userCanEdit ? 'disabled' : ''}
                      onchange="updateDraft('${str.id}', this.value)">${escapeHtml(str.translation)}</textarea>

            ${userCanEdit ? `
                <div class="string-actions">
                    <button class="btn-save" onclick="saveDraft('${str.id}')">Save Draft</button>
                    <button class="btn-submit" onclick="submitTranslation('${str.id}')">Submit</button>
                    ${isAdmin ? `<button class="btn-approve" onclick="approveTranslation('${str.id}')">Approve ✓</button>` : ''}
                </div>
            ` : ''}

            ${str.translator ? `
                <div class="string-meta">
                    Last edited by ${str.translator} on ${formatDate(str.timestamp)}
                </div>
            ` : ''}
        </div>
    `;
    }).join('');

    if (strings.length > 50) {
        stringsContainer.innerHTML += `
            <div style="text-align: center; padding: 1rem; color: var(--text-secondary);">
                Showing 50 of ${strings.length} strings. Use search or filters to narrow down.
            </div>
        `;
    }
}

// Update progress bar
function updateProgress() {
    let total = 0;
    let totalChars = 0;
    let approved = 0;
    let approvedChars = 0;
    let submitted = 0;
    let submittedChars = 0;
    let draft = 0;
    let draftChars = 0;

    // Track contributions by translator
    const contributorStats = {};

    for (const section of Object.values(sourceStrings.sections)) {
        for (const str of section.strings) {
            total++;
            totalChars += str.chars;

            const trans = translations[str.id];
            if (trans) {
                if (trans.status === 'approved') {
                    approved++;
                    approvedChars += str.chars;
                } else if (trans.status === 'submitted') {
                    submitted++;
                    submittedChars += str.chars;
                } else if (trans.status === 'draft' && trans.text) {
                    draft++;
                    draftChars += str.chars;
                }

                // Track by translator
                if (trans.translator && trans.text) {
                    if (!contributorStats[trans.translator]) {
                        contributorStats[trans.translator] = { strings: 0, chars: 0, approved: 0, submitted: 0, draft: 0 };
                    }
                    contributorStats[trans.translator].strings++;
                    contributorStats[trans.translator].chars += str.chars;
                    if (trans.status === 'approved') contributorStats[trans.translator].approved++;
                    else if (trans.status === 'submitted') contributorStats[trans.translator].submitted++;
                    else if (trans.status === 'draft') contributorStats[trans.translator].draft++;
                }
            }
        }
    }

    const approvedPct = (approvedChars / totalChars * 100).toFixed(1);
    const submittedPct = (submittedChars / totalChars * 100).toFixed(1);
    const draftPct = (draftChars / totalChars * 100).toFixed(1);

    document.getElementById('progress-text').textContent =
        `${approved + submitted + draft} / ${total} strings (${((approved + submitted + draft) / total * 100).toFixed(1)}%)`;
    document.getElementById('char-progress').textContent =
        `${(approvedChars + submittedChars + draftChars).toLocaleString()} / ${totalChars.toLocaleString()} chars`;

    document.getElementById('progress-approved').style.width = `${approvedPct}%`;
    document.getElementById('progress-submitted').style.width = `${submittedPct}%`;
    document.getElementById('progress-draft').style.width = `${draftPct}%`;

    // Update contributor stats panel
    updateContributorStats(contributorStats, totalChars);
}

// Update contributor stats display
function updateContributorStats(stats, totalChars) {
    const container = document.getElementById('contributors-list');
    const translatedChars = Object.values(stats).reduce((sum, s) => sum + s.chars, 0);

    if (Object.keys(stats).length === 0) {
        container.innerHTML = '<span style="color: var(--text-secondary); font-size: 0.85rem;">No contributions yet</span>';
        return;
    }

    // Sort by chars contributed (descending)
    const sorted = Object.entries(stats).sort((a, b) => b[1].chars - a[1].chars);

    container.innerHTML = sorted.map(([name, data]) => {
        const pctOfTranslated = translatedChars > 0 ? ((data.chars / translatedChars) * 100).toFixed(1) : 0;
        const pctOfTotal = ((data.chars / totalChars) * 100).toFixed(1);
        return `
            <div style="background: var(--bg-card); padding: 0.5rem 0.75rem; border-radius: 6px; min-width: 150px;">
                <div style="font-weight: bold; color: var(--text-primary);">${escapeHtml(name)}</div>
                <div style="font-size: 0.8rem; color: var(--text-secondary);">
                    ${data.strings} strings · ${data.chars.toLocaleString()} chars
                </div>
                <div style="font-size: 0.75rem; color: var(--accent);">
                    ${pctOfTranslated}% of work · ${pctOfTotal}% of total
                </div>
                <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 0.25rem;">
                    ✅ ${data.approved} · 📤 ${data.submitted} · 📝 ${data.draft}
                </div>
            </div>
        `;
    }).join('');
}

// Check if current user can edit a translation
function canEdit(translatorName) {
    // Admins can edit anything
    if (isAdmin) return true;

    // Users can only edit their own translations
    const currentName = document.getElementById('translator-name').value.trim();
    if (!translatorName) return true; // New translation, anyone can claim
    return translatorName.toLowerCase() === currentName.toLowerCase();
}

// Actions
function useAiSuggestion(id) {
    const trans = translations[id] || {};
    const input = document.getElementById(`input-${id}`);
    if (input && trans.ai_suggestion) {
        input.value = trans.ai_suggestion;
        updateDraft(id, trans.ai_suggestion);
    }
}

function updateDraft(id, value) {
    if (!translations[id]) {
        translations[id] = {};
    }
    translations[id].text = value;
    translations[id].status = translations[id].status || 'draft';
}

async function saveDraft(id) {
    const input = document.getElementById(`input-${id}`);
    if (!input.value.trim()) {
        showToast('Please enter a translation first', 'error');
        return;
    }

    if (!translatorName.value.trim()) {
        showToast('Please enter your name first (top right)', 'error');
        translatorName.focus();
        return;
    }

    if (!translations[id]) {
        translations[id] = {};
    }

    translations[id].text = input.value;
    translations[id].status = 'draft';
    translations[id].translator = translatorName.value || 'Anonymous';
    translations[id].timestamp = new Date().toISOString();

    // Save to localStorage as backup
    localStorage.setItem(`translations_${currentLanguage}`, JSON.stringify(translations));

    // Save to server
    const saved = await saveToServer();

    updateProgress();
    showToast(saved ? 'Draft saved!' : 'Draft saved locally', 'success');

    // Update card status
    const card = document.querySelector(`.string-card[data-id="${id}"]`);
    if (card) {
        card.className = 'string-card draft';
        card.querySelector('.string-status').className = 'string-status draft';
        card.querySelector('.string-status').textContent = '📝 Draft';
    }
}

async function submitTranslation(id) {
    const input = document.getElementById(`input-${id}`);
    if (!input.value.trim()) {
        showToast('Please enter a translation first', 'error');
        return;
    }

    if (!translatorName.value.trim()) {
        showToast('Please enter your name first (top right)', 'error');
        translatorName.focus();
        return;
    }

    if (!translations[id]) {
        translations[id] = {};
    }

    translations[id].text = input.value;
    translations[id].status = 'submitted';
    translations[id].translator = translatorName.value || 'Anonymous';
    translations[id].timestamp = new Date().toISOString();

    localStorage.setItem(`translations_${currentLanguage}`, JSON.stringify(translations));

    // Save to server
    const saved = await saveToServer();

    updateProgress();
    showToast(saved ? 'Translation submitted!' : 'Submitted (saved locally)', 'success');

    // Update card
    const card = document.querySelector(`.string-card[data-id="${id}"]`);
    if (card) {
        card.className = 'string-card submitted';
        card.querySelector('.string-status').className = 'string-status submitted';
        card.querySelector('.string-status').textContent = '📤 Submitted';
    }
}

async function approveTranslation(id) {
    const input = document.getElementById(`input-${id}`);
    if (!input.value.trim()) {
        showToast('Please enter a translation first', 'error');
        return;
    }

    if (!translatorName.value.trim()) {
        showToast('Please enter your name first (top right)', 'error');
        translatorName.focus();
        return;
    }

    if (!translations[id]) {
        translations[id] = {};
    }

    translations[id].text = input.value;
    translations[id].status = 'approved';
    translations[id].translator = translatorName.value || 'Anonymous';
    translations[id].timestamp = new Date().toISOString();
    translations[id].approved_by = translatorName.value || 'Anonymous';
    translations[id].approved_at = new Date().toISOString();

    localStorage.setItem(`translations_${currentLanguage}`, JSON.stringify(translations));

    // Save to server
    const saved = await saveToServer();

    updateProgress();
    showToast(saved ? 'Translation approved!' : 'Approved (saved locally)', 'success');

    // Update card
    const card = document.querySelector(`.string-card[data-id="${id}"]`);
    if (card) {
        card.className = 'string-card approved';
        card.querySelector('.string-status').className = 'string-status approved';
        card.querySelector('.string-status').textContent = '✅ Approved';
    }
}

// Helper functions
function getStatusLabel(status) {
    const labels = {
        pending: '🆕 Pending',
        needs_review: '⚠️ Needs Review',
        draft: '📝 Draft',
        submitted: '📤 Submitted',
        approved: '✅ Approved'
    };
    return labels[status] || status;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(isoString) {
    if (!isoString) return '';
    return new Date(isoString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.style.display = 'block';

    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

// Export function for downloading
function exportTranslations() {
    saveTranslations();
}

// Load saved translations from localStorage on init
function loadLocalTranslations() {
    const saved = localStorage.getItem(`translations_${currentLanguage}`);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            // Merge with loaded translations (localStorage takes precedence)
            translations = { ...translations, ...parsed };
            console.log('Loaded translations from localStorage');
        } catch (e) {
            console.error('Failed to parse saved translations');
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    init().then(() => {
        loadLocalTranslations();
        renderStrings();
        updateProgress();
    });
});

// Add export button to header
document.addEventListener('DOMContentLoaded', () => {
    const headerControls = document.querySelector('.header-controls');
    const exportBtn = document.createElement('button');
    exportBtn.textContent = '📥 Export';
    exportBtn.style.cssText = 'background: var(--success); color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer;';
    exportBtn.onclick = exportTranslations;
    headerControls.appendChild(exportBtn);
});
