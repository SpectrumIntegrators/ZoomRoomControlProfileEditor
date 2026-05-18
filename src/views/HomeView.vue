<template>
    <div
        id="editor-frame-wrap"
        :class="{ 'preview-fullscreen': previewFullscreen, 'file-dragging': isDraggingFile }"
        @dragenter.prevent="onDragEnter"
        @dragover.prevent="onDragOver"
        @dragleave.prevent="onDragLeave"
        @drop.prevent="onFileDrop">
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
                    :errorTargets="errorTargets"
                    :canScreenshot="canScreenshot"
                    :screenshotBusy="screenshotBusy"
                    @update:json="onBuilderEdit"
                    @download="onDownload"
                    @screenshot="takeScreenshot"
                    @profile-reset="onProfileReset" />
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
                                    <span
                                        v-if="schemaSourceStatus === 'local-fallback'"
                                        class="schema-source-chip schema-local-fallback"
                                        :title="schemaSourceTitle">
                                        schema: local
                                    </span>
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
                                        @click="toggleLog">
                                        <span class="material-icons">receipt_long</span>
                                        <span
                                            v-if="logUnreadCount > 0"
                                            class="log-badge">{{ logUnreadCount }}</span>
                                    </button>
                                    <button
                                        class="btn-theme-toggle"
                                        :class="{ active: injectionVisible }"
                                        :title="injectionVisible
                                            ? 'Hide response injection'
                                            : 'Show response injection — simulate data arriving from a device'"
                                        @click="toggleInjection">
                                        <span class="material-icons">input</span>
                                    </button>
                                    <button
                                        class="btn-theme-toggle"
                                        :class="{ active: paletteVisible }"
                                        :title="paletteVisible
                                            ? 'Hide icon palette'
                                            : 'Show icon palette — click an icon to fill the focused field or copy it'"
                                        @click="togglePalette">
                                        <span class="material-icons">apps</span>
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
                                        <a
                                            v-if="w.line"
                                            class="warning-line"
                                            href="#"
                                            :title="`Jump to line ${w.line}`"
                                            @click.prevent="jumpToLine(w.line)">line {{ w.line }}</a>
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
                                'screenshot-mode': screenshotBusy,
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
                                        :class="{ 'preview-error': errorTargets.scenes.has(scene.id) }"
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
                                    class="port"
                                    :class="{ 'preview-error': errorTargets.ports.has(ai + ':' + (port.id || ('#' + pi))) }">
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
                                            v-if="port.main_method && (!port.main_method.userHidden || effectiveShowHidden)"
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
                                                                'preview-error':
                                                                    errorTargets.params.has(
                                                                        ai + ':' + (port.id || ('#' + pi)) + '#' + port.methods.indexOf(port.main_method) + '#' + mi
                                                                    ),
                                                                shine: isShining('control', controlRef(port, port.main_method, param)),
                                                                'shine-pulse': isPulsing('control', controlRef(port, port.main_method, param)),
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
                                                        'preview-error':
                                                            errorTargets.methods.has(
                                                                ai + ':' + (port.id || ('#' + pi)) + '#' + port.methods.indexOf(port.main_method)
                                                            ),
                                                        shine: isShining('control', controlRef(port, port.main_method)),
                                                        'shine-pulse': isPulsing('control', controlRef(port, port.main_method)),
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
                                                v-if="!method.rolledUp && (method.visible || effectiveShowHidden)"
                                                class="method"
                                                :class="{
                                                    'hidden-control':
                                                        !method.visible &&
                                                        !(calculatedControls && calculatedControls.eventOnly),
                                                    'preview-error':
                                                        errorTargets.methods.has(ai + ':' + (port.id || ('#' + pi)) + '#' + mi),
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
                                                                'preview-error':
                                                                    errorTargets.params.has(ai + ':' + (port.id || ('#' + pi)) + '#' + mi + '#' + ppi),
                                                                shine: isShining('control', controlRef(port, method, param)),
                                                                'shine-pulse': isPulsing('control', controlRef(port, method, param)),
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
                                                            shine: isShining('control', controlRef(port, method)),
                                                            'shine-pulse': isPulsing('control', controlRef(port, method)),
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
                            <div
                                v-if="logEntries.length > 0"
                                class="log-drawer-footer">
                                <button
                                    class="btn-trash"
                                    title="Clear log"
                                    @click="clearLog">
                                    <span class="material-icons">delete_outline</span>
                                </button>
                            </div>
                        </aside>
                        <aside
                            v-if="injectionVisible"
                            class="injection-drawer">
                            <div class="injection-drawer-header">
                                <span class="injection-title">Response Injection</span>
                                <button
                                    class="log-close"
                                    title="Hide response injection"
                                    @click="injectionVisible = false">
                                    <span class="material-icons">close</span>
                                </button>
                            </div>
                            <div class="injection-drawer-body">
                                <p class="injection-hint">
                                    Run a simulated device reply through every defined
                                    response filter. Backslash escapes
                                    (<code>\r</code>, <code>\n</code>, <code>\t</code>,
                                    <code>\xAA</code>) in the input are decoded to actual
                                    bytes before the regex runs. Filter matches and any
                                    triggered events show up in the Activity Log.
                                </p>
                                <label class="injection-row">
                                    <span class="injection-label">Bytes</span>
                                    <input
                                        type="text"
                                        v-model="injectionBytes"
                                        placeholder="e.g. Login:\r\n"
                                        @keydown.enter.prevent="runInjection" />
                                </label>
                                <div class="injection-actions">
                                    <button
                                        class="injection-fire"
                                        :disabled="!injectionBytes"
                                        @click="runInjection">
                                        Inject
                                    </button>
                                </div>
                            </div>
                        </aside>
                        <aside
                            v-if="paletteVisible"
                            class="palette-drawer">
                            <div class="palette-drawer-header">
                                <span class="palette-title">Icon Palette</span>
                                <transition name="palette-flash">
                                    <span
                                        v-if="paletteFlash"
                                        class="palette-flash"
                                        :key="paletteFlash">
                                        {{ paletteFlash }}
                                    </span>
                                </transition>
                                <button
                                    class="log-close"
                                    title="Hide icon palette"
                                    @click="paletteVisible = false">
                                    <span class="material-icons">close</span>
                                </button>
                            </div>
                            <div class="palette-drawer-body">
                                <p class="palette-hint">
                                    Click an icon to fill the icon field you were last
                                    editing. If no icon field is currently in scope, the
                                    value is copied to the clipboard instead.
                                    <a
                                        href="https://fonts.google.com/icons?icon.set=Material+Icons"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="palette-gallery-link">
                                        Browse Google's full Material Icons gallery →
                                    </a>
                                </p>
                                <input
                                    type="text"
                                    class="palette-search"
                                    v-model="paletteSearch"
                                    placeholder="Filter by name…" />
                                <div class="palette-style-row">
                                    <span class="palette-row-label">MDI style</span>
                                    <select v-model="paletteMdiStyle">
                                        <option
                                            v-for="s in MDI_STYLES"
                                            :key="s"
                                            :value="s">{{ s }}</option>
                                    </select>
                                </div>
                                <section
                                    v-if="filteredZoomIcons.length > 0"
                                    class="palette-section">
                                    <h4>Zoom Built-ins</h4>
                                    <div class="palette-grid">
                                        <button
                                            v-for="name in filteredZoomIcons"
                                            :key="'zr-' + name"
                                            class="palette-tile"
                                            :title="getPaletteIconUrl(name) ? name : `${name} (no preview asset)`"
                                            @click="pickIcon(name)">
                                            <img
                                                v-if="getPaletteIconUrl(name)"
                                                :src="getPaletteIconUrl(name)"
                                                :alt="name" />
                                            <span
                                                v-else
                                                class="palette-tile-missing"
                                                aria-hidden="true">?</span>
                                            <span class="palette-tile-name">{{ name.replace(/^icon_/, '') }}</span>
                                        </button>
                                    </div>
                                </section>
                                <section
                                    v-for="cat in filteredMdiCategories"
                                    :key="'mdi-' + cat.label"
                                    class="palette-section">
                                    <h4>{{ cat.label }}</h4>
                                    <div class="palette-grid">
                                        <button
                                            v-for="name in cat.icons"
                                            :key="'mdi-' + cat.label + '-' + name"
                                            class="palette-tile"
                                            :title="mdiValue(name)"
                                            @click="pickIcon(mdiValue(name))">
                                            <span :class="getMaterialIconClass(mdiValue(name))">{{ name }}</span>
                                            <span class="palette-tile-name">{{ name }}</span>
                                        </button>
                                    </div>
                                </section>
                                <section
                                    v-if="searchedMdiIcons.length > 0"
                                    class="palette-section">
                                    <h4>
                                        More from Material Icons
                                        <span class="palette-section-count">{{ searchedMdiIcons.length }} match{{ searchedMdiIcons.length === 1 ? '' : 'es' }}</span>
                                    </h4>
                                    <div class="palette-grid">
                                        <button
                                            v-for="name in searchedMdiIcons"
                                            :key="'mdi-extra-' + name"
                                            class="palette-tile"
                                            :title="mdiValue(name)"
                                            @click="pickIcon(mdiValue(name))">
                                            <span :class="getMaterialIconClass(mdiValue(name))">{{ name }}</span>
                                            <span class="palette-tile-name">{{ name }}</span>
                                        </button>
                                    </div>
                                </section>
                                <p
                                    v-if="filteredZoomIcons.length === 0 && filteredMdiCategories.length === 0 && searchedMdiIcons.length === 0"
                                    class="palette-empty">
                                    No icons match "{{ paletteSearch }}".
                                </p>
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
                                    placeholder="// JSON profile..."
                                    @ready="onCmReady" />
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
                                    <div class="output-card-header">
                                        <p class="section-label">Output</p>
                                        <button
                                            v-if="target || commands.length > 0"
                                            class="btn-trash"
                                            title="Clear output"
                                            @click="clearOutput">
                                            <span class="material-icons">delete_outline</span>
                                        </button>
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
                                                <template v-if="c.error">
                                                    <span class="command-error">unresolved: {{ c.error }}</span>
                                                </template>
                                                <template v-else>
                                                    <span
                                                        class="command-address"
                                                        :class="{ 'command-missing': !c.address }">{{ c.address || '<NO_ADDRESS>' }}:</span>
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
        <div
            v-if="isDraggingFile"
            class="drop-overlay">
            <div class="drop-overlay-card">
                <span class="material-icons">file_download</span>
                <p>Drop a profile JSON file to load it</p>
            </div>
        </div>
    </div>
</template>

<script>
import { getTemplateByFile, DEMO_TEMPLATE_FILE } from '@/data/templates';
import { validateProfile } from '@/validation/validateProfile';
import { transformProfile, formatCommand, resolveCommandRefs } from '@/validation/transformProfile';
import { dispatchResponse, escapeWireBytes } from '@/validation/responseInjection';
import {
    ZOOM_BUILTIN_ICONS,
    ZOOM_ICON_ASSET_ALIASES,
    MDI_ICON_CATEGORIES,
    MDI_STYLES,
    iconFocusTracker,
    installIconFocusListener,
} from '@/data/iconPalette';
import { ALL_MATERIAL_ICONS } from '@/data/materialIconsAll';
import { schemaState, loadRemoteSchema, CANONICAL_SCHEMA_URL } from '@/validation/schemaLoader';
import BuilderPanel from '@/components/BuilderPanel.vue';
import { EDITOR_URL, todayIso, orderProfileKeys } from '@/config';
import { Splitpanes, Pane } from 'splitpanes';
import { eventLabel } from '@/data/zoomEvents';
import { Codemirror } from 'vue-codemirror';
import { json as cmJsonLang } from '@codemirror/lang-json';
import { jsonSchema as cmJsonSchema } from 'codemirror-json-schema';
import { toBlob as htmlToBlob, getFontEmbedCSS as htmlGetFontEmbedCSS } from 'html-to-image';

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
        // First-paint content is the Demo template. Loaded as raw text so
        // the file is rendered with the formatting it has on disk. If the
        // template file disappeared somehow, fall back to an empty object
        // so the editor still loads instead of erroring out.
        json: (getTemplateByFile(DEMO_TEMPLATE_FILE) || { text: '{}' }).text,
        target: '',
        commands: [],
        // Composite keys ("control:<ref>") for the persistent glow that
        // marks the most-recently-fired control button(s). Replaced wholesale
        // on each new trigger so the glow always shows current activity.
        firingTargets: new Set(),
        // Same key shape, but for the transient one-shot border bolt. Entries
        // self-clear after the 0.5s sweep so re-triggers can replay.
        pulsingTargets: new Set(),
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
        // Response-injection drawer. Sibling to the activity log drawer
        // (same overlay shape, separate toggle in the preview toolbar);
        // mutually exclusive with the log drawer because they share the
        // same right-edge slot. Bytes survive opening/closing.
        injectionVisible: false,
        injectionBytes: '',
        // Icon-palette drawer. Same right-edge slot, mutually exclusive
        // with log/injection. Search query + MDI style selector survive
        // open/close. `MDI_STYLES` is exposed for the <select>.
        paletteVisible: false,
        paletteSearch: '',
        paletteMdiStyle: 'filled',
        // Transient flash text shown next to the "ICON PALETTE" header
        // after picking an icon — confirms "copied to clipboard" (or, if
        // we ever want it, "inserted into <field>"). Auto-clears after a
        // couple seconds via `paletteFlashTimer`.
        paletteFlash: '',
        paletteFlashTimer: null,
        MDI_STYLES,
        // Non-reactive container for CodeMirror's EditorView. Vue 3 reserves
        // `_`/`$` -prefixed property names, so we hang the view off a regular
        // wrapper object instead of a bare `this._cmView = ...` assignment.
        cmRefs: { view: null },
        // True while a file is being dragged over the editor — shows the
        // "Drop a profile JSON file" overlay. `_dragDepth` is an internal
        // counter so nested elements firing dragenter/leave don't make the
        // overlay flicker; only when the depth returns to 0 do we hide it.
        isDraggingFile: false,
        _dragDepth: 0,
        // Internal: throttle id for JSON-modified log entries.
        _jsonLogTimer: null,
        // Screenshot button: in-flight flag (disables the button while
        // html-to-image is rasterizing) and lazily-fetched font-embed CSS.
        // The Material Icons + Lato webfaces live on fonts.googleapis.com;
        // the first capture pulls their CSS once via html-to-image's
        // helper and we re-use the resulting string for every subsequent
        // capture so we're not hitting Google Fonts on every click.
        screenshotBusy: false,
        _screenshotFontCss: null,
    }),
    created() {
        loadRemoteSchema();
        // Only the failure path needs to surface — successful remote loads
        // are the expected case and would just be log noise. The fallback
        // chip in the toolbar mirrors this warning visually.
        this.$watch(
            () => schemaState.status,
            (status) => {
                if (status === 'local-fallback') {
                    this.pushLog({
                        level: 'warn',
                        message: 'Schema: remote fetch failed — using bundled fallback.',
                        details: schemaState.error ? [schemaState.error] : [],
                    });
                }
            }
        );
        // Check the starting profile's $schema URL once we know which schema
        // the editor settled on. Subsequent edits re-check via the json watcher.
        this.checkSchemaUrlMismatch();
        // Document-level focusin listener that keeps the icon-palette's
        // "last focused icon input" tracker honest — clears the saved
        // input when the user moves focus to another editable field so a
        // subsequent palette click falls back to clipboard instead of
        // hijacking the stale icon-input.
        installIconFocusListener();
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
            // Any edit invalidates the "last triggered" feedback: a button's
            // identity is tied to its ref, but a deleted-and-recreated ref
            // would silently inherit the previous button's glow. Clearing on
            // every edit is the simplest rule that always matches user intent.
            this.setShining([]);
            // Coalesce a burst of keystrokes into one log entry so the user can
            // scan the log without it being a wall of "JSON modified". The
            // $schema mismatch check runs in the same debounced callback so it
            // also waits for the user to stop typing before warning.
            if (this._jsonLogTimer) clearTimeout(this._jsonLogTimer);
            this._jsonLogTimer = setTimeout(() => {
                this._jsonLogTimer = null;
                this.pushLog({ level: 'info', message: 'JSON modified' });
                this.checkSchemaUrlMismatch();
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
                    details: newWarnings.map((w) => {
                        const prefix = w.line ? `line ${w.line} — ` : '';
                        return `${prefix}${w.path}: ${w.message}`;
                    }),
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
            // Resolve aliases first (e.g. `icon_dry` documented name →
            // `icon_water` on-disk filename, same image Zoom serves).
            const resolved = ZOOM_ICON_ASSET_ALIASES[iconName] || iconName;
            const map = this.previewDark ? darkThemeIcons : lightThemeIcons;
            const fb = this.previewDark ? darkFallbackIcon : lightFallbackIcon;
            return map[resolved] ?? fb;
        },
        // Palette tiles always sit on a white background, so use the
        // dark-stroke (light-theme) icon assets regardless of what
        // variant the preview is currently rendering. Returns null when
        // we genuinely don't have a local PNG so the tile can fall back
        // to a text-only placeholder; alias-resolved names still map to
        // their backing asset.
        getPaletteIconUrl(iconName) {
            const resolved = ZOOM_ICON_ASSET_ALIASES[iconName] || iconName;
            return lightThemeIcons[resolved] ?? null;
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
        // Warn if the loaded profile declares a `$schema` URL that isn't the
        // canonical one this editor validates against. Tracks the last URL it
        // warned about so the same mismatch doesn't spam the log on every
        // edit — the user only sees a new entry when the URL actually
        // changes to a different non-matching value (or back to matching).
        checkSchemaUrlMismatch() {
            const declared = this.rawProfile && this.rawProfile.$schema;
            if (!declared || typeof declared !== 'string') {
                this._lastWarnedSchemaUrl = null;
                return;
            }
            if (declared === CANONICAL_SCHEMA_URL) {
                this._lastWarnedSchemaUrl = null;
                return;
            }
            if (this._lastWarnedSchemaUrl === declared) return;
            this._lastWarnedSchemaUrl = declared;
            this.pushLog({
                level: 'warn',
                message: 'Profile $schema differs from the editor\'s schema — validation uses the editor\'s copy, not the one declared.',
                details: [
                    `declared: ${declared}`,
                    `editor:   ${CANONICAL_SCHEMA_URL}`,
                ],
            });
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
        clearOutput() {
            this.target = '';
            this.commands = [];
            this.setShining([]);
        },
        // The log / injection / palette drawers all share the right-edge
        // overlay slot in the preview pane. Opening any closes the others
        // so they don't fight for the same real estate.
        toggleLog() {
            if (this.logVisible) {
                this.logVisible = false;
            } else {
                this.logVisible = true;
                this.injectionVisible = false;
                this.paletteVisible = false;
            }
        },
        toggleInjection() {
            if (this.injectionVisible) {
                this.injectionVisible = false;
            } else {
                this.injectionVisible = true;
                this.logVisible = false;
                this.paletteVisible = false;
            }
        },
        togglePalette() {
            if (this.paletteVisible) {
                this.paletteVisible = false;
            } else {
                this.paletteVisible = true;
                this.logVisible = false;
                this.injectionVisible = false;
            }
        },
        // Rasterize the rendered preview (`#zoom-controls`) to a PNG via
        // html-to-image and trigger a download. Captures whatever theme
        // (light/dark) the user has selected; uses the current scrollHeight
        // so the entire control list is included rather than just the
        // visible viewport. The right-side drawers (log/injection/palette)
        // are siblings of `#zoom-controls`, not children, so they're
        // naturally excluded without us having to hide them first.
        async takeScreenshot() {
            if (this.screenshotBusy) return;
            if (!this.canScreenshot) {
                this.pushLog({
                    level: 'warn',
                    message: 'Screenshot: nothing to capture (no controls rendered).',
                });
                return;
            }
            this.screenshotBusy = true;
            // Flipping `screenshotBusy` flips `effectiveShowHidden` to false
            // and adds `screenshot-mode` to `#zoom-controls` (which hides the
            // dashed-red error outlines). Wait for Vue to re-render those
            // before html-to-image walks the DOM, otherwise the snapshot
            // captures the stale tree.
            await this.$nextTick();
            const node = document.getElementById('zoom-controls');
            if (!node) {
                this.screenshotBusy = false;
                this.pushLog({
                    level: 'warn',
                    message: 'Screenshot: nothing to capture (no controls rendered).',
                });
                return;
            }
            try {
                // The preview's background lives on `#preview` rather than
                // on `#zoom-controls` itself, so html-to-image would render
                // transparent corners by default. Sample the actual pane
                // background so the exported PNG matches what the user sees.
                const previewEl = document.getElementById('preview');
                const bg = previewEl
                    ? getComputedStyle(previewEl).backgroundColor
                    : (this.previewDark ? '#1a1a1a' : '#ffffff');

                // Cache the Google Fonts CSS+WOFF embed across captures —
                // it's the slowest part and doesn't change between clicks.
                if (this._screenshotFontCss == null) {
                    try {
                        this._screenshotFontCss = await htmlGetFontEmbedCSS(node);
                    } catch {
                        // Network blocked or CORS issue — fall back to letting
                        // html-to-image try (and possibly fail) on each call
                        // rather than wedging the feature entirely. Empty
                        // string means "I have no font CSS to contribute,"
                        // so skip the option to let the default path run.
                        this._screenshotFontCss = '';
                    }
                }

                const options = {
                    backgroundColor: bg,
                    pixelRatio: 2,
                    cacheBust: true,
                };
                if (this._screenshotFontCss) {
                    options.fontEmbedCSS = this._screenshotFontCss;
                }

                const blob = await htmlToBlob(node, options);
                if (!blob) throw new Error('html-to-image returned no blob');

                // Filename mirrors the JSON-download naming but with
                // "Screenshot" in place of "Profile" and a .png extension.
                let info = {};
                try {
                    const parsed = JSON.parse(this.json);
                    info = parsed && parsed.info ? parsed.info : {};
                } catch {
                    // No info available — fall back to the generic name.
                }
                const parts = [info.customer, info.location, 'Zoom Room Control Screenshot']
                    .map((s) => (typeof s === 'string' ? s.trim() : ''))
                    .filter(Boolean);
                const filename = `${parts.join(' ')}.png`;

                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                this.pushLog({
                    level: 'info',
                    message: `Screenshot saved: ${filename}`,
                });
            } catch (err) {
                this.pushLog({
                    level: 'error',
                    message: 'Screenshot failed',
                    details: [String(err && err.message ? err.message : err)],
                });
            } finally {
                this.screenshotBusy = false;
            }
        },
        // Helper used by the template — wraps a Material Icon name in our
        // `mdi:<name>:<style>` value form. Always emits the style suffix
        // (including for filled) because Zoom Rooms requires it explicitly
        // and refuses to render `mdi:name` without one. Our local preview
        // renderer happens to fall back to filled when the style is
        // missing, but matching Zoom's stricter behavior is more useful.
        mdiValue(name) {
            return `mdi:${name}:${this.paletteMdiStyle}`;
        },
        // Click handler for every palette tile. If the user was just
        // editing an icon field, type the value into that input (and fire
        // the input's existing @input handler so the value commits like a
        // keystroke would). If the focused field is gone (clicked away,
        // unmounted, etc.), fall back to clipboard.
        async pickIcon(value) {
            const el = iconFocusTracker.take();
            if (el) {
                // Vue's @input handler reads from $event.target.value, so
                // just setting `value` and dispatching the event matches
                // the in-place edit path the user would normally take.
                el.value = value;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                // Visual confirmation: briefly refocus the field. Doesn't
                // re-grab from the palette button (since blur/focus on the
                // button stays where it is); just so the user can see
                // where the value landed.
                try { el.focus({ preventScroll: true }); } catch { el.focus(); }
                this.pushLog({
                    level: 'info',
                    message: `Icon palette → filled "${value}" into the focused icon field.`,
                });
                return;
            }
            // No focused field — copy to clipboard. Use the async API when
            // available; fall back to a hidden textarea + execCommand.
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(value);
                } else {
                    const ta = document.createElement('textarea');
                    ta.value = value;
                    ta.style.position = 'fixed';
                    ta.style.opacity = '0';
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                }
                this.flashPalette('Copied to clipboard');
                this.pushLog({
                    level: 'info',
                    message: `Icon palette → copied "${value}" to the clipboard (no focused icon field).`,
                });
            } catch (e) {
                this.flashPalette("Couldn't copy");
                this.pushLog({
                    level: 'error',
                    message: `Icon palette → couldn't copy "${value}" to clipboard: ${e.message}`,
                });
            }
        },
        // Pop a short note next to the palette header that fades after a
        // couple seconds. Replaces any previous flash so rapid-fire clicks
        // don't queue up overlapping messages.
        flashPalette(text) {
            if (this.paletteFlashTimer) clearTimeout(this.paletteFlashTimer);
            this.paletteFlash = text;
            this.paletteFlashTimer = setTimeout(() => {
                this.paletteFlash = '';
                this.paletteFlashTimer = null;
            }, 2200);
        },
        // Fires when BuilderPanel reset the profile (New button) or loaded
        // a different one (Open / drag-drop). The output preview and the
        // activity log both belong to the previous profile's runtime
        // state, so wipe them along with the document.
        onProfileReset() {
            this.clearOutput();
            this.clearLog();
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
        runInjection() {
            const json = this.rawProfile;
            if (!json) {
                this.pushLog({ level: 'error', message: 'Injection: profile JSON does not parse.' });
                return;
            }
            const result = dispatchResponse(json, this.injectionBytes);
            const rendered = escapeWireBytes(result.bytes);
            // Summary log: every defined filter's outcome, plus the list of
            // events that fired. Note: the simulator runs against every
            // filter in `response_filters`, ignoring per-port wiring. Zoom
            // at runtime only evaluates filters that the receiving port
            // opts into — flagged in the help popup so the user knows.
            const details = [];
            if (result.results.length === 0) {
                details.push('(no response filters defined in this profile)');
            } else {
                for (const r of result.results) {
                    if (r.error) {
                        details.push(`${r.name}: ${r.error}`);
                    } else if (r.matched) {
                        details.push(`${r.name}: matched`);
                    } else {
                        details.push(`${r.name}: no match`);
                    }
                }
            }
            const summary = result.firedEvents.length > 0
                ? `Inject (${result.bytes.length} bytes) → ${result.firedEvents.length} event${result.firedEvents.length === 1 ? '' : 's'} fired (${result.firedEvents.join(', ')})`
                : `Inject (${result.bytes.length} bytes) → no filter matched`;
            this.pushLog({
                level: result.firedEvents.length > 0 ? 'info' : 'warn',
                message: summary,
                details: [`input: ${rendered}`, ...details],
            });
            // Run each fired event through the same dispatch path as a
            // button click so the resolved commands surface in the Output
            // pane and the activity log. Each event also gets its own log
            // line for the resolved commands, mirroring Zoom's runtime
            // behavior of "matched filter → execute the rule it points at."
            if (result.firedEvents.length > 0 && this.calculatedControls) {
                const ruleByEvent = new Map(
                    (this.calculatedControls.resolvedRules || []).map((r) => [r.event, r])
                );
                for (const event of result.firedEvents) {
                    const rule = ruleByEvent.get(event);
                    if (rule) {
                        this.eventClick(rule);
                        continue;
                    }
                    // No literal rule entry. Zoom falls back to executing the
                    // event name as a port command-ref, which covers the
                    // iTachIP2CC case where `<port>.power.on` is auto-generated
                    // by the transform pass and never appears in `json.rules`.
                    // Mirror that here by resolving the event through the
                    // same path as scene/rule commands and synthesizing a
                    // one-command rule for the dispatch log.
                    if (event.includes('.') && this.calculatedControls) {
                        const resolved = resolveCommandRefs(this.calculatedControls, [event]);
                        if (
                            resolved.length === 1 &&
                            !resolved[0].error &&
                            resolved[0].address !== undefined
                        ) {
                            this.eventClick({ event, commands: resolved });
                            continue;
                        }
                    }
                    this.pushLog({
                        level: 'warn',
                        message: `Triggered event "${event}" is not a defined rule — Zoom would log "triggered event is not found".`,
                    });
                }
            }
        },
        controlRef(port, method, param) {
            // Substitute empty id segments with an obvious placeholder so a
            // missing-id error doesn't read as "port..param" (which is easy
            // to skim past as if it were just a leading-dot rendering glitch).
            const seg = (x) => (x ? x : '<MISSING_ID>');
            return param
                ? `${seg(port.id)}.${seg(method.id)}.${seg(param.id)}`
                : `${seg(port.id)}.${seg(method.id)}`;
        },
        isShining(kind, id) {
            return this.firingTargets.has(`${kind}:${id}`);
        },
        isPulsing(kind, id) {
            return this.pulsingTargets.has(`${kind}:${id}`);
        },
        // Replace the currently-glowing set on the next microtask, batching
        // all synchronous calls into one union. Under current Zoom behavior
        // a filter response triggers exactly one event (the first matching
        // filter wins), so `runInjection` only ever calls eventClick once
        // per injection and the batching is effectively a no-op. It's kept
        // as a forward guard: if Zoom ever allows a filter's `trigger` to be
        // an array, this code already lights up every fired event's commands
        // together instead of just the last one — no logic change needed.
        setShining(keys) {
            if (!this._shineBatch) {
                this._shineBatch = new Set();
                queueMicrotask(() => {
                    this.firingTargets = this._shineBatch;
                    this._shineBatch = null;
                });
            }
            for (const k of keys) this._shineBatch.add(k);
        },
        // Fire the one-shot border bolt for a single key. Re-firing while the
        // class is still applied requires removing it, waiting one tick for
        // the DOM to drop the class, then re-adding — otherwise Vue sees no
        // change and the CSS animation doesn't replay.
        async pulseShine(kind, id) {
            const key = `${kind}:${id}`;
            if (this.pulsingTargets.has(key)) {
                this.pulsingTargets.delete(key);
                await this.$nextTick();
            }
            this.pulsingTargets.add(key);
            setTimeout(() => this.pulsingTargets.delete(key), 500);
        },
        zoomClick(adapter, port, method, param) {
            const ref = this.controlRef(port, method, param);
            this.target = ref;
            const fc = formatCommand(adapter, port, method, param);
            this.commands = [{ ref, address: fc.address, command: fc.command }];
            this.logTrigger('control', ref, this.commands);
            this.setShining([`control:${ref}`]);
            this.pulseShine('control', ref);
        },
        sceneClick(scene) {
            this.target = scene.id;
            this.commands = scene.resolvedCommands;
            this.logTrigger('scene', scene.name || scene.id, this.commands);
            this.shineCommands(this.commands);
        },
        eventClick(rule) {
            this.target = rule.event;
            this.commands = rule.commands;
            this.logTrigger('event', this.eventLabel(rule.event), this.commands);
            this.shineCommands(this.commands);
        },
        // Light up every control button whose ref appears in the given
        // resolved-command list. Used by scene clicks, event clicks, and
        // filter-response dispatches — the underlying zoom controls glow
        // (persistent) and pulse (one-shot), not the trigger button itself.
        shineCommands(commands) {
            const items = Array.isArray(commands)
                ? commands.filter((c) => c && c.ref && !c.error)
                : [];
            this.setShining(items.map((c) => `control:${c.ref}`));
            for (const cmd of items) {
                this.pulseShine('control', cmd.ref);
            }
        },
        eventLabel,
        onResize(name, panes) {
            saveSizes(name, panes);
        },
        jumpToLine(line) {
            const view = this.cmRefs.view;
            if (!view || !line) return;
            // CM6 line numbers are 1-based; the doc model also indexes lines
            // from 1. Move the cursor to the start of that line and scroll
            // it into view.
            const doc = view.state.doc;
            const safeLine = Math.max(1, Math.min(line, doc.lines));
            const lineInfo = doc.line(safeLine);
            view.dispatch({
                selection: { anchor: lineInfo.from, head: lineInfo.from },
                scrollIntoView: true,
            });
            view.focus();
        },
        onCmReady(payload) {
            // Hang on to the EditorView so we can read/write scroll position
            // when the builder pushes JSON updates from the other pane.
            // Stored on the non-reactive shared `cmRefs` (NOT a `_`-prefixed
            // instance prop, since Vue 3 reserves `_` / `$` prefixes for its
            // own internals and won't proxy reads back through `this`).
            this.cmRefs.view = payload && payload.view;
        },
        onBuilderEdit(jsonText) {
            // BuilderPanel emits the serialized JSON text. Going through the
            // v-model would force vue-codemirror to redispatch a full-doc
            // replace via its async watcher, by which time the editor has
            // already snapped scroll to the top. Sidestep the model entirely
            // when we have direct access to the view: capture scroll, swap
            // the document, restore scroll — synchronously AND on the next
            // frame in case CodeMirror's own measure cycle resets it after
            // we run. vue-codemirror's setDoc guards with `new !== current`
            // so its own watcher then no-ops.
            if (this.json === jsonText) return;
            const view = this.cmRefs.view;
            if (view) {
                const prevScroll = view.scrollDOM.scrollTop;
                view.dispatch({
                    changes: { from: 0, to: view.state.doc.length, insert: jsonText },
                });
                view.scrollDOM.scrollTop = prevScroll;
                // CM6 schedules a measure pass via rAF after a transaction;
                // restore scroll after that pass too in case it snapped to
                // top while we weren't looking.
                requestAnimationFrame(() => {
                    if (view.scrollDOM.scrollTop !== prevScroll) {
                        view.scrollDOM.scrollTop = prevScroll;
                    }
                });
            }
            this.json = jsonText;
        },
        dragHasFile(event) {
            // dragenter/over events only expose `items` (with their `kind`)
            // in most browsers; `files` is empty until drop. Only show the
            // overlay if the drag actually contains a file — text/HTML drags
            // from another tab shouldn't trigger it.
            const items = event.dataTransfer && event.dataTransfer.items;
            if (!items) return false;
            for (let i = 0; i < items.length; i++) {
                if (items[i].kind === 'file') return true;
            }
            return false;
        },
        onDragEnter(event) {
            if (!this.dragHasFile(event)) return;
            this._dragDepth += 1;
            this.isDraggingFile = true;
        },
        onDragOver(event) {
            if (this.dragHasFile(event)) {
                // Explicit "copy" effect so the cursor shows a + symbol while
                // hovering, matching the user's intent.
                event.dataTransfer.dropEffect = 'copy';
            }
        },
        onDragLeave() {
            if (this._dragDepth > 0) this._dragDepth -= 1;
            if (this._dragDepth === 0) this.isDraggingFile = false;
        },
        onFileDrop(event) {
            this._dragDepth = 0;
            this.isDraggingFile = false;
            const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                const text = String(reader.result || '');
                // Wipe state from the previous profile first, then install
                // the dropped file and log a single "loaded file" entry
                // that's visible after the clear.
                this.onProfileReset();
                this.json = text;
                this.pushLog({
                    level: 'info',
                    message: `Loaded file '${file.name}' (${text.length} bytes)`,
                });
            };
            reader.onerror = () => {
                this.pushLog({
                    level: 'error',
                    message: `Could not read file '${file.name}'`,
                    details: [reader.error && reader.error.message].filter(Boolean),
                });
            };
            reader.readAsText(file);
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
        // Resolve every error's JSON pointer back to the port / method / param
        // it touches, so the preview can paint a "this has a problem" hint
        // directly on the rendered control. Errors bubble: a param error also
        // flags its parent method and port, a method error flags its port.
        //
        // Methods and params are keyed by INDEX (not id) so a control whose
        // own id is empty/missing still gets the indicator — id-based keys
        // would silently no-op on the very case the user most needs to see.
        // Indices match between rawProfile and calculatedControls because the
        // transform never reorders methods/params, only annotates them.
        errorTargets() {
            const ports = new Set();
            const methods = new Set();
            const params = new Set();
            const settings = new Set(); // "<portKey>#<settingField>"
            const portsWithSettingsError = new Set(); // <portKey>
            const scenes = new Set();
            const adapters = new Set(); // adapter-index keys, e.g. "0"
            const adapterFields = new Set(); // "<adapterIndex>#<field>" for ip/com/uuid/model errors
            const json = this.rawProfile;
            if (!json) {
                return { ports, methods, params, settings, scenes, adapters, adapterFields };
            }
            for (const w of this.validationWarnings) {
                const ptr = w.pointer;
                if (!ptr) continue;
                // /adapters/N(/ports/M(/settings/<field> | /methods/K(/params/P)?)?)?
                let m = /^\/adapters\/(\d+)(?:\/ports\/(\d+)(?:\/(settings|methods)\/([^/]+)(?:\/params\/(\d+))?)?)?/.exec(ptr);
                if (m) {
                    const ai = Number(m[1]);
                    adapters.add(String(ai));
                    if (m[2] == null) {
                        // Adapter-level pointer. Capture the specific field
                        // (ip / com / uuid / model) for input-level highlight
                        // in the builder. Two emission shapes from AJV:
                        //   - pattern / enum / type failures point at the
                        //     field: /adapters/0/ip
                        //   - required-field misses point at the parent and
                        //     carry the missing key in err.params:
                        //     /adapters/0 with missingProperty 'ip'
                        const tail = ptr.slice(`/adapters/${ai}`.length);
                        if (tail.startsWith('/')) {
                            const field = tail.slice(1).split('/')[0];
                            if (field) adapterFields.add(`${ai}#${field}`);
                        } else if (w.source === 'schema' && w.message) {
                            // Pull the missing key out of "required field 'X'".
                            const mm = /required field '([^']+)'/.exec(w.message);
                            if (mm) adapterFields.add(`${ai}#${mm[1]}`);
                        }
                        continue;
                    }
                    const adapter = json.adapters && json.adapters[ai];
                    const port = adapter && adapter.ports && adapter.ports[Number(m[2])];
                    // Qualify the port key with the adapter index. Two ports
                    // on different adapters can share an id (Zoom allows it)
                    // and unnamed ports both default to `#0` — without the
                    // adapter prefix, an error on one would falsely tag the
                    // other.
                    const portKey = `${ai}:${port && port.id ? port.id : `#${Number(m[2])}`}`;
                    ports.add(portKey);
                    if (m[3] === 'settings') {
                        settings.add(`${portKey}#${m[4]}`);
                        portsWithSettingsError.add(portKey);
                    } else if (m[3] === 'methods') {
                        const mi = Number(m[4]);
                        methods.add(`${portKey}#${mi}`);
                        if (m[5] != null) {
                            params.add(`${portKey}#${mi}#${Number(m[5])}`);
                        }
                    }
                    continue;
                }
                // /scenes/N
                m = /^\/scenes\/(\d+)/.exec(ptr);
                if (m) {
                    const scene = json.scenes && json.scenes[Number(m[1])];
                    if (scene && scene.id) scenes.add(scene.id);
                    continue;
                }
            }
            // Bubble errors down through the hierarchy so the preview lights
            // up every visible control that's affected:
            //   - Adapter-level errors (missing ip / com / uuid, model
            //     mismatches, etc.) → every port under that adapter, and
            //     every method/param under those ports. If the adapter
            //     can't connect, none of its controls will work.
            //   - Port serial-settings errors → every method/param on that
            //     port. A bad baud / parity / data_bits breaks every command
            //     the device speaks.
            // Note: errors that originally pointed at a specific port path
            // already had ports.add(portKey) called inside the main loop, so
            // the per-port bubble below covers them too.
            if (Array.isArray(json.adapters)) {
                json.adapters.forEach((adapter, ai) => {
                    if (!adapter || !Array.isArray(adapter.ports)) return;
                    const adapterHasError = adapters.has(String(ai));
                    adapter.ports.forEach((port, pi) => {
                        if (!port) return;
                        const portKey = `${ai}:${port.id ? port.id : `#${pi}`}`;
                        const portHasError =
                            adapterHasError ||
                            portsWithSettingsError.has(portKey) ||
                            ports.has(portKey);
                        if (!portHasError) return;
                        // Adapter-level errors weren't otherwise associated
                        // with a port; surface them on every port card.
                        if (adapterHasError) ports.add(portKey);
                        if (!Array.isArray(port.methods)) return;
                        // Only bubble down to methods/params when the failure
                        // actually affects the wire (adapter or settings).
                        // A port-level error like a missing port id doesn't
                        // automatically mean every command is broken.
                        if (!adapterHasError && !portsWithSettingsError.has(portKey)) return;
                        port.methods.forEach((method, mi) => {
                            methods.add(`${portKey}#${mi}`);
                            if (method && Array.isArray(method.params)) {
                                method.params.forEach((_p, ppi) => {
                                    params.add(`${portKey}#${mi}#${ppi}`);
                                });
                            }
                        });
                    });
                });
            }
            return { ports, methods, params, settings, scenes, adapters, adapterFields };
        },
        // Filtered Zoom built-in icon names matching the palette's search
        // box (case-insensitive substring match against the bare name).
        filteredZoomIcons() {
            const q = (this.paletteSearch || '').trim().toLowerCase();
            if (!q) return ZOOM_BUILTIN_ICONS;
            return ZOOM_BUILTIN_ICONS.filter((n) => n.toLowerCase().includes(q));
        },
        // Categories with empty `icons` arrays filtered out, so the search
        // doesn't leave behind empty headers.
        filteredMdiCategories() {
            const q = (this.paletteSearch || '').trim().toLowerCase();
            if (!q) return MDI_ICON_CATEGORIES;
            return MDI_ICON_CATEGORIES
                .map((cat) => ({
                    label: cat.label,
                    icons: cat.icons.filter((n) => n.toLowerCase().includes(q)),
                }))
                .filter((cat) => cat.icons.length > 0);
        },
        // Names already exposed via the curated categories (top section).
        // Used to avoid double-listing in the full-library search results.
        curatedMdiSet() {
            const out = new Set();
            for (const cat of MDI_ICON_CATEGORIES) {
                for (const n of cat.icons) out.add(n);
            }
            return out;
        },
        // Free-text search across the full Material Icons name list
        // (~2200 names). Only activates when the user has typed at least
        // 2 characters — single-letter queries match too many things.
        // Results are sorted prefix-first, then by length so the most
        // relevant matches surface first. Capped at 100 entries to keep
        // rendering snappy. Names already in the curated categories are
        // hidden here to avoid duplicate tiles.
        searchedMdiIcons() {
            const q = (this.paletteSearch || '').trim().toLowerCase();
            if (q.length < 2) return [];
            const curated = this.curatedMdiSet;
            const prefix = [];
            const substring = [];
            for (const name of ALL_MATERIAL_ICONS) {
                if (curated.has(name)) continue;
                const lower = name.toLowerCase();
                if (lower.startsWith(q)) prefix.push(name);
                else if (lower.includes(q)) substring.push(name);
            }
            prefix.sort((a, b) => a.length - b.length || a.localeCompare(b));
            substring.sort((a, b) => a.length - b.length || a.localeCompare(b));
            return [...prefix, ...substring].slice(0, 100);
        },
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
        schemaSourceStatus() {
            return schemaState.status;
        },
        schemaSourceTitle() {
            // Only the local-fallback chip is rendered, so this only needs
            // to describe that case.
            return `Remote schema fetch failed (${schemaState.error || 'unknown error'}). Using the bundled fallback schema.`;
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
        // Stricter than `shouldRenderControls` — gates the screenshot button.
        // We refuse to capture when:
        //   - JSON doesn't parse (calculatedControls is null), or
        //   - the profile is event-only (Zoom hides the UI entirely; even
        //     if the user has "Show hidden controls" on, what they'd see
        //     in Zoom is nothing, so screenshotting the testing-only view
        //     would misrepresent reality).
        // No check for validation warnings — those are advisory, the
        // controls still render the way Zoom would render them, and the
        // red error outlines are suppressed during capture via the
        // `screenshot-mode` class on `#zoom-controls`.
        canScreenshot() {
            const ctrl = this.calculatedControls;
            if (!ctrl) return false;
            if (ctrl.eventOnly) return false;
            return true;
        },
        // Render-path override for `showHidden` that flips back to false
        // while a screenshot is in flight. Lets the user keep "Show hidden
        // controls" on for editing without leaking the testing-only items
        // into the exported PNG — Zoom never shows hidden methods, so the
        // screenshot shouldn't either. We don't touch `showHidden` itself
        // (the checkbox stays as the user set it); only the v-ifs that
        // actually decide whether hidden methods render consult this.
        effectiveShowHidden() {
            return this.showHidden && !this.screenshotBusy;
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

// `--shine-color` is shared by both the transient border-bolt and the
// persistent glow. Light preview uses the brand accent (visible against
// white port cards); dark preview swaps to white so both effects read
// against #1a1a1a.
#preview {
    --shine-color: #{c.$accent};

    &.dark-preview {
        --shine-color: #ffffff;
    }
}

// Border-bolt machinery: `@property` registration is what lets the
// conic-gradient angle and arc color interpolate inside @keyframes.
@property --shine-angle {
    syntax: '<angle>';
    inherits: false;
    initial-value: 0deg;
}
@property --shine-arc {
    syntax: '<color>';
    inherits: false;
    initial-value: transparent;
}
@keyframes shine-sweep {
    0%   { --shine-angle: 0deg;   --shine-arc: transparent; }
    25%  { --shine-arc: var(--shine-color, #ffffff); }
    75%  { --shine-arc: var(--shine-color, #ffffff); }
    100% { --shine-angle: 360deg; --shine-arc: transparent; }
}

// Two stacked effects on .btn-zoom controls when their command fires:
//   .shine-pulse  → one-shot border bolt sweeps once at trigger time
//   .shine        → persistent glow that stays until the next activity
// The pulse uses a pseudo-element ring (mask trick) so the host button's
// own border/background stay untouched. The glow is a directionless
// box-shadow on the button itself, transitioned for a smooth crossfade
// when the active set changes.
.btn-zoom {
    position: relative;
    transition: box-shadow 0.4s ease;

    &.shine {
        box-shadow: 0 0 10px 1px var(--shine-color);
    }

    &.shine-pulse::after {
        content: '';
        position: absolute;
        inset: 0;
        border: 2px solid transparent;
        border-radius: inherit;
        background:
            conic-gradient(
                from var(--shine-angle),
                transparent 0%,
                var(--shine-arc) 3%,
                transparent 15%
            ) border-box;
        -webkit-mask:
            linear-gradient(#fff 0 0) padding-box,
            linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor;
                mask-composite: exclude;
        pointer-events: none;
        animation: shine-sweep 0.5s ease-in 1;
    }

    // Honour the OS-level reduced-motion preference: drop the sweep entirely
    // and snap the glow on/off instead of crossfading. The glow itself still
    // shows, so the user keeps the "last triggered" feedback without the
    // moving elements that reduced-motion is meant to suppress.
    @media (prefers-reduced-motion: reduce) {
        transition: none;

        &.shine-pulse::after {
            display: none;
        }
    }
}

// Wrapper around the outer Splitpanes. It exists purely so we have a stable
// DOM element to hang the fullscreen-toggle class on — class fallthrough onto
// the Splitpanes component's root was unreliable.
#editor-frame-wrap {
    height: 100%;
    width: 100%;
    // Positioning context for the drop overlay below. `relative` won't
    // affect layout since #editor-frame fills the wrapper exactly.
    position: relative;
}

// Full-window overlay shown while the user drags a file in from the OS.
// Pointer-events: none so the drag-events themselves still reach the
// wrapper underneath (otherwise we'd swallow the drop and dropEffect).
.drop-overlay {
    position: absolute;
    inset: 0;
    background: rgba(70, 36, 68, 0.18);
    border: 3px dashed rgba(70, 36, 68, 0.6);
    border-radius: 8px;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
}

.drop-overlay-card {
    background: #fff;
    border-radius: 10px;
    padding: 1.5rem 2rem;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    color: c.$primary;

    .material-icons {
        font-size: 40px;
        color: c.$accent;
    }

    p {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 500;
    }
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

    // Subtle persistent chip showing which schema copy the editor is using.
    // Sits to the left of the warnings/theme/log buttons in the toolbar.
    // Neutral styling so it reads as environment status, not a problem to fix.
    .schema-source-chip {
        font-size: 0.72rem;
        line-height: 1.4;
        padding: 0.15rem 0.45rem;
        border-radius: 4px;
        border: 1px solid rgba(0, 0, 0, 0.15);
        color: rgba(0, 0, 0, 0.55);
        background: transparent;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace;
        user-select: none;
        white-space: nowrap;

        &.schema-local-fallback {
            // Slightly warm tint to flag that we're not on the live copy,
            // without screaming "error" — the warning lives in the log.
            border-color: rgba(217, 119, 6, 0.45);
            color: #92400e;
        }
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

        .warning-line {
            display: inline-block;
            margin-right: 0.35rem;
            padding: 0 4px;
            border-radius: 3px;
            background: rgba(120, 53, 15, 0.12);
            color: inherit;
            text-decoration: none;
            font-size: 0.72rem;
            font-weight: 600;
            font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace;

            &:hover {
                background: rgba(120, 53, 15, 0.22);
                text-decoration: underline;
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

        // Validator-flagged controls in the rendered preview. Outline (not
        // border) so toggling on/off doesn't reflow the layout. The default
        // -2px offset hugs the inside of card edges; buttons override with
        // -1px so the dashes sit closer to the rounded corner.
        // Compiles to `#zoom-controls .preview-error` so .port itself
        // matches (the rule used to be nested inside .port, which produced
        // `.port .preview-error` and missed the .port element itself).
        .preview-error {
            outline: 2px dashed firebrick;
            outline-offset: -2px;
        }
        .btn-zoom.preview-error,
        .btn-scene.preview-error {
            outline-offset: -1px;
        }

        // While a screenshot is being taken, suppress the validator-error
        // outlines so the exported PNG matches what Zoom would actually
        // render (Zoom doesn't paint red dashes around mismatched fields —
        // those are an editor-only affordance). Hidden methods are handled
        // separately by the `effectiveShowHidden` computed switching off
        // the v-if for `.hidden-control` items during capture.
        &.screenshot-mode .preview-error {
            outline: none;
        }

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

            // (The `.preview-error` rules used to live here, but nesting them
            // inside `.port` compiled to `.port .preview-error` — which only
            // matches descendants, never the port itself. Moved out below so
            // the port card can carry the indicator too.)

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

        // Row that holds the section label on the left and a trash-can
        // clear button on the right. Only used by the Output card right
        // now — the section-label by itself still works for the Events
        // card, where there's nothing to clear.
        .output-card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.5rem;
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

            .command-missing {
                color: firebrick;
                font-style: italic;
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

}

// Shared close-button styling for the log and injection drawer headers.
// Previously nested under `.log-drawer-header`, which left the injection
// drawer's matching button with default browser styling.
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

// Response-injection drawer. Sibling to the log drawer — same overlay
// shape on the right edge of the preview, mutually exclusive with the log
// drawer because they share that slot. Bytes get decoded for escapes and
// run through every defined filter; matches/events spill into the activity
// log (the user opens the log to inspect the trace).
.injection-drawer {
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

.injection-drawer-header {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.5rem;
    border-bottom: 1px solid c.$border;

    .injection-title {
        font-size: 0.78rem;
        font-weight: 600;
        color: c.$text-dark;
        opacity: 0.75;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin-right: auto;
    }
}

.injection-drawer-body {
    flex: 1 1 auto;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 0.6rem 0.75rem;
    font-size: 0.82rem;
}

.injection-hint {
    margin: 0;
    color: c.$text-dark;
    opacity: 0.8;
    line-height: 1.45;

    code {
        background: #e8e8ec;
        border-radius: 2px;
        padding: 0 3px;
        font-size: 0.9em;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace;
    }
}

.injection-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;

    .injection-label {
        flex: 0 0 42px;
        text-transform: uppercase;
        font-size: 0.68rem;
        font-weight: 600;
        opacity: 0.6;
        letter-spacing: 0.04em;
    }

    input {
        flex: 1 1 auto;
        min-width: 0;
        font-size: 0.85rem;
        padding: 4px 7px;
        border: 1px solid c.$border;
        border-radius: 3px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace;
    }
}

.injection-actions {
    display: flex;
    justify-content: flex-end;
}

.injection-fire {
    @include b.btn-shared;
    background: c.$accent;
    color: #fff;
    border: none;
    border-radius: 3px;
    padding: 0.3rem 0.9rem;
    font-size: 0.82rem;

    &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
    &:hover:not(:disabled) {
        opacity: 0.9;
    }
}

// Icon-palette drawer. Same overlay shape as the log / injection drawers,
// just wider (icons need real estate) and with a scrollable body holding
// search box + style selector + grouped icon grids.
.palette-drawer {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: clamp(320px, 44%, 520px);
    background: #fff;
    border-left: 1px solid c.$border;
    box-shadow: -4px 0 10px rgba(0, 0, 0, 0.06);
    display: flex;
    flex-direction: column;
    z-index: 5;
}

.palette-drawer-header {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.5rem;
    border-bottom: 1px solid c.$border;

    .palette-title {
        font-size: 0.78rem;
        font-weight: 600;
        color: c.$text-dark;
        opacity: 0.75;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin-right: auto;
    }
}

.palette-drawer-body {
    flex: 1 1 auto;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 0.6rem 0.75rem;
}

.palette-hint {
    margin: 0;
    color: c.$text-dark;
    opacity: 0.75;
    font-size: 0.78rem;
    line-height: 1.4;
}

.palette-gallery-link {
    display: inline-block;
    margin-top: 0.35rem;
    color: c.$accent;
    text-decoration: underline;
    font-size: 0.78rem;
}

// Header-strip flash: "Copied to clipboard" / similar, fades after a
// couple seconds via Vue's <transition>.
.palette-drawer-header {
    .palette-flash {
        font-size: 0.72rem;
        font-weight: 500;
        color: c.$accent;
        background: rgba(70, 36, 68, 0.08);
        padding: 2px 8px;
        border-radius: 10px;
        white-space: nowrap;
        margin-right: 0.4rem;
    }
}

.palette-flash-enter-active,
.palette-flash-leave-active {
    transition: opacity 0.25s ease;
}
.palette-flash-enter-from,
.palette-flash-leave-to {
    opacity: 0;
}

.palette-search {
    width: 100%;
    padding: 5px 8px;
    border: 1px solid c.$border;
    border-radius: 4px;
    font-size: 0.85rem;
    font-family: inherit;
}

.palette-style-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.78rem;

    .palette-row-label {
        text-transform: uppercase;
        font-size: 0.68rem;
        font-weight: 600;
        opacity: 0.6;
        letter-spacing: 0.04em;
        color: c.$text-dark;
    }

    select {
        flex: 0 0 auto;
        padding: 3px 6px;
        border: 1px solid c.$border;
        border-radius: 3px;
        font-size: 0.82rem;
        font-family: inherit;
    }
}

.palette-section {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;

    h4 {
        margin: 0;
        font-size: 0.7rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: c.$primary;
        opacity: 0.8;
        padding-bottom: 0.2rem;
        border-bottom: 1px solid c.$border;
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 0.4rem;
    }

    .palette-section-count {
        font-weight: 400;
        text-transform: none;
        letter-spacing: normal;
        font-size: 0.68rem;
        opacity: 0.7;
    }
}

.palette-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
    gap: 0.35rem;
}

.palette-tile {
    @include b.btn-shared;
    background: #fff;
    border: 1px solid c.$border;
    border-radius: 4px;
    padding: 0.4rem 0.25rem 0.3rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
    color: c.$text-dark;
    cursor: pointer;
    text-align: center;

    img {
        width: 28px;
        height: 28px;
        object-fit: contain;
    }

    .material-icons,
    .material-icons-outlined,
    .material-icons-round,
    .material-icons-sharp,
    .material-icons-two-tone {
        font-size: 28px;
        line-height: 1;
    }

    // Square dashed placeholder for Zoom-documented icons whose preview
    // PNG isn't in our assets folder. Same footprint as the rendered
    // icons so the grid layout stays consistent.
    .palette-tile-missing {
        width: 28px;
        height: 28px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px dashed c.$border;
        border-radius: 4px;
        font-size: 0.95rem;
        font-weight: 600;
        opacity: 0.5;
    }

    .palette-tile-name {
        font-size: 0.62rem;
        opacity: 0.7;
        word-break: break-all;
        line-height: 1.15;
        max-height: 2.3em;
        overflow: hidden;
    }

    &:hover {
        background: c.$zoom-button;
        border-color: c.$accent;
        color: c.$accent;
    }

    &:active {
        background: color.adjust(c.$zoom-button, $lightness: -5%);
    }
}

.palette-empty {
    color: c.$text-dark;
    opacity: 0.55;
    font-style: italic;
    font-size: 0.82rem;
    margin: 0;
    padding: 0.5rem;
    text-align: center;
}

// Footer sits below the scroller, holding the Clear button out of the way
// of the close button at the top so it's harder to mis-click when reaching
// for "hide log."
.log-drawer-footer {
    flex: 0 0 auto;
    display: flex;
    justify-content: flex-end;
    padding: 0.35rem 0.5rem;
    border-top: 1px solid c.$border;
}

// Shared trash-can icon button used by both the Output card and the Activity
// Log drawer for their respective Clear actions. Subtle by default — only
// the icon at low opacity — to keep it from drawing the eye away from the
// content it's attached to; brightens on hover.
.btn-trash {
    @include b.btn-shared;
    background: transparent;
    border: none;
    padding: 2px;
    color: c.$text-dark;
    opacity: 0.55;
    display: inline-flex;
    align-items: center;
    justify-content: center;

    .material-icons { font-size: 18px; }
    &:hover { opacity: 0.95; color: firebrick; }
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
