/**
 * API endpoint for glossary
 * GET /api/glossary - Load the curated glossary
 * POST /api/glossary - Save the curated glossary
 */

export async function onRequestGet(context) {
  const { env } = context;

  try {
    const glossary = await env.TRANSLATIONS.get('glossary', 'json');

    if (glossary) {
      return new Response(JSON.stringify(glossary), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
    }

    // Return empty structure if not found
    const emptyGlossary = {
      _meta: {
        description: "Gaming terms glossary for Kingshot translation",
        last_updated: new Date().toISOString()
      },
      categories: {}
    };

    return new Response(JSON.stringify(emptyGlossary), {
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
    data._meta.last_updated = new Date().toISOString();

    await env.TRANSLATIONS.put('glossary', JSON.stringify(data));

    return new Response(JSON.stringify({
      success: true,
      message: 'Glossary saved',
      timestamp: data._meta.last_updated
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
