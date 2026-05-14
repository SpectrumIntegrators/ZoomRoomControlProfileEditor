import { reactive } from 'vue';
import localSchema from '@/schemas/zrcs-profile.schema.json';

// jsDelivr mirrors the GitHub repo with proper CDN behavior: auto-purges on
// push to main (usually within seconds) and serves sensible Cache-Control
// headers so browsers cache normally between page loads. Using it instead of
// raw.githubusercontent.com avoids GitHub's discouraged hot-linking and the
// 5-minute stale-cache window their raw CDN imposes.
const REMOTE_URL =
    'https://cdn.jsdelivr.net/gh/SpectrumIntegrators/PublicSchemas@main/ZoomRoomsControlProfile/v1/zrcs-profile.schema.json';
const FETCH_TIMEOUT_MS = 5000;

export const schemaState = reactive({
    schema: localSchema,
    source: 'local',
    version: 0,
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
            schemaState.version += 1;
        })
        .catch((err) => {
            console.warn(
                `[schemaLoader] Falling back to bundled schema: ${err.message}`
            );
        })
        .finally(() => clearTimeout(timeout));
}
