import { reactive } from 'vue';
import localSchema from '@/schemas/zrcs-profile.schema.json';

// jsDelivr mirrors the GitHub repo with proper CDN behavior: auto-purges on
// push to main (usually within seconds) and serves sensible Cache-Control
// headers so browsers cache normally between page loads. Using it instead of
// raw.githubusercontent.com avoids GitHub's discouraged hot-linking and the
// 5-minute stale-cache window their raw CDN imposes.
// Exported so the editor can compare a profile's `$schema` against the
// canonical URL and warn the user when they don't match — the editor only
// ever validates against its own copy, never a URL pulled from user input.
export const CANONICAL_SCHEMA_URL =
    'https://cdn.jsdelivr.net/gh/SpectrumIntegrators/PublicSchemas@main/ZoomRoomsControlProfile/v1/zrcs-profile.schema.json';
const REMOTE_URL = CANONICAL_SCHEMA_URL;
const FETCH_TIMEOUT_MS = 5000;

// `status` makes the load outcome observable so the UI can show a chip and
// surface the result in the activity log. Possible values:
//   'loading'         — fetch in flight, schema is the bundled fallback for now
//   'remote'          — remote fetch succeeded, schema is the latest published copy
//   'local-fallback'  — remote fetch failed, schema is the bundled copy and `error` holds the reason
export const schemaState = reactive({
    schema: localSchema,
    source: 'local',
    version: 0,
    status: 'loading',
    error: null,
});

let started = false;

export function loadRemoteSchema() {
    if (started) return;
    started = true;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    fetch(REMOTE_URL, { signal: controller.signal })
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then((remote) => {
            schemaState.schema = remote;
            schemaState.source = 'remote';
            schemaState.status = 'remote';
            schemaState.error = null;
            schemaState.version += 1;
        })
        .catch((err) => {
            schemaState.status = 'local-fallback';
            schemaState.error = err.message;
            console.warn(
                `[schemaLoader] Falling back to bundled schema: ${err.message}`
            );
        })
        .finally(() => clearTimeout(timeout));
}
