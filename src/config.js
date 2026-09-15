// Shared constants used in more than one place.

// Where the published schema lives on the CDN. Stamped into a new profile's
// `$schema` field so editors validating the file against this URL get our
// latest schema (jsDelivr auto-purges on push).
export const SCHEMA_URL =
    'https://cdn.jsdelivr.net/gh/SpectrumIntegrators/PublicSchemas@main/ZoomRoomsControlProfile/v1/zrcs-profile.schema.json';

// Stamped into `info.tool` on new profiles and on download so downstream
// consumers can trace the file back to this editor.
export const EDITOR_URL = 'https://zoom.spectrumintegrators.com';

// YYYY-MM-DD in local time. Date.toISOString uses UTC, which can drift a day
// off near midnight; build the string from local components.
export function todayIso() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// Zoom doesn't care about top-level key order, but Zoom's own example profiles
// follow $schema → info → adapters → scenes → styles → rules → response_filters.
// We normalize to that order whenever the builder emits a change so newly-added
// blocks don't get appended to the bottom; hand-edits in the textarea preserve
// whatever order the user typed.
export const PROFILE_KEY_ORDER = [
    '$schema',
    'info',
    'adapters',
    'scenes',
    'styles',
    'rules',
    'response_filters',
];

export function orderProfileKeys(profile) {
    const ordered = {};
    for (const key of PROFILE_KEY_ORDER) {
        if (key in profile) ordered[key] = profile[key];
    }
    for (const key of Object.keys(profile)) {
        if (!(key in ordered)) ordered[key] = profile[key];
    }
    return ordered;
}
