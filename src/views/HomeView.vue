<template>
    <Splitpanes
        id="editor-frame"
        class="default-theme"
        @resized="onResize('outer', $event)">
        <Pane
            :size="outerSizes[0]"
            :min-size="15">
            <div id="builder-column">
                <BuilderPanel
                    :profile="rawProfile"
                    @update:profile="onBuilderEdit" />
            </div>
        </Pane>
        <Pane
            :size="outerSizes[1]"
            :min-size="30">
            <Splitpanes
                horizontal
                class="default-theme"
                @resized="onResize('right-col', $event)">
                <Pane
                    :size="rightColSizes[0]"
                    :min-size="25">
                    <div id="preview">
                        <div class="preview-sticky-header">
                            <div class="preview-toolbar">
                                <label class="show-hidden-toggle">
                                    <input
                                        type="checkbox"
                                        v-model="showHidden" />
                                    <span>Show hidden controls (testing only)</span>
                                </label>
                                <button
                                    v-if="validationWarnings.length > 0"
                                    class="btn-warnings-toggle"
                                    @click="warningsExpanded = !warningsExpanded">
                                    {{ validationWarnings.length }} warning{{ validationWarnings.length === 1 ? '' : 's' }}
                                    <span class="caret">{{ warningsExpanded ? '▾' : '▸' }}</span>
                                </button>
                            </div>
                            <div
                                v-if="validationWarnings.length > 0 && warningsExpanded"
                                class="preview-warnings">
                                <p class="warnings-intro">
                                    These don't block the preview — Zoom may still
                                    accept the profile, and the rest of the file
                                    renders below.
                                </p>
                                <ul>
                                    <li
                                        v-for="(w, i) in validationWarnings"
                                        :key="i">
                                        <code>{{ w.path }}</code>: {{ w.message }}
                                    </li>
                                </ul>
                            </div>
                            <div
                                v-if="showHidden && hasHiddenContent"
                                class="preview-banner">
                                Show hidden controls is for testing only. Hidden
                                controls are not able to be made visible from a Zoom
                                Rooms control interface.
                            </div>
                        </div>
                        <div
                            v-if="calculatedControls && calculatedControls.eventOnly && !showHidden"
                            class="event-only-placeholder">
                            <p class="title">Event-only mode</p>
                            <p>
                                This profile sets
                                <code>zr_event_only=true</code>. The Native Room
                                Controls UI is hidden in Zoom Rooms; only the event
                                rules will run. Enable "Show hidden controls" above to
                                preview what's defined.
                            </p>
                        </div>
                        <div
                            id="zoom-controls"
                            :class="{ 'event-only-shown': calculatedControls && calculatedControls.eventOnly }"
                            v-if="calculatedControls != null && shouldRenderControls">
                            <div
                                class="scenes-section"
                                v-if="calculatedControls.scenes && calculatedControls.scenes.length > 0">
                                <div class="section-header">
                                    <p class="section-label">Scenes</p>
                                    <button
                                        v-if="calculatedControls.scenes.length > 8"
                                        class="btn-collapse"
                                        :class="{ expanded: scenesExpanded }"
                                        @click="scenesExpanded = !scenesExpanded">
                                        <span class="material-icons">keyboard_arrow_down</span>
                                    </button>
                                </div>
                                <div class="scenes-grid">
                                    <button
                                        v-for="(scene, i) in visibleScenes"
                                        :key="i"
                                        class="btn-scene"
                                        @click="sceneClick(scene)">
                                        <span
                                            v-if="scene.icon && scene.icon.startsWith('mdi:')"
                                            :class="getMaterialIconClass(scene.icon)"
                                            >{{ getMaterialIconName(scene.icon) }}</span
                                        >
                                        <img
                                            v-else-if="scene.icon"
                                            :src="getIconUrl(scene.icon)" />
                                        <p>{{ scene.name || scene.id }}</p>
                                    </button>
                                </div>
                            </div>
                            <p class="section-label">Devices</p>
                            <template
                                v-for="(adapter, ai) in calculatedControls.adapters"
                                :key="ai">
                                <div
                                    v-for="(port, pi) in adapter.ports"
                                    :key="pi"
                                    class="port">
                                    <div class="header method">
                                        <div class="method-label">
                                            <span
                                                v-if="port.icon && port.icon.startsWith('mdi:')"
                                                :class="getMaterialIconClass(port.icon)"
                                                >{{ getMaterialIconName(port.icon) }}</span
                                            >
                                            <img
                                                v-else-if="port.icon"
                                                :src="getIconUrl(port.icon)" />
                                            <p>{{ port.name }}</p>
                                        </div>
                                        <div
                                            v-if="port.main_method && (!port.main_method.userHidden || showHidden)"
                                            :class="{
                                                'main-method-area': true,
                                                'hidden-control':
                                                    port.main_method.userHidden &&
                                                    !(calculatedControls && calculatedControls.eventOnly),
                                            }">
                                            <template v-if="port.main_method.params">
                                                <div class="button-group">
                                                    <div
                                                        v-for="(param, mi) in port.main_method.params"
                                                        :key="mi">
                                                        <button
                                                            class="btn-zoom"
                                                            :class="{
                                                                'btn-rectangle': param.icon == null,
                                                                'btn-circle': param.icon != null,
                                                            }"
                                                            @click="zoomClick(adapter, port, port.main_method, param)">
                                                            <p v-if="!param.icon">
                                                                {{ param.name }}
                                                            </p>
                                                            <span
                                                                v-else-if="param.icon && param.icon.startsWith('mdi:')"
                                                                :class="getMaterialIconClass(param.icon)"
                                                                >{{ getMaterialIconName(param.icon) }}</span
                                                            >
                                                            <img
                                                                v-else
                                                                :src="getIconUrl(param.icon)" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </template>
                                            <template v-else-if="port.main_method.type != 'actions'">
                                                <button
                                                    class="btn-zoom"
                                                    :class="{
                                                        'btn-rectangle': port.main_method.icon == null,
                                                        'btn-circle': port.main_method.icon != null,
                                                    }"
                                                    @click="zoomClick(adapter, port, port.main_method)">
                                                    <p v-if="!port.main_method.icon">
                                                        {{ port.main_method.name }}
                                                    </p>
                                                    <span
                                                        v-if="port.main_method.icon && port.main_method.icon.startsWith('mdi:')"
                                                        :class="getMaterialIconClass(port.main_method.icon)"
                                                        >{{ getMaterialIconName(port.main_method.icon) }}</span
                                                    >
                                                    <img
                                                        v-else
                                                        :src="getIconUrl(port.main_method.icon)" />
                                                </button>
                                            </template>
                                        </div>
                                    </div>
                                    <template v-if="!port.showOnlyMainMethod">
                                        <div class="divider"></div>
                                        <template
                                            v-for="(method, mi) in port.methods"
                                            :key="mi">
                                            <div
                                                v-if="!method.rolledUp && (method.visible || showHidden)"
                                                class="method"
                                                :class="{
                                                    'hidden-control':
                                                        !method.visible &&
                                                        !(calculatedControls && calculatedControls.eventOnly),
                                                }">
                                                <div class="method-label">
                                                    <span
                                                        v-if="method.icon && method.icon.startsWith('mdi:')"
                                                        :class="getMaterialIconClass(method.icon)"
                                                        >{{ getMaterialIconName(method.icon) }}</span
                                                    >
                                                    <img
                                                        v-else-if="method.icon"
                                                        :src="getIconUrl(method.icon)" />
                                                    <p>{{ method.name }}</p>
                                                </div>
                                                <div
                                                    class="button-group"
                                                    v-if="method.params">
                                                    <div
                                                        v-for="(param, ppi) in method.params"
                                                        :key="ppi">
                                                        <button
                                                            class="btn-zoom"
                                                            :class="{
                                                                'btn-rectangle': param.icon == null,
                                                                'btn-circle': param.icon != null,
                                                            }"
                                                            @click="zoomClick(adapter, port, method, param)">
                                                            <p v-if="!param.icon">
                                                                {{ param.name }}
                                                            </p>
                                                            <span
                                                                v-else-if="param.icon && param.icon.startsWith('mdi:')"
                                                                :class="getMaterialIconClass(param.icon)"
                                                                >{{ getMaterialIconName(param.icon) }}</span
                                                            >
                                                            <img
                                                                v-else
                                                                :src="getIconUrl(param.icon)" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div v-else-if="method.type != 'actions'">
                                                    <button
                                                        class="btn-zoom"
                                                        :class="{
                                                            'btn-rectangle': method.icon == null,
                                                            'btn-circle': method.icon != null,
                                                        }"
                                                        @click="zoomClick(adapter, port, method)">
                                                        <p v-if="!method.icon">
                                                            {{ method.name }}
                                                        </p>
                                                        <span
                                                            v-else-if="method.icon && method.icon.startsWith('mdi:')"
                                                            :class="getMaterialIconClass(method.icon)"
                                                            >{{ getMaterialIconName(method.icon) }}</span
                                                        >
                                                        <img
                                                            v-else
                                                            :src="getIconUrl(method.icon)" />
                                                    </button>
                                                </div>
                                            </div>
                                        </template>
                                    </template>
                                </div>
                            </template>
                        </div>
                        <div
                            v-else-if="parseError"
                            id="json-invalid">
                            <h1>JSON Parse Error</h1>
                            <p>{{ parseError }}</p>
                        </div>
                    </div>
                </Pane>
                <Pane
                    :size="rightColSizes[1]"
                    :min-size="15">
                    <Splitpanes
                        class="default-theme"
                        @resized="onResize('bottom-row', $event)">
                        <Pane
                            :size="bottomRowSizes[0]"
                            :min-size="20">
                            <div id="json-pane">
                                <div class="json-toolbar">
                                    <button
                                        class="btn-download"
                                        :disabled="rawProfile === null"
                                        :title="rawProfile === null ? 'Fix JSON errors to enable download' : 'Download profile JSON'"
                                        @click="onDownload">
                                        Download
                                    </button>
                                </div>
                                <Codemirror
                                    v-model="json"
                                    class="json-editor"
                                    :extensions="cmExtensions"
                                    :indent-with-tab="true"
                                    :tab-size="4"
                                    placeholder="// JSON profile..." />
                            </div>
                        </Pane>
                        <Pane
                            :size="bottomRowSizes[1]"
                            :min-size="20">
                            <div id="output-pane">
                                <div
                                    class="events-section"
                                    v-if="calculatedControls && calculatedControls.resolvedRules && calculatedControls.resolvedRules.length > 0">
                                    <p class="section-label">Zoom Room Events</p>
                                    <div class="events-grid">
                                        <button
                                            v-for="(rule, i) in calculatedControls.resolvedRules"
                                            :key="i"
                                            class="btn-event"
                                            :title="rule.event"
                                            @click="eventClick(rule)">
                                            {{ eventLabel(rule.event) }}
                                        </button>
                                    </div>
                                </div>
                                <div
                                    id="zoom-output"
                                    v-if="target">
                                    <p id="zoom-output-target">{{ target }}</p>
                                    <hr class="zoom-output-divider" />
                                    <div id="zoom-output-command">
                                        <div
                                            v-if="commands.length === 0"
                                            class="command-row">
                                            <span class="command-empty">(no commands)</span>
                                        </div>
                                        <div
                                            v-for="(c, i) in commands"
                                            :key="i"
                                            class="command-row">
                                            <span class="command-address">{{ c.address }}:</span>
                                            <pre class="command-text"><span v-for="(seg, j) in splitCommand(c.command)" :key="j" :class="{ ws: seg.ws }">{{ seg.text }}</span></pre>
                                        </div>
                                    </div>
                                </div>
                                <p
                                    v-else
                                    id="output-empty">
                                    Click a scene, device control, or event to see the resolved
                                    command(s) here.
                                </p>
                            </div>
                        </Pane>
                    </Splitpanes>
                </Pane>
            </Splitpanes>
        </Pane>
    </Splitpanes>
</template>

<script>
import exampleJson from '@/assets/example.json';
import { validateProfile } from '@/validation/validateProfile';
import { transformProfile, formatCommand } from '@/validation/transformProfile';
import { schemaState, loadRemoteSchema } from '@/validation/schemaLoader';
import BuilderPanel from '@/components/BuilderPanel.vue';
import { Splitpanes, Pane } from 'splitpanes';
import { eventLabel } from '@/data/zoomEvents';
import { Codemirror } from 'vue-codemirror';
import { json as cmJsonLang } from '@codemirror/lang-json';
import { jsonSchema as cmJsonSchema } from 'codemirror-json-schema';

// Vite replacement for webpack's require.context. Eagerly imports every PNG
// under zoom_icons/dark/ as a URL and indexes them by the filename stem so the
// JSON's icon-by-name references resolve cleanly.
const iconModules = import.meta.glob('@/assets/zoom_icons/dark/*.png', {
    eager: true,
    query: '?url',
    import: 'default',
});
const iconMap = Object.fromEntries(
    Object.entries(iconModules).map(([path, url]) => {
        const name = path.split('/').pop().replace(/\.png$/, '');
        return [name, url];
    })
);
const fallbackIcon = iconMap['icon_alert'];

// Splitpane sizes are persisted to localStorage under a versioned key so a
// future layout change can ignore stale values rather than render a broken UI.
const LAYOUT_KEY_PREFIX = 'zrcpe.layout.v1.';

function loadSizes(name, defaults) {
    try {
        const raw = localStorage.getItem(LAYOUT_KEY_PREFIX + name);
        if (!raw) return defaults;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed) || parsed.length !== defaults.length) return defaults;
        if (!parsed.every((n) => typeof n === 'number' && n >= 0 && n <= 100)) return defaults;
        return parsed;
    } catch {
        return defaults;
    }
}

function saveSizes(name, panes) {
    try {
        localStorage.setItem(
            LAYOUT_KEY_PREFIX + name,
            JSON.stringify(panes.map((p) => p.size))
        );
    } catch {
        // Private mode / quota exceeded / disabled storage — fail silently;
        // the UI still works, just doesn't persist.
    }
}

// Zoom doesn't care about top-level key order, but Zoom's own example
// profiles follow info → adapters → scenes → styles → rules → response_filters.
// We normalize to that order whenever the builder emits a change so newly-added
// blocks like `info` don't get appended to the bottom. Hand-edits in the
// textarea preserve whatever order the user typed.
const PROFILE_KEY_ORDER = [
    '$schema',
    'info',
    'adapters',
    'scenes',
    'styles',
    'rules',
    'response_filters',
];

// Stamped into info.tool on download so consumers of the file can trace it
// back to this editor. Placeholder until we have a real hosted URL.
const EDITOR_URL = 'https://github.com/SpectrumIntegrators/ZoomRoomControlProfileEditor';

function todayIso() {
    // YYYY-MM-DD in local time. Date.toISOString uses UTC, which can drift
    // a day off near midnight; build the string from local components.
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function orderProfileKeys(profile) {
    const ordered = {};
    for (const key of PROFILE_KEY_ORDER) {
        if (key in profile) ordered[key] = profile[key];
    }
    for (const key of Object.keys(profile)) {
        if (!(key in ordered)) ordered[key] = profile[key];
    }
    return ordered;
}

export default {
    name: 'HomeView',
    components: { BuilderPanel, Splitpanes, Pane, Codemirror },
    data: () => ({
        json: JSON.stringify(exampleJson, null, 4),
        target: '',
        commands: [],
        scenesExpanded: false,
        showHidden: false,
        warningsExpanded: false,
        outerSizes: loadSizes('outer', [35, 65]),
        rightColSizes: loadSizes('right-col', [70, 30]),
        bottomRowSizes: loadSizes('bottom-row', [65, 35]),
    }),
    created() {
        loadRemoteSchema();
    },
    watch: {
        // When `zr_event_only=true` is added to the profile (either via the
        // builder checkbox or a JSON paste), auto-enable "Show hidden controls"
        // so the user can see what they just made event-only instead of staring
        // at the placeholder. We only react to the false→true transition so a
        // manual uncheck of showHidden stays unchecked through later edits.
        'calculatedControls.eventOnly'(newVal, oldVal) {
            if (newVal === true && oldVal === false) {
                this.showHidden = true;
            }
        },
    },
    methods: {
        getIconUrl(iconName) {
            return iconMap[iconName] ?? fallbackIcon;
        },
        getMaterialIconName(iconName) {
            if (!iconName) return '';
            const parts = iconName.split(':');
            return parts.length > 1 ? parts[1] : '';
        },
        getMaterialIconClass(iconName) {
            if (!iconName) return 'material-icons';
            const parts = iconName.split(':');
            if (parts.length <= 2) return 'material-icons';
            switch (parts[2]) {
                case 'outlined':
                    return 'material-icons-outlined';
                case 'rounded':
                    return 'material-icons-round';
                case 'sharp':
                    return 'material-icons-sharp';
                case 'two_tone':
                    return 'material-icons-two-tone';
                case 'filled':
                default:
                    return 'material-icons';
            }
        },
        splitCommand(text) {
            const segments = [];
            let buffer = '';
            for (const ch of text) {
                if (ch === ' ') {
                    if (buffer) {
                        segments.push({ ws: false, text: buffer });
                        buffer = '';
                    }
                    segments.push({ ws: true, text: ' ' });
                } else {
                    buffer += ch;
                }
            }
            if (buffer) segments.push({ ws: false, text: buffer });
            return segments;
        },
        zoomClick(adapter, port, method, param) {
            this.target = param ? `${port.id}.${method.id}.${param.id}` : `${port.id}.${method.id}`;
            this.commands = [formatCommand(adapter, port, method, param)];
        },
        sceneClick(scene) {
            this.target = scene.id;
            this.commands = scene.resolvedCommands;
        },
        eventClick(rule) {
            this.target = rule.event;
            this.commands = rule.commands;
        },
        eventLabel,
        onResize(name, panes) {
            saveSizes(name, panes);
        },
        onBuilderEdit(updated) {
            this.json = JSON.stringify(orderProfileKeys(updated), null, 4);
        },
        onDownload() {
            // Parse the current JSON, stamp metadata, then download. If the
            // JSON doesn't parse we bail (the button is disabled in that case,
            // but a keyboard shortcut or programmatic call could still reach
            // here).
            let profile;
            try {
                profile = JSON.parse(this.json);
            } catch {
                return;
            }
            if (!profile.info) profile.info = {};
            profile.info.createdDate = todayIso();
            if (!profile.info.tool) profile.info.tool = EDITOR_URL;
            const ordered = orderProfileKeys(profile);
            const text = JSON.stringify(ordered, null, 4);
            // Also reflect the metadata stamps back into the editor so what
            // the user downloaded matches what they're looking at.
            this.json = text;

            const parts = [profile.info.customer, profile.info.location, 'Zoom Room Control Profile']
                .map((s) => (typeof s === 'string' ? s.trim() : ''))
                .filter(Boolean);
            const filename = `${parts.join(' ')}.json`;

            const blob = new Blob([text], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        },
    },
    computed: {
        // CodeMirror extensions. Rebuilt when the remote schema arrives so
        // autocomplete/lint/hover swap from the bundled schema to the live one
        // without a page reload. vue-codemirror watches :extensions and
        // reconfigures the EditorView, so the swap is non-destructive.
        cmExtensions() {
            // Read schemaState.version so this re-runs when the remote schema
            // is fetched and swapped in.
            schemaState.version;
            return [cmJsonSchema(schemaState.schema), cmJsonLang()];
        },
        rawProfile() {
            // Parsed-but-not-transformed view of the profile, fed to the
            // builder. Kept separate from `calculatedControls` because the
            // transform mutates its input (visibility flags, resolved scenes,
            // etc.) — the builder needs the user-authored shape.
            try {
                return JSON.parse(this.json);
            } catch {
                return null;
            }
        },
        hasHiddenContent() {
            const ctrl = this.calculatedControls;
            if (!ctrl) return false;
            if (ctrl.eventOnly) return true;
            for (const adapter of ctrl.adapters || []) {
                for (const port of adapter.ports || []) {
                    for (const method of port.methods || []) {
                        // userHidden captures the user's explicit `invisible=true`
                        // style, which is what should drive the warning banner —
                        // not the rolledUp flag, which only means "shown in
                        // header instead of list."
                        if (method.userHidden) return true;
                    }
                }
            }
            return false;
        },
        shouldRenderControls() {
            const ctrl = this.calculatedControls;
            if (!ctrl) return false;
            // event-only profiles suppress the whole UI in real Zoom; mirror
            // that here unless the testing toggle is on.
            if (ctrl.eventOnly && !this.showHidden) return false;
            return true;
        },
        visibleScenes() {
            if (!this.calculatedControls || !this.calculatedControls.scenes) return [];
            const scenes = this.calculatedControls.scenes;
            if (this.scenesExpanded || scenes.length <= 8) return scenes;
            return scenes.slice(0, 8);
        },
        // Validation findings — schema, cross-ref, and quirk errors. These are
        // surfaced as warnings in a banner above the preview; they no longer
        // block rendering. We want the tool to keep working when Zoom adds a
        // new adapter model or URL scheme we haven't catalogued yet.
        validationWarnings() {
            schemaState.version;
            if (!this.rawProfile) return [];
            const result = validateProfile(this.json, this.rawProfile);
            return result.errors || [];
        },
        // Hard error — set only when the JSON itself can't be parsed, since
        // there's literally nothing to render in that case.
        parseError() {
            if (this.rawProfile !== null) return null;
            try {
                JSON.parse(this.json);
                return null;
            } catch (e) {
                return e && e.message ? e.message : 'JSON parsing failed';
            }
        },
        calculatedControls() {
            // Read schemaState.version so this re-runs when the remote schema arrives.
            schemaState.version;

            if (!this.rawProfile) return null;
            if (!Array.isArray(this.rawProfile.adapters)) return null;

            // transformProfile mutates its input; clone so subsequent re-runs
            // see the freshly-parsed profile, not a previously-transformed one.
            // The transform is now defensive against missing/malformed fields;
            // wrap in try/catch as belt-and-suspenders in case something
            // unexpected still slips through.
            try {
                const clone = JSON.parse(JSON.stringify(this.rawProfile));
                return transformProfile(clone);
            } catch (e) {
                console.warn('[transformProfile] threw:', e);
                return null;
            }
        },
    },
};
</script>

<style lang="scss">
@use 'sass:color';
@use '@/styles/colors' as c;
@use '@/styles/buttons' as b;

$zoom-panel-width: 666px;
$zoom-button-height: 58px;

#editor-frame {
    // splitpanes' default-theme paints the panes grey, but we want each
    // pane's inner div to control the background. Make panes transparent.
    &.splitpanes,
    .splitpanes {
        .splitpanes__pane {
            background-color: transparent;
        }
    }
}

#builder-column {
    height: 100%;
    padding-right: 0.5rem;
    overflow: hidden;
}

#preview {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    overflow: auto;
    padding: 0.5rem 0.5rem 0.5rem 0.5rem;
    gap: 0.5rem;

    .preview-sticky-header {
        align-self: stretch;
        position: sticky;
        // Stick at -0.5rem so the header pins itself to the preview's border
        // edge rather than its padding edge — otherwise scrolled content peeks
        // through the 0.5rem padding gap above the header.
        top: -0.5rem;
        z-index: 1;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        background: c.$background;
        // Bleed sideways/upward into the preview's padding so the background
        // covers the full pane width and the top edge.
        margin: -0.5rem -0.5rem 0;
        padding: 0.5rem 0.5rem 0.5rem;
    }

    .preview-toolbar {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 0.5rem;
        padding: 0 4px;

        .show-hidden-toggle {
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            font-size: 0.85rem;
            color: c.$text-dark;
            opacity: 0.8;
            cursor: pointer;
            user-select: none;

            input[type='checkbox'] {
                cursor: pointer;
            }
        }
    }

    .preview-banner {
        background: #fef3c7;
        border: 1px solid #f59e0b;
        color: #78350f;
        padding: 0.5rem 0.75rem;
        border-radius: 6px;
        font-size: 0.85rem;
        line-height: 1.4;
    }

    .btn-warnings-toggle {
        @include b.btn-shared;
        margin-left: auto;
        background: #fef3c7;
        border: 1px solid #f59e0b;
        color: #78350f;
        padding: 0.15rem 0.55rem;
        border-radius: 4px;
        font-size: 0.78rem;
        line-height: 1.4;
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;

        .caret {
            font-size: 0.7rem;
            opacity: 0.7;
        }

        &:hover {
            background: #fde68a;
        }
    }

    .preview-warnings {
        background: #fef3c7;
        border: 1px solid #f59e0b;
        color: #78350f;
        padding: 0.5rem 0.75rem;
        border-radius: 6px;
        font-size: 0.8rem;
        line-height: 1.4;
        max-height: 180px;
        overflow: auto;

        .warnings-intro {
            font-style: italic;
            opacity: 0.85;
            margin-bottom: 0.4rem;
        }

        ul {
            margin: 0;
            padding-left: 1.2rem;

            li {
                margin: 0.15rem 0;
            }
        }

        code {
            font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace;
            font-size: 0.78rem;
            background: rgba(0, 0, 0, 0.05);
            padding: 1px 4px;
            border-radius: 3px;
        }
    }

    .event-only-placeholder {
        align-self: stretch;
        background: #fff;
        border: 1px dashed c.$border;
        border-radius: 8px;
        padding: 1.5rem;
        color: c.$text-dark;
        font-size: 0.95rem;
        line-height: 1.5;

        .title {
            font-weight: 600;
            margin-bottom: 0.5rem;
        }

        code {
            font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace;
            background: #f4f4f5;
            padding: 1px 4px;
            border-radius: 3px;
            font-size: 0.9em;
        }
    }

    #json-invalid {
        width: 100%;
        background: c.$error;
        color: c.$text-light;
        text-align: center;
        padding: 1rem;

        h1 {
            font-size: 1.5rem;
        }
    }

    #zoom-controls {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        justify-content: flex-start;
        gap: 1rem;
        width: $zoom-panel-width;
        flex-shrink: 0;

        // When zr_event_only=true is set and the user has chosen to peek, the
        // whole UI is "hidden" in production — dash + dim the container to
        // make that clear.
        &.event-only-shown {
            outline: 2px dashed c.$border;
            outline-offset: -2px;
            opacity: 0.7;
            padding: 8px;
            border-radius: 12px;
        }

        .section-label {
            font-size: 16px;
            font-weight: 500;
            color: c.$text-dark;
            opacity: 0.7;
            margin-left: 4px;
        }

        .scenes-section {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;

            .section-header {
                display: flex;
                flex-direction: row;
                align-items: center;
                justify-content: space-between;
                padding-right: 4px;
            }

            .btn-collapse {
                @include b.btn-shared;

                border: 1px solid c.$border;
                border-radius: 50%;
                background: transparent;
                color: c.$text-dark;
                width: 28px;
                height: 28px;
                padding: 0;
                line-height: 1;

                display: flex;
                align-items: center;
                justify-content: center;

                .material-icons {
                    font-size: 20px;
                    transition: transform 0.15s ease-in-out;
                }

                &.expanded .material-icons {
                    transform: rotate(180deg);
                }
            }

            .scenes-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 1rem;
            }

            .btn-scene {
                @include b.btn-shared;

                border: none;
                border-radius: 10px;
                background: c.$zoom-port-background;
                color: c.$text-dark;
                font-size: 19px;
                font-weight: bold;
                padding: 22px 30px;
                min-height: $zoom-button-height;
                text-align: left;

                display: flex;
                flex-direction: row;
                align-items: center;
                gap: 1rem;

                p {
                    white-space: normal;
                    overflow-wrap: anywhere;
                }

                &:active {
                    background: color.adjust(c.$zoom-port-background, $lightness: -5%);
                }
            }
        }

        .port {
            border-radius: 10px;
            background: c.$zoom-port-background;
            padding: 0 30px;
            font-size: 19px;
            width: 100%;

            .header {
                font-weight: bold;
            }

            .divider {
                height: 1px;
                background: c.$zoom-button;
            }

            .method {
                padding: 22px 0;
                display: flex;
                flex-direction: row;
                align-items: flex-start;
                justify-content: space-between;
                gap: 1rem;
            }

            // Applied to either a `.method` row (hidden method in the list)
            // or a `.main-method-area` (invisible main_method being peeked
            // via "Show hidden controls"). Pseudo-element so the dashed
            // marker has its own inset/extents independent of the host
            // element's flex layout.
            .hidden-control {
                opacity: 0.55;
                position: relative;

                &::before {
                    content: '';
                    position: absolute;
                    top: 10px;
                    bottom: 10px;
                    left: -10px;
                    right: -10px;
                    border: 1px dashed c.$border;
                    border-radius: 6px;
                    pointer-events: none;
                }
            }

            .method-label {
                display: flex;
                flex-direction: row;
                align-items: center;
                justify-content: space-between;
                gap: 1rem;
                white-space: nowrap;
                height: $zoom-button-height;
            }

            .button-group {
                display: flex;
                flex-direction: row;
                align-items: center;
                justify-content: flex-end;
                gap: 1rem;
                flex-wrap: wrap;
            }

            .btn-zoom {
                @include b.btn-shared;

                border: none;
                font-size: 20px;

                background-color: c.$zoom-button;
                color: c.$text-dark;

                &:active {
                    background: color.adjust(c.$zoom-button, $lightness: -10%);
                }

                &.btn-circle {
                    border-radius: 50%;
                    padding: 0;
                    width: $zoom-button-height;
                    height: $zoom-button-height;

                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                &.btn-rectangle {
                    border-radius: 12px;
                    padding: 0 22px;
                    min-width: 93px;
                    height: $zoom-button-height;
                }
            }
        }
    }
}

#json-pane {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 0.5rem;
    gap: 0.4rem;
    min-height: 0;
}

.json-toolbar {
    flex: 0 0 auto;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.4rem;
}

.btn-download {
    @include b.btn-shared;
    background: c.$primary;
    color: c.$text-light;
    border: none;
    padding: 0.3rem 0.8rem;
    border-radius: 4px;
    font-size: 0.85rem;

    &:hover:not(:disabled) {
        background: c.$accent;
    }

    &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
}

// vue-codemirror's wrapper div uses `display: contents` (set inline), so any
// flex/border/height applied to it is ignored — the real .cm-editor becomes
// a direct flex child of #json-pane. Style it directly so it fills the
// remaining pane height, and lock the scroller to overflow:auto so the editor
// scrolls internally instead of growing past the pane.
#json-pane {
    .cm-editor {
        flex: 1 1 auto;
        min-height: 0;
        border: 1px solid c.$border;

        &.cm-focused {
            outline: none;
        }
    }

    .cm-scroller {
        overflow: auto;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace;
        font-size: 0.85rem;
    }
}

#output-pane {
    height: 100%;
    padding: 0.5rem;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;

    #output-empty {
        color: c.$text-dark;
        opacity: 0.5;
        font-style: italic;
        font-size: 0.9rem;
        padding: 1rem;
        text-align: center;
    }

    .events-section {
        flex: 0 0 auto;

        .section-label {
            font-size: 14px;
            font-weight: 500;
            color: c.$text-dark;
            opacity: 0.7;
            margin-bottom: 0.4rem;
        }

        .events-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 0.4rem;
        }

        .btn-event {
            @include b.btn-shared;

            background: #fff;
            color: c.$text-dark;
            border: 1px solid c.$border;
            border-radius: 4px;
            padding: 0.15rem 0.6rem;
            font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace;
            font-size: 0.85rem;
            line-height: 1.5;

            &:hover {
                background: c.$zoom-button;
            }

            &:active {
                background: color.adjust(c.$zoom-button, $lightness: -10%);
            }
        }
    }

    .command-empty {
        color: c.$text-dark;
        opacity: 0.5;
        font-style: italic;
    }

    #zoom-output {
        border: 1px solid c.$border;
        background: #fff;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        padding: 0.5rem;

        #zoom-output-target {
            font-size: 1rem;
            margin: 0;
            white-space: pre-wrap;
        }

        .zoom-output-divider {
            border: none;
            border-top: 1px solid c.$zoom-button;
            margin: 0;
        }

        #zoom-output-command {
            display: flex;
            flex-direction: column;
            gap: 0.3rem;

            .command-row {
                display: flex;
                flex-direction: row;
                align-items: center;
                gap: 0.4rem;
                flex-wrap: wrap;
            }

            .command-address {
                font-family: inherit;
            }

            .command-text {
                font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace;
                background: #f4f4f5;
                border: 1px solid c.$border;
                border-radius: 4px;
                padding: 1px 4px;
                margin: 0;
                line-height: 1.3;
                white-space: pre-wrap;

                .ws {
                    background-image: radial-gradient(
                        circle at center,
                        rgba(0, 0, 0, 0.35) 1px,
                        transparent 1.5px
                    );
                    background-repeat: no-repeat;
                    background-position: center;
                }
            }
        }
    }
}
</style>
