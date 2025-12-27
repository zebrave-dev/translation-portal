/**
 * API endpoint for authentication info
 * GET /api/auth - Get current user info and role
 */

// Admin emails - add your email and collaborators here
const ADMIN_EMAILS = [
  'kingshotoptimizer@gmail.com',
  'sgslothbiz@gmail.com',
];

export async function onRequestGet(context) {
  const { request } = context;

  // Get user email from Cloudflare Access header
  const userEmail = request.headers.get('CF-Access-Authenticated-User-Email') || '';

  const isAdmin = ADMIN_EMAILS.some(email =>
    email.toLowerCase() === userEmail.toLowerCase()
  );

  return new Response(JSON.stringify({
    email: userEmail,
    isAdmin: isAdmin,
    role: isAdmin ? 'admin' : 'translator'
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    }
  });
}
