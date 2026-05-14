<template>
    <div
        id="editor-frame-wrap"
        :class="{ 'preview-fullscreen': previewFullscreen }">
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
                    @update:json="onBuilderEdit"
                    @download="onDownload" />
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
                    <div
                        id="preview"
                        :class="{
                            'dark-preview': previewDark,
                            'variant-ipad': previewVariant === 'ipad',
                            'log-open': logVisible,
                        }">
                        <div class="preview-content">
                        <div class="preview-sticky-header">
                            <div class="preview-toolbar">
                                <label class="show-hidden-toggle">
                                    <input
                                        type="checkbox"
                                        v-model="showHidden" />
                                    <span>Show hidden controls (testing only)</span>
                                </label>
                                <div class="toolbar-right">
                                    <button
                                        v-if="validationWarnings.length > 0"
                                        class="btn-warnings-toggle"
                                        @click="warningsExpanded = !warningsExpanded">
                                        {{ validationWarnings.length }} warning{{ validationWarnings.length === 1 ? '' : 's' }}
                                        <span class="caret">{{ warningsExpanded ? '▾' : '▸' }}</span>
                                    </button>
                                    <button
                                        class="btn-theme-toggle"
                                        :title="previewDark ? 'Switch preview to light theme' : 'Switch preview to dark theme'"
                                        @click="previewDark = !previewDark">
                                        <span class="material-icons">contrast</span>
                                    </button>
                                    <button
                                        class="btn-theme-toggle"
                                        :title="previewFullscreen ? 'Exit preview fullscreen' : 'Expand preview to fill the editor'"
                                        @click="previewFullscreen = !previewFullscreen">
                                        <span class="material-icons">
                                            {{ previewFullscreen ? 'fullscreen_exit' : 'fullscreen' }}
                                        </span>
                                    </button>
                                    <button
                                        class="btn-theme-toggle"
                                        :class="{ active: logVisible }"
                                        :title="logButtonTitle"
                                        @click="logVisible = !logVisible">
                                        <span class="material-icons">receipt_long</span>
                                        <span
                                            v-if="logUnreadCount > 0"
                                            class="log-badge">{{ logUnreadCount }}</span>
                                    </button>
                                </div>
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
                            :class="{
                                'event-only-shown': calculatedControls && calculatedControls.eventOnly,
                                'dark-theme': previewDark,
                                'variant-ipad': previewVariant === 'ipad',
                            }"
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
                        <aside
                            v-if="logVisible"
                            class="log-drawer">
                            <div class="log-drawer-header">
                                <span class="log-title">Activity Log</span>
                                <button
                                    v-if="logEntries.length > 0"
                                    class="log-clear"
                                    title="Clear log"
                                    @click="clearLog">
                                    Clear
                                </button>
                                <button
                                    class="log-close"
                                    title="Hide log"
                                    @click="logVisible = false">
                                    <span class="material-icons">close</span>
                                </button>
                            </div>
                            <div class="log-scroll">
                                <p
                                    v-if="logEntries.length === 0"
                                    class="log-empty">
                                    Activity will appear here as you interact with the
                                    preview, edit the JSON, or hit validation warnings.
                                </p>
                                <div
                                    v-for="(e, i) in logEntries"
                                    :key="i"
                                    :class="['log-entry', 'log-' + e.level]">
                                    <div class="log-line">
                                        <span class="log-time">{{ e.time }}</span>
                                        <span class="log-message">{{ e.message }}</span>
                                    </div>
                                    <ul
                                        v-if="e.details && e.details.length > 0"
                                        class="log-details">
                                        <li
                                            v-for="(d, j) in e.details"
                                            :key="j">
                                            {{ d }}
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </aside>
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
                                <section
                                    class="output-card"
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
                                </section>
                                <section class="output-card">
                                    <p class="section-label">Output</p>
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
                                                <span v-if="c.ref" class="command-ref">{{ c.ref }} →</span>
                                                <template v-if="c.error">
                                                    <span class="command-error">unresolved: {{ c.error }}</span>
                                                </template>
                                                <template v-else>
                                                    <span class="command-address">{{ c.address }}:</span>
                                                    <pre class="command-text"><span v-for="(seg, j) in splitCommand(c.command)" :key="j" :class="{ ws: seg.ws }">{{ seg.text }}</span></pre>
                                                </template>
                                            </div>
                                        </div>
                                    </div>
                                    <p
                                        v-else
                                        id="output-empty">
                                        Click a scene, device control, or event to see the
                                        resolved command(s) here.
                                    </p>
                                </section>
                            </div>
                        </Pane>
                    </Splitpanes>
                </Pane>
            </Splitpanes>
            </Pane>
        </Splitpanes>
    </div>
</template>

<script>
import exampleJson from '@/assets/example.json';
import { validateProfile } from '@/validation/validateProfile';
import { transformProfile, formatCommand } from '@/validation/transformProfile';
import { schemaState, loadRemoteSchema } from '@/validation/schemaLoader';
import BuilderPanel from '@/components/BuilderPanel.vue';
import { EDITOR_URL, todayIso, orderProfileKeys } from '@/config';
import { Splitpanes, Pane } from 'splitpanes';
import { eventLabel } from '@/data/zoomEvents';
import { Codemirror } from 'vue-codemirror';
import { json as cmJsonLang } from '@codemirror/lang-json';
import { jsonSchema as cmJsonSchema } from 'codemirror-json-schema';

// Vite replacement for webpack's require.context. Eagerly imports every PNG
// under zoom_icons/{dark,light}/ as a URL and indexes them by the filename
// stem so the JSON's icon-by-name references resolve cleanly. We keep both
// variants so the preview can swap icon assets when the theme toggles.
//   - dark/  → dark-stroke icons designed for the light theme
//   - light/ → light-stroke icons designed for the dark theme
const darkVariantModules = import.meta.glob('@/assets/zoom_icons/dark/*.png', {
    eager: true,
    query: '?url',
    import: 'default',
});
const lightVariantModules = import.meta.glob('@/assets/zoom_icons/light/*.png', {
    eager: true,
    query: '?url',
    import: 'default',
});
function indexIcons(modules) {
    return Object.fromEntries(
        Object.entries(modules).map(([path, url]) => {
            const name = path.split('/').pop().replace(/\.png$/, '');
            return [name, url];
        })
    );
}
const lightThemeIcons = indexIcons(darkVariantModules); // dark-stroke for light bg
const darkThemeIcons = indexIcons(lightVariantModules); // light-stroke for dark bg
const lightFallbackIcon = lightThemeIcons['icon_alert'];
const darkFallbackIcon = darkThemeIcons['icon_alert'] || lightFallbackIcon;

// Splitpane sizes are persisted to localStorage under a versioned key so a
// future layout change can ignore stale values rather than render a broken UI.
const LAYOUT_KEY_PREFIX = 'zrcpe.layout.v1.';

// Activity log: newest first; oldest trimmed past this cap.
const LOG_MAX_ENTRIES = 200;
// JSON-modified events are coalesced — many keystrokes in a short window
// produce one entry, not a hundred.
const JSON_LOG_DEBOUNCE_MS = 600;

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

const PREVIEW_THEME_KEY = 'zrcpe.preview-theme.v1';

function loadPreviewDark() {
    try {
        return localStorage.getItem(PREVIEW_THEME_KEY) === 'dark';
    } catch {
        return false;
    }
}

function savePreviewDark(isDark) {
    try {
        localStorage.setItem(PREVIEW_THEME_KEY, isDark ? 'dark' : 'light');
    } catch {
        // ignore
    }
}

// The Zoom NRC UI looks slightly different on iPad (three shades, filled
// buttons, no borders) vs the browser virtual panel (two shades, outlined
// buttons). iPad is the realistic deployment target; we default there and
// leave the browser variant in the stylesheet for future opt-in. No UI to
// switch right now — flip this constant or add a toggle later.
const PREVIEW_VARIANT_KEY = 'zrcpe.preview-variant.v1';

function loadPreviewVariant() {
    try {
        const v = localStorage.getItem(PREVIEW_VARIANT_KEY);
        if (v === 'browser' || v === 'ipad') return v;
    } catch {
        // ignore
    }
    return 'ipad';
}

function savePreviewVariant(variant) {
    try {
        localStorage.setItem(PREVIEW_VARIANT_KEY, variant);
    } catch {
        // ignore
    }
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
        previewDark: loadPreviewDark(),
        previewVariant: loadPreviewVariant(),
        previewFullscreen: false,
        // Activity log — accumulated in-memory, newest first. Capped at
        // LOG_MAX_ENTRIES so a long session doesn't grow without bound.
        // The log lives in a drawer on the right edge of the preview pane,
        // toggled open via the toolbar button (next to theme / fullscreen).
        logEntries: [],
        logVisible: false,
        logUnreadCount: 0,
        // Internal: throttle id for JSON-modified log entries.
        _jsonLogTimer: null,
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
        previewDark(newVal) {
            savePreviewDark(newVal);
        },
        previewVariant(newVal) {
            savePreviewVariant(newVal);
        },
        json() {
            // Coalesce a burst of keystrokes into one log entry so the user can
            // scan the log without it being a wall of "JSON modified".
            if (this._jsonLogTimer) clearTimeout(this._jsonLogTimer);
            this._jsonLogTimer = setTimeout(() => {
                this._jsonLogTimer = null;
                this.pushLog({ level: 'info', message: 'JSON modified' });
            }, JSON_LOG_DEBOUNCE_MS);
        },
        validationWarnings(newWarnings, oldWarnings) {
            // Log only when the warning count goes UP — every keystroke briefly
            // re-runs validation, but if the count hasn't grown there's nothing
            // new to surface.
            const oldCount = Array.isArray(oldWarnings) ? oldWarnings.length : 0;
            const newCount = Array.isArray(newWarnings) ? newWarnings.length : 0;
            if (newCount > oldCount) {
                this.pushLog({
                    level: 'warn',
                    message: `Validation: ${newCount} warning${newCount === 1 ? '' : 's'}`,
                    details: newWarnings.map((w) => `${w.path}: ${w.message}`),
                });
            }
        },
        parseError(newErr, oldErr) {
            if (newErr && newErr !== oldErr) {
                this.pushLog({ level: 'error', message: 'JSON parse error', details: [newErr] });
            }
        },
        logVisible(isOpen) {
            // Opening the drawer "reads" the current backlog so the badge
            // clears. Reopening later only shows the count of entries that
            // arrived while it was closed.
            if (isOpen) this.logUnreadCount = 0;
        },
    },
    methods: {
        getIconUrl(iconName) {
            const map = this.previewDark ? darkThemeIcons : lightThemeIcons;
            const fb = this.previewDark ? darkFallbackIcon : lightFallbackIcon;
            return map[iconName] ?? fb;
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
        pushLog(entry) {
            const time = new Date().toTimeString().slice(0, 8); // HH:MM:SS
            this.logEntries.unshift({
                time,
                level: entry.level || 'info',
                message: entry.message,
                details: Array.isArray(entry.details) ? entry.details : [],
            });
            if (this.logEntries.length > LOG_MAX_ENTRIES) {
                this.logEntries.length = LOG_MAX_ENTRIES;
            }
            // Badge counts only entries the user hasn't seen — opening the
            // drawer "reads" the current backlog. Cap matches LOG_MAX_ENTRIES
            // so a long-idle user doesn't see "999+"-style overflow.
            if (!this.logVisible && this.logUnreadCount < LOG_MAX_ENTRIES) {
                this.logUnreadCount += 1;
            }
        },
        clearLog() {
            this.logEntries = [];
            this.logUnreadCount = 0;
        },
        logTrigger(kind, label, commands) {
            // Build one log entry for a user-initiated trigger (scene button,
            // event button, or direct control press). Each resolved command is
            // expanded as a detail line so the user can see what `port.method`
            // -> `address: bytes` actually fired. Errors surface as their own
            // entry with warn level.
            const total = Array.isArray(commands) ? commands.length : 0;
            const errors = (commands || []).filter((c) => c.error);
            const ok = (commands || []).filter((c) => !c.error);
            const details = [
                ...ok.map((c) => `${c.ref} → ${c.address || '(no address)'}: ${c.command || '(empty)'}`),
                ...errors.map((c) => `${c.ref} → unresolved (${c.error})`),
            ];
            const noun =
                kind === 'scene' ? 'Scene' : kind === 'event' ? 'Event' : 'Control';
            const summary =
                total === 0
                    ? `${noun} ${JSON.stringify(label)} → no commands`
                    : `${noun} ${JSON.stringify(label)} → ${total} command${total === 1 ? '' : 's'}`;
            this.pushLog({
                level: errors.length > 0 ? 'warn' : 'info',
                message: summary,
                details,
            });
        },
        zoomClick(adapter, port, method, param) {
            const ref = param ? `${port.id}.${method.id}.${param.id}` : `${port.id}.${method.id}`;
            this.target = ref;
            const fc = formatCommand(adapter, port, method, param);
            this.commands = [{ ref, address: fc.address, command: fc.command }];
            this.logTrigger('control', ref, this.commands);
        },
        sceneClick(scene) {
            this.target = scene.id;
            this.commands = scene.resolvedCommands;
            this.logTrigger('scene', scene.name || scene.id, this.commands);
        },
        eventClick(rule) {
            this.target = rule.event;
            this.commands = rule.commands;
            this.logTrigger('event', this.eventLabel(rule.event), this.commands);
        },
        eventLabel,
        onResize(name, panes) {
            saveSizes(name, panes);
        },
        onBuilderEdit(jsonText) {
            // BuilderPanel now emits the serialized JSON text directly so it
            // can include duplicate keys in the info section (impossible from
            // a plain object via JSON.stringify). We just install it as-is.
            this.json = jsonText;
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
            // If the user has an info block, stamp it. If they've deleted it
            // (or it never existed), respect that choice and don't recreate.
            if (profile.info) {
                profile.info.createdDate = todayIso();
                if (!profile.info.tool) profile.info.tool = EDITOR_URL;
            }
            const ordered = orderProfileKeys(profile);
            const text = JSON.stringify(ordered, null, 4);
            // Also reflect the metadata stamps back into the editor so what
            // the user downloaded matches what they're looking at.
            this.json = text;

            // Filename: "<customer> <location> Zoom Room Control Profile.json"
            // with each piece included only when set. No info block → just the
            // generic name.
            const info = profile.info || {};
            const parts = [info.customer, info.location, 'Zoom Room Control Profile']
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
        logButtonTitle() {
            if (this.logVisible) return 'Hide activity log';
            const n = this.logUnreadCount;
            if (n <= 0) return 'Show activity log';
            return `Show activity log (${n} unread entr${n === 1 ? 'y' : 'ies'})`;
        },
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

// Wrapper around the outer Splitpanes. It exists purely so we have a stable
// DOM element to hang the fullscreen-toggle class on — class fallthrough onto
// the Splitpanes component's root was unreliable.
#editor-frame-wrap {
    height: 100%;
    width: 100%;
}

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

// Fullscreen-preview mode: hide the builder, the bottom JSON/output row, and
// both splitter handles so only the preview pane remains. splitpanes sets
// inline `style="width: …%"` / `height: …%` on each pane, so we override with
// `!important` to push the visible pane up to 100%. The hidden panes still
// exist in the DOM — exiting fullscreen restores everything to the user's
// saved splitter positions automatically.
#editor-frame-wrap.preview-fullscreen {
    // Collapse the hidden panes' size to 0 with transitions instead of using
    // `display: none`. Yanking a pane out of layout instantly causes the
    // visible pane to "snap" to the freed edge before its own width transition
    // begins; animating the hidden pane to 0 keeps the visible one anchored
    // until both have finished moving.
    //
    // Outer (vertical) split — target by `.splitpanes--vertical` class rather
    // than by `#editor-frame` id. Vue's id-fallthrough onto the Splitpanes
    // component's root was getting dropped in practice, which meant the
    // id-based selector here matched nothing. Class-based works because
    // Splitpanes always tags its own root with that class.
    // NOTE: do NOT add `max-width: 0` / `max-height: 0` to the collapsing pane
    // — that would clamp the rendered box to 0 on the very first frame and
    // hide the `width`/`height` transition entirely. `min-*: 0` is needed to
    // override flexbox's default `min-*: auto` (intrinsic content size); the
    // visible-pane rules likewise drop `max-*` so we don't clamp on entry.
    > .splitpanes--vertical > .splitpanes__pane:first-child {
        width: 0 !important;
        min-width: 0 !important;
        overflow: hidden;
    }
    > .splitpanes--vertical > .splitpanes__pane:last-child {
        width: 100% !important;
    }
    > .splitpanes--vertical > .splitpanes__splitter {
        display: none !important;
    }

    // Inner (horizontal) split inside the right column: collapse bottom row +
    // expand the preview pane.
    .splitpanes--horizontal {
        > .splitpanes__pane:last-child {
            height: 0 !important;
            min-height: 0 !important;
            overflow: hidden;
        }
        > .splitpanes__pane:first-child {
            height: 100% !important;
        }
        > .splitpanes__splitter {
            display: none !important;
        }
    }
    // #zoom-controls keeps its iPad-portrait width (666 px) — fullscreen just
    // removes the surrounding chrome, it doesn't stretch the Zoom UI itself.
}

#builder-column {
    height: 100%;
    padding-right: 0.5rem;
    overflow: hidden;
}

#preview {
    height: 100%;
    // Positioning context for the log drawer (absolute-positioned child).
    // The actual scrolling lives on `.preview-content` so the drawer stays
    // pinned to the visible viewport edge rather than scrolling along with
    // the controls.
    position: relative;
    overflow: hidden;

    > .preview-content {
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        overflow: auto;
        padding: 0.5rem;
        gap: 0.5rem;
    }

    // Page backgrounds sampled directly from Zoom's actual NRC. The default
    // (no variant class) is the browser virtual-panel palette; the
    // `.variant-ipad` overrides below pull in the iPad-controller palette
    // (which most production Zoom Rooms use). Both variants stay in the
    // stylesheet so we can switch with one class flip.
    background: rgb(247, 249, 250);

    &.dark-preview {
        background: rgb(42, 43, 45);
    }

    &.variant-ipad {
        background: #f7f7fd;

        &.dark-preview {
            background: #242424;
        }
    }

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
        color: firebrick;
        font-style: italic;
        padding: 0.25rem 0.25rem;
        font-size: 0.85rem;
        line-height: 1.4;
    }

    .toolbar-right {
        margin-left: auto;
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 0.4rem;
    }

    .btn-warnings-toggle {
        @include b.btn-shared;
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

    .btn-theme-toggle {
        @include b.btn-shared;
        background: transparent;
        border: 1px solid c.$border;
        color: c.$text-dark;
        border-radius: 4px;
        width: 26px;
        height: 26px;
        padding: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        opacity: 0.7;
        position: relative;
        // `btn-shared` sets `overflow: hidden`; the unread badge needs to
        // spill out past the button corner so override here.
        overflow: visible;

        .material-icons {
            font-size: 16px;
        }

        &:hover {
            opacity: 1;
            background: rgba(0, 0, 0, 0.05);
        }

        &.active {
            background: rgba(0, 0, 0, 0.08);
            opacity: 1;
        }

        .log-badge {
            position: absolute;
            top: -4px;
            right: -6px;
            background: c.$accent;
            color: #fff;
            font-size: 0.6rem;
            font-weight: 600;
            line-height: 1;
            padding: 2px 4px;
            border-radius: 8px;
            min-width: 14px;
            text-align: center;
            pointer-events: none;
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

        // ----- Browser virtual-panel dark theme -----
        // Two-shade design with outlined buttons. Active by default when
        // .variant-ipad isn't set. Colors sampled from Zoom's browser UI.
        &.dark-theme {
            color: rgb(247, 249, 250);

            .section-label {
                color: rgb(147, 155, 164);
                opacity: 1;
            }

            .scenes-section {
                .btn-scene {
                    background: rgb(34, 35, 37);
                    color: rgb(247, 249, 250);

                    &:active {
                        background: rgba(255, 255, 255, 0.05);
                    }
                }

                .btn-collapse {
                    border-color: rgb(104, 111, 121);
                    color: rgb(147, 155, 164);
                }
            }

            .port {
                background: rgb(34, 35, 37);
                color: rgb(247, 249, 250);

                .divider {
                    background: rgba(255, 255, 255, 0.08);
                }

                .btn-zoom {
                    background: transparent;
                    border: 1px solid rgb(104, 111, 121);
                    color: rgb(247, 249, 250);

                    &:active {
                        background: rgba(255, 255, 255, 0.08);
                    }
                }
            }
        }

        // ----- iPad controller theme (active default) -----
        // Three-shade design: page bg → device bg → button bg, getting
        // lighter in dark mode and inverting in light mode. Buttons are
        // filled, no border. Colors sampled from a real iPad Zoom Rooms
        // controller.
        &.variant-ipad {
            .section-label {
                color: #212130;
                opacity: 0.55;
            }

            .scenes-section {
                .btn-scene {
                    background: #ffffff;
                    color: #212130;

                    &:active {
                        background: rgba(0, 0, 0, 0.04);
                    }
                }

                .btn-collapse {
                    border-color: rgba(33, 33, 48, 0.25);
                    color: rgba(33, 33, 48, 0.6);
                }
            }

            .port {
                background: #ffffff;
                color: #212130;

                .divider {
                    background: #efeff3;
                }

                .btn-zoom {
                    background: #efeff3;
                    border: none;
                    color: #212130;

                    &:active {
                        background: rgba(0, 0, 0, 0.06);
                    }
                }
            }

            &.dark-theme {
                color: #f5f5f5;

                .section-label {
                    color: #f5f5f5;
                    opacity: 0.55;
                }

                .scenes-section {
                    .btn-scene {
                        background: #2e2e2e;
                        color: #f5f5f5;

                        &:active {
                            background: rgba(255, 255, 255, 0.04);
                        }
                    }

                    .btn-collapse {
                        border-color: rgba(245, 245, 245, 0.25);
                        color: rgba(245, 245, 245, 0.65);
                    }
                }

                .port {
                    background: #2e2e2e;
                    color: #f5f5f5;

                    .divider {
                        background: #414141;
                    }

                    .btn-zoom {
                        background: #414141;
                        border: none;
                        color: #f5f5f5;

                        &:active {
                            background: rgba(255, 255, 255, 0.06);
                        }
                    }
                }
            }
        }

        .section-label {
            font-size: 16px;
            font-weight: 500;
            color: rgb(104, 111, 121);
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

                border: 1px solid rgb(147, 155, 164);
                border-radius: 50%;
                background: transparent;
                color: rgb(104, 111, 121);
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
                background: rgb(255, 255, 255);
                color: rgb(34, 35, 37);
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
                    background: rgba(0, 0, 0, 0.04);
                }
            }
        }

        .port {
            border-radius: 10px;
            background: rgb(255, 255, 255);
            color: rgb(34, 35, 37);
            padding: 0 30px;
            font-size: 19px;
            width: 100%;

            .header {
                font-weight: bold;
            }

            .divider {
                height: 1px;
                background: rgba(0, 0, 0, 0.08);
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

                border: 1px solid rgb(147, 155, 164);
                font-size: 20px;

                background-color: transparent;
                color: rgb(34, 35, 37);

                &:active {
                    background: rgba(0, 0, 0, 0.05);
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
    gap: 0.6rem;

    // Each section in the output pane is rendered as its own card so the
    // events palette and the resolved-command output read as two related
    // but distinct panels (rather than the output looking like it's part
    // of the events list).
    .output-card {
        flex: 0 0 auto;
        background: #fff;
        border: 1px solid c.$border;
        border-radius: 6px;
        padding: 0.5rem 0.6rem;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;

        .section-label {
            font-size: 0.78rem;
            font-weight: 600;
            color: c.$text-dark;
            opacity: 0.6;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            margin: 0;
        }
    }

    #output-empty {
        color: c.$text-dark;
        opacity: 0.5;
        font-style: italic;
        font-size: 0.85rem;
        padding: 0.3rem 0;
        text-align: center;
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

    .command-empty {
        color: c.$text-dark;
        opacity: 0.5;
        font-style: italic;
    }

    #zoom-output {
        // No border / background — the parent .output-card supplies those.
        display: flex;
        flex-direction: column;
        gap: 0.4rem;

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

            .command-ref {
                font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace;
                font-size: 0.82rem;
                color: c.$text-dark;
                opacity: 0.75;
            }

            .command-error {
                color: firebrick;
                font-style: italic;
                font-size: 0.85rem;
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

// Activity log drawer — pinned to the right edge of the preview pane, slides
// over the controls when toggled open via the toolbar receipt_long button.
// Lives inside `#preview` so it's bounded by the preview pane's edges; the
// drawer doesn't scroll with the controls because `#preview` itself has
// `overflow: hidden` and the scroll moved to `.preview-content`.
.log-drawer {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: clamp(280px, 36%, 420px);
    background: #fff;
    border-left: 1px solid c.$border;
    box-shadow: -4px 0 10px rgba(0, 0, 0, 0.06);
    display: flex;
    flex-direction: column;
    z-index: 5;
}

.log-drawer-header {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.5rem;
    border-bottom: 1px solid c.$border;

    .log-title {
        font-size: 0.78rem;
        font-weight: 600;
        color: c.$text-dark;
        opacity: 0.75;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin-right: auto;
    }

    .log-clear {
        @include b.btn-shared;
        background: transparent;
        border: 1px solid c.$border;
        border-radius: 3px;
        padding: 0.1rem 0.5rem;
        font-size: 0.72rem;
        color: c.$text-dark;
        opacity: 0.75;

        &:hover { opacity: 1; background: #f4f4f5; }
    }

    .log-close {
        @include b.btn-shared;
        background: transparent;
        border: none;
        padding: 2px;
        color: c.$text-dark;
        opacity: 0.6;
        display: inline-flex;
        align-items: center;
        justify-content: center;

        .material-icons { font-size: 18px; }
        &:hover { opacity: 1; }
    }
}

.log-drawer > .log-scroll {
    flex: 1 1 auto;
    overflow: auto;
    font-size: 0.82rem;
    line-height: 1.35;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.5rem 0.6rem;
}

.log-drawer .log-empty {
    color: c.$text-dark;
    opacity: 0.5;
    font-style: italic;
    margin: 0;
}

.log-drawer .log-entry {
    border-left: 2px solid transparent;
    padding-left: 0.4rem;

    &.log-info  { border-left-color: #d0d4d9; }
    &.log-warn  { border-left-color: #f59e0b; }
    &.log-error { border-left-color: firebrick; }
}

.log-drawer .log-line {
    display: flex;
    gap: 0.5rem;
    align-items: baseline;
}

.log-drawer .log-time {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace;
    font-size: 0.75rem;
    color: c.$text-dark;
    opacity: 0.6;
    flex: 0 0 auto;
}

.log-drawer .log-message {
    flex: 1 1 auto;
    color: c.$text-dark;
    word-break: break-word;
}

.log-drawer .log-warn .log-message  { color: #92400e; }
.log-drawer .log-error .log-message { color: firebrick; }

.log-drawer .log-details {
    margin: 0.15rem 0 0;
    padding-left: 1.25rem;
    list-style: disc;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace;
    font-size: 0.78rem;
    color: c.$text-dark;
    opacity: 0.85;

    li { word-break: break-word; }
}

</style>
