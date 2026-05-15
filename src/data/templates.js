// Starter templates surfaced by the New + Templates buttons in the
// builder header and the demo loaded at first paint. The JSON files
// live in `src/assets/templates/`; their display order, titles, and
// descriptions are driven by `manifest.json` in the same directory.
// Vite inlines every template at build time (no runtime fetch).

import manifest from '@/assets/templates/manifest.json';

// Glob the entire templates directory as raw text. Importing as parsed
// JSON would strip the user's chosen indentation and comment placement;
// keeping the raw text means the editor renders the file exactly as it
// sits on disk when a template is loaded.
const rawFiles = import.meta.glob('@/assets/templates/*.json', {
    eager: true,
    query: '?raw',
    import: 'default',
});

const fileTextByName = {};
for (const [path, text] of Object.entries(rawFiles)) {
    const name = path.split('/').pop();
    // `manifest.json` lives alongside the templates but isn't itself one.
    if (name === 'manifest.json') continue;
    fileTextByName[name] = text;
}

// Ordered list of { filename, title, description, text } in manifest order.
// Anything in the manifest whose file is missing on disk is dropped (logged
// once so a renamed-file mistake doesn't silently vanish from the picker).
export const TEMPLATES = manifest
    .map((entry) => {
        const text = fileTextByName[entry.file];
        if (text == null) {
            console.warn(`[templates] manifest entry "${entry.file}" has no matching file on disk; skipping.`);
            return null;
        }
        return {
            filename: entry.file,
            title: entry.title,
            description: entry.description,
            text,
        };
    })
    .filter(Boolean);

export function getTemplateByFile(filename) {
    return TEMPLATES.find((t) => t.filename === filename) || null;
}

// Well-known templates referenced by name from the editor (the New button
// loads the blank one; the page loads the demo at first paint).
export const BLANK_TEMPLATE_FILE = 'New Empty Control Profile.json';
export const DEMO_TEMPLATE_FILE = 'Demo Control Profile.json';
