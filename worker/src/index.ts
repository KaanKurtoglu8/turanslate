/**
 * Turanslate API Worker. Every route except POST /auth/login requires a valid session;
 * every /admin/* route additionally requires the admin role (enforced in the handlers).
 */
import { readConfig, type Config, type Env } from './env';
import { ApiError, corsHeaders, errorResponse, withHeaders } from './http';
import { handleLogin, handleLogout, handleMe } from './routes/auth';
import { handleListLogs, handleLogDetail, handleUsageSummary } from './routes/admin';
import { handleTranslate } from './routes/translate';

async function route(request: Request, env: Env, config: Config): Promise<Response> {
  const { pathname } = new URL(request.url);
  const path = pathname.replace(/\/+$/, '') || '/';
  const method = request.method;

  if (path === '/auth/login' && method === 'POST') return handleLogin(request, env, config);
  if (path === '/auth/logout' && method === 'POST') return handleLogout(request, env);
  if (path === '/auth/me' && method === 'GET') return handleMe(request, env);
  if (path === '/translate' && method === 'POST') return handleTranslate(request, env, config);
  if (path === '/admin/logs' && method === 'GET') return handleListLogs(request, env);
  if (path === '/admin/usage-summary' && method === 'GET') {
    return handleUsageSummary(request, env, config);
  }
  const detail = /^\/admin\/logs\/(\d{1,15})$/.exec(path);
  if (detail && method === 'GET') return handleLogDetail(request, env, Number(detail[1]));

  throw new ApiError(404, 'not_found');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const config = readConfig(env);
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(origin, config.allowedOrigins);

    // Browsers from other origins get no CORS headers and no side effects.
    if (origin && !cors) return errorResponse(403, 'forbidden');
    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers: cors ?? {} });

    let response: Response;
    try {
      response = await route(request, env, config);
    } catch (error) {
      if (error instanceof ApiError) {
        response = errorResponse(error.status, error.code);
      } else {
        // Never leak internals (SQL, stack traces) to the browser.
        // Server-side log only; it stays in Cloudflare and never reaches the response.
        console.error('Unhandled error', error instanceof Error ? error.message : String(error));
        response = errorResponse(500, isD1Error(error) ? 'database_error' : 'internal_error');
      }
    }
    return withHeaders(response, cors);
  },
} satisfies ExportedHandler<Env>;

function isD1Error(error: unknown): boolean {
  return error instanceof Error && /D1|SQLITE/i.test(error.message);
}
