/**
 * API endpoint for glossary curation decisions
 * GET /api/glossary-curation - Load curation decisions
 * POST /api/glossary-curation - Save curation decisions
 */

export async function onRequestGet(context) {
  const { env } = context;

  try {
    const decisions = await env.TRANSLATIONS.get('glossary-curation-decisions', 'json');

    if (decisions) {
      return new Response(JSON.stringify(decisions), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
    }

    // Return empty structure if not found
    return new Response(JSON.stringify({
      _meta: {
        created: new Date().toISOString()
      },
      decisions: {}
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

export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    const data = await request.json();

    // Update metadata
    data._meta = data._meta || {};
    data._meta.lastSaved = new Date().toISOString();

    await env.TRANSLATIONS.put('glossary-curation-decisions', JSON.stringify(data));

    return new Response(JSON.stringify({
      success: true,
      message: 'Curation decisions saved',
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
