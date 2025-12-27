/**
 * API endpoint for translations
 * GET /api/translations/ko - Load Korean translations
 * POST /api/translations/ko - Save Korean translations
 */

export async function onRequestGet(context) {
  const { params, env } = context;
  const lang = params.lang;

  // Validate language
  const validLangs = ['ko', 'pt', 'es', 'fr'];
  if (!validLangs.includes(lang)) {
    return new Response(JSON.stringify({ error: 'Invalid language' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Try to get from KV first
    const kvData = await env.TRANSLATIONS.get(`translations:${lang}`, 'json');

    if (kvData) {
      return new Response(JSON.stringify(kvData), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
    }

    // If not in KV, return empty structure
    const emptyData = {
      _meta: {
        language: lang,
        created: new Date().toISOString()
      },
      glossary: {},
      strings: {}
    };

    return new Response(JSON.stringify(emptyData), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context) {
  const { params, env, request } = context;
  const lang = params.lang;

  // Validate language
  const validLangs = ['ko', 'pt', 'es', 'fr'];
  if (!validLangs.includes(lang)) {
    return new Response(JSON.stringify({ error: 'Invalid language' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const data = await request.json();

    // Add metadata
    data._meta = data._meta || {};
    data._meta.language = lang;
    data._meta.lastSaved = new Date().toISOString();

    // Save to KV
    await env.TRANSLATIONS.put(`translations:${lang}`, JSON.stringify(data));

    return new Response(JSON.stringify({
      success: true,
      message: `Saved translations for ${lang}`,
      timestamp: data._meta.lastSaved
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
