// dsh-moe-bear-skin — host half.
//
// The only job here is static asset routing: the browser half cannot import a
// .webm/.gif/.png out of the package, so this registers two named routes on the
// web server and lets lib/client.js point <video>/<img> at them:
//
//   GET <route>manifest.json   -> the file names present in ./assets
//   GET <route><file>          -> that file, with a media type and no caching
//
// Nothing else is host-side: no theme, no DOM, no model-visible surface. When
// the composition has no web server (a plain `dsh tui` profile), the plugin
// simply does nothing — the browser half falls back to its embedded SVG.

import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const name = 'moe-bear-skin';

/** Directory the routes serve. */
const ASSETS_DIR = fileURLToPath(new URL('../assets/', import.meta.url));

/** Media types the skin can actually use; anything else is refused. */
const MEDIA_TYPES = new Map([
  ['.webm', 'video/webm'],
  ['.mp4', 'video/mp4'],
  ['.gif', 'image/gif'],
  ['.apng', 'image/apng'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.avif', 'image/avif'],
  ['.svg', 'image/svg+xml'],
]);

const log = (...args) => console.log('[moe-bear-skin]', ...args);

/**
 * Normalize `route` into a prefix WITHOUT a trailing slash.
 *
 * `WebServer.match()` tests `pathname !== prefix && !pathname.startsWith(prefix + '/')`,
 * so a registered prefix of `/moe-bear/assets/` can never match
 * `/moe-bear/assets/x.mp4` — it would look for a double slash. The route pattern
 * must therefore be the bare prefix; the manifest lives at `${prefix}/manifest.json`.
 */
function normalizeRoute(route) {
  const raw = typeof route === 'string' && route.trim().length > 0 ? route.trim() : '/moe-bear/assets';
  const withLeading = raw.startsWith('/') ? raw : `/${raw}`;
  return withLeading.replace(/\/+$/u, '');
}

/** Resolve one request path inside ASSETS_DIR, or null when it escapes or is absent. */
async function resolveAssetFile(requestPath) {
  const name = decodeURIComponent(requestPath).replace(/^\/+/u, '');
  if (name.length === 0 || name.includes('\0')) return null;
  const target = resolve(ASSETS_DIR, name);
  const root = resolve(ASSETS_DIR);
  if (target !== root && !target.startsWith(`${root}${sep}`)) return null;
  const type = MEDIA_TYPES.get(extname(target).toLowerCase());
  if (type === undefined) return null;
  try {
    const info = await stat(target);
    return info.isFile() ? { target, type, size: info.size } : null;
  } catch {
    return null;
  }
}

/** Serve one media file, or 404 with a short reason. */
async function serveAsset(res, requestPath) {
  const found = await resolveAssetFile(requestPath);
  if (found === null) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
    return;
  }
  res.writeHead(200, {
    'content-type': found.type,
    'content-length': String(found.size),
    // The user edits these files by hand; never let a stale copy stick around.
    'cache-control': 'no-cache',
    'access-control-allow-origin': '*',
  });
  createReadStream(found.target).pipe(res);
}

/** Answer `<route>manifest.json` with the usable file names. */
async function serveManifest(res) {
  let names = [];
  try {
    const entries = await readdir(ASSETS_DIR, { withFileTypes: true });
    names = entries
      .filter((entry) => entry.isFile() && MEDIA_TYPES.has(extname(entry.name).toLowerCase()))
      .map((entry) => entry.name)
      .sort();
  } catch {
    // A missing assets directory is a valid empty skin, not an error.
  }
  res.writeHead(200, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-cache',
    'access-control-allow-origin': '*',
  });
  res.end(JSON.stringify({ files: names }));
}

/**
 * Register the asset routes once the composition has a web server.
 *
 * `ctx.get('webServer')` inside apply() is a race, not a lookup: the `webserver`
 * row itself declares `inject: [webStartup]`, so it comes up *after* the plain
 * rows around it. The documented idiom is `ctx.inject(['webServer'], …)` (what
 * `dsh-client-modules` does for its own `/plugins` route): the callback runs
 * when the service exists, inside a child scope whose `ctx.effect` disposes the
 * routes if the service goes away.
 *
 * @param ctx - Host root context.
 * @param config - Loader row config; `route` is the only key.
 */
export function apply(ctx, config = {}) {
  const route = normalizeRoute(config.route);

  const mount = (webCtx) => {
    const webServer = webCtx.webServer;
    if (webServer === undefined || typeof webServer.register !== 'function') {
      log('webServer service appeared without register(); asset routes not mounted');
      return;
    }
    webCtx.effect(() => {
      try {
        const disposeManifest = webServer.register({
          kind: 'exact',
          path: `${route}/manifest.json`,
          handler: (req, res) => void serveManifest(res),
        });
        const disposePrefix = webServer.register({
          kind: 'prefix',
          path: route,
          handler: (req, res) => {
            // pathname is `${route}/<file>`; the route itself carries no trailing slash.
            const pathname = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
            void serveAsset(res, pathname.slice(route.length + 1));
          },
        });
        log(`assets served at ${route}/ (from ${ASSETS_DIR})`);
        return () => {
          disposeManifest();
          disposePrefix();
        };
      } catch (error) {
        log('asset route registration failed:', error instanceof Error ? error.message : error);
        return () => {};
      }
    }, 'moe-bear-skin: asset routes');
  };

  try {
    if (typeof ctx.inject === 'function') ctx.inject(['webServer'], mount);
    else {
      mount(ctx);
    }
  } catch (error) {
    log('failed to mount asset routes:', error instanceof Error ? error.message : error);
  }
}
