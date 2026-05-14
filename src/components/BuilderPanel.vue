<template>
    <section class="builder-panel">
        <header class="builder-title-row">
            <div class="builder-actions">
                <button
                    class="btn-icon"
                    title="New profile"
                    @click="newProfile">
                    <span class="material-icons">data_object</span>
                </button>
                <button
                    class="btn-icon"
                    title="Open a profile JSON file from your computer"
                    @click="openProfile">
                    <span class="material-icons">folder_open</span>
                </button>
                <input
                    ref="fileInput"
                    type="file"
                    accept="application/json,.json"
                    class="file-input-hidden"
                    @change="onFileChosen" />
                <button
                    class="btn-icon"
                    :disabled="profile === null"
                    :title="profile === null ? 'Fix JSON errors to enable download' : 'Download profile JSON'"
                    @click="$emit('download')">
                    <span class="material-icons">download</span>
                </button>
            </div>
        </header>

        <!-- The Events-only checkbox used to live up here; it moved into the
             builder content (with the rest of the profile-wide controls) so
             this header stays focused on document-level actions. -->

        <div
            v-if="profile === null"
            class="builder-empty">
            JSON parsing failed. Fix the JSON to enable the builder.
        </div>

        <div
            v-else
            class="builder-content">
            <!-- ============== PROFILE-WIDE TOGGLES ============== -->
            <label class="cb-event-only">
                <span class="cb-event-only-row">
                    <input
                        type="checkbox"
                        v-model="eventOnly" />
                    Events only
                </span>
                <span class="cb-event-only-hint">
                    (hides the Native Room Controls UI in Zoom while still firing
                    event rules — used when a custom Zoom App provides the UI, so
                    users don't have to switch between native controls and the
                    custom app)
                </span>
            </label>

            <!-- ============== INFO ============== -->
            <div
                v-if="localProfile.info"
                class="info-card">
                <div class="card-header">
                    <span class="row-label">Info</span>
                    <button
                        class="btn-delete"
                        title="Remove info block"
                        @click="removeInfo">
                        ×
                    </button>
                </div>
                <p class="section-hint">
                    These fields aren't used by Zoom — they're for your reference
                    only.
                </p>
                <div class="info-fields">
                    <InfoRow
                        v-for="entry in infoEntries"
                        :key="entry.id"
                        :row-key="entry.key"
                        v-model="entry.value"
                        :all-keys="allInfoKeys"
                        :placeholder-map="INFO_PLACEHOLDERS"
                        @rename="renameInfoEntry(entry.id, $event)"
                        @remove="removeInfoEntry(entry.id)" />
                </div>
                <button
                    class="btn-add"
                    title="Add another arbitrary key/value entry to the Info block (e.g. for project metadata you want to keep with the profile). Zoom Rooms ignores everything in Info — it's just for your reference."
                    @click="addInfoItem">
                    + Item
                </button>
                <CommentRow
                    :owner="localProfile.info"
                    @add="addComment(localProfile.info)"
                    @remove="removeComment(localProfile.info)" />
            </div>
            <button
                v-else
                class="btn-add btn-add-section"
                title="Add an optional Info block to hold metadata like customer / job / location. Zoom Rooms ignores this — it's purely for your reference."
                @click="addInfo">
                + Info
            </button>

            <!-- ============== ADAPTERS ============== -->
            <h3 class="section-title">Adapters</h3>
            <div
                v-for="(adapter, ai) in localProfile.adapters"
                :key="'adapter-' + ai"
                class="adapter-card">
                <div class="adapter-header">
                    <span class="row-label">Adapter</span>
                    <div class="adapter-model-combo">
                        <input
                            type="text"
                            v-model="adapter.model"
                            class="adapter-model"
                            placeholder="model"
                            required
                            @change="onAdapterModelChange(ai)" />
                        <button
                            type="button"
                            class="model-chevron"
                            :aria-expanded="openModelDropdownIndex === ai"
                            title="Pick from known models"
                            @click.stop="toggleModelDropdown(ai)">
                            ▾
                        </button>
                        <ul
                            v-if="openModelDropdownIndex === ai"
                            class="model-dropdown"
                            @click.stop>
                            <li
                                v-for="m in ADAPTER_MODELS"
                                :key="m"
                                :class="{ selected: adapter.model === m }"
                                @click="selectModel(ai, m)">
                                {{ m }}
                            </li>
                        </ul>
                    </div>
                    <input
                        v-if="adapter.model !== 'USB2Serial'"
                        type="text"
                        class="adapter-addr"
                        :placeholder="ipPlaceholder(adapter.model)"
                        v-model="adapter.ip"
                        :required="!adapter.uuid" />
                    <input
                        v-else
                        type="text"
                        class="adapter-addr"
                        placeholder="com port"
                        v-model="adapter.com"
                        required />
                    <input
                        v-if="adapter.model === 'iTachIP2SL' || adapter.model === 'iTachIP2CC'"
                        type="text"
                        class="adapter-uuid"
                        placeholder="UUID (optional)"
                        v-model="adapter.uuid" />
                    <button
                        class="btn-delete"
                        title="Remove adapter"
                        @click="removeAdapter(ai)">
                        ×
                    </button>
                </div>
                <CommentRow
                    :owner="adapter"
                    @add="addComment(adapter)"
                    @remove="removeComment(adapter)" />
                <div class="ports-section">
                    <div
                        v-for="(port, pi) in adapter.ports"
                        :key="'port-' + pi"
                        class="port-card">
                        <div class="port-header">
                            <span class="row-label">Port</span>
                            <input
                                type="text"
                                class="port-id"
                                placeholder="id"
                                required
                                v-model="port.id" />
                            <input
                                type="text"
                                class="port-name"
                                placeholder="name"
                                v-model="port.name" />
                            <input
                                v-if="adapter.model === 'iTachIP2CC'"
                                type="number"
                                class="port-position"
                                placeholder="pos"
                                min="1"
                                max="3"
                                required
                                v-model.number="port.position" />
                            <input
                                type="text"
                                class="icon-input"
                                placeholder="icon"
                                title="Icon (e.g. icon_alert, mdi:lamp:filled)"
                                :value="getIcon([port.id])"
                                :disabled="!port.id"
                                @input="setIcon([port.id], $event.target.value)" />
                            <button
                                class="btn-delete"
                                title="Remove port"
                                @click="removePort(ai, pi)">
                                ×
                            </button>
                        </div>
                        <CommentRow
                            :owner="port"
                            @add="addComment(port)"
                            @remove="removeComment(port)" />

                        <!-- Port settings (iTachIP2SL) -->
                        <div
                            v-if="adapter.model === 'iTachIP2SL'"
                            class="settings-card">
                            <span class="row-label small">Settings</span>
                            <div class="settings-grid">
                                <label>baud
                                    <select :value="port.settings?.baud_rate"
                                            @change="ensurePortSettings(port, 'iTachIP2SL'); port.settings.baud_rate = $event.target.value">
                                        <option v-for="b in ITACH_BAUD" :key="b" :value="b">{{ b }}</option>
                                    </select>
                                </label>
                                <label>flow
                                    <select :value="port.settings?.flow_control"
                                            @change="ensurePortSettings(port, 'iTachIP2SL'); port.settings.flow_control = $event.target.value">
                                        <option v-for="f in ITACH_FLOW" :key="f" :value="f">{{ f }}</option>
                                    </select>
                                </label>
                                <label>parity
                                    <select :value="port.settings?.parity"
                                            @change="ensurePortSettings(port, 'iTachIP2SL'); port.settings.parity = $event.target.value">
                                        <option v-for="p in ITACH_PARITY" :key="p" :value="p">{{ p }}</option>
                                    </select>
                                </label>
                            </div>
                        </div>

                        <!-- Port settings (USB2Serial) -->
                        <div
                            v-if="adapter.model === 'USB2Serial'"
                            class="settings-card">
                            <span class="row-label small">Settings</span>
                            <div class="settings-grid">
                                <label>baud
                                    <select :value="port.settings?.baud_rate"
                                            @change="ensurePortSettings(port, 'USB2Serial'); port.settings.baud_rate = Number($event.target.value)">
                                        <option v-for="b in USB_BAUD" :key="b" :value="b">{{ b }}</option>
                                    </select>
                                </label>
                                <label>data
                                    <select :value="port.settings?.data_bits"
                                            @change="ensurePortSettings(port, 'USB2Serial'); port.settings.data_bits = Number($event.target.value)">
                                        <option v-for="d in USB_DATA_BITS" :key="d" :value="d">{{ d }}</option>
                                    </select>
                                </label>
                                <label>parity
                                    <select :value="port.settings?.parity"
                                            @change="ensurePortSettings(port, 'USB2Serial'); port.settings.parity = Number($event.target.value)">
                                        <option v-for="(label, i) in USB_PARITY_LABELS" :key="i" :value="i">{{ label }}</option>
                                    </select>
                                </label>
                                <label>stop
                                    <select :value="port.settings?.stop_bits"
                                            @change="ensurePortSettings(port, 'USB2Serial'); port.settings.stop_bits = Number($event.target.value)">
                                        <option v-for="(label, i) in USB_STOP_BITS_LABELS" :key="i" :value="USB_STOP_BITS[i]">{{ label }}</option>
                                    </select>
                                </label>
                                <label>flow
                                    <select :value="port.settings?.flow_control"
                                            @change="ensurePortSettings(port, 'USB2Serial'); port.settings.flow_control = Number($event.target.value)">
                                        <option v-for="(label, i) in USB_FLOW_LABELS" :key="i" :value="i">{{ label }}</option>
                                    </select>
                                </label>
                            </div>
                        </div>

                        <!-- iTachIP2CC ports have auto-generated methods -->
                        <div
                            v-if="adapter.model === 'iTachIP2CC'"
                            class="port-hint">
                            Methods auto-generated (power.on / power.off) from position.
                        </div>

                        <!-- Methods section -->
                        <div
                            v-else
                            class="methods-section">
                            <div
                                v-for="(method, mi) in port.methods"
                                :key="'method-' + mi"
                                class="method-card"
                                :class="{
                                    'method-hidden': isMethodInvisible(port.id, method.id),
                                    'method-main': getMainMethod(port.id) === method.id,
                                }">
                                <div class="method-row">
                                    <span class="row-label">Method</span>
                                    <input
                                        type="text"
                                        class="method-id"
                                        placeholder="id"
                                        required
                                        v-model="method.id" />
                                    <input
                                        type="text"
                                        class="method-name"
                                        placeholder="name"
                                        v-model="method.name" />
                                    <input
                                        type="text"
                                        class="method-cmd"
                                        placeholder="command"
                                        required
                                        v-model="method.command" />
                                    <select
                                        v-model="method.type"
                                        @change="onMethodTypeChange(method)">
                                        <option value="action">action</option>
                                        <option value="actions">actions</option>
                                    </select>
                                    <input
                                        type="text"
                                        class="icon-input"
                                        placeholder="icon"
                                        title="Icon (e.g. icon_alert, mdi:lamp:filled)"
                                        :value="getIcon([port.id, method.id])"
                                        :disabled="!port.id || !method.id"
                                        @input="setIcon([port.id, method.id], $event.target.value)" />
                                    <button
                                        class="btn-delete"
                                        title="Remove method"
                                        @click="removeMethod(ai, pi, mi)">
                                        ×
                                    </button>
                                </div>
                                <div class="method-toggles">
                                    <button
                                        type="button"
                                        class="btn-method-toggle btn-main-method"
                                        :class="{
                                            active: getMainMethod(port.id) === method.id,
                                            hidden: isMethodInvisible(port.id, method.id),
                                        }"
                                        :disabled="!port.id || !method.id || isMethodInvisible(port.id, method.id)"
                                        :title="isMethodInvisible(port.id, method.id)
                                            ? 'Main method unavailable while the method is hidden'
                                            : getMainMethod(port.id) === method.id
                                                ? 'This is the port\'s main method (click to unset)'
                                                : 'Set as the port\'s main method'"
                                        @click="toggleMainMethod(port, method)">
                                        <span class="material-icons">{{
                                            getMainMethod(port.id) === method.id ? 'star' : 'star_border'
                                        }}</span>
                                    </button>
                                    <button
                                        type="button"
                                        class="btn-method-toggle btn-visibility"
                                        :class="{ active: isMethodInvisible(port.id, method.id) }"
                                        :disabled="!port.id || !method.id"
                                        :title="isMethodInvisible(port.id, method.id)
                                            ? 'Hidden in Zoom Rooms (click to make visible)'
                                            : 'Visible in Zoom Rooms (click to hide)'"
                                        @click="setMethodInvisible(port, method, !isMethodInvisible(port.id, method.id))">
                                        <span class="material-icons">{{
                                            isMethodInvisible(port.id, method.id) ? 'visibility_off' : 'visibility'
                                        }}</span>
                                    </button>
                                </div>
                                <CommentRow
                                    :owner="method"
                                    @add="addComment(method)"
                                    @remove="removeComment(method)" />
                                <!-- params for type=actions -->
                                <div
                                    v-if="method.type === 'actions'"
                                    class="params-section">
                                    <div
                                        v-for="(param, ppi) in method.params"
                                        :key="'param-' + ppi"
                                        class="param-card">
                                        <div class="param-row">
                                            <span class="row-label">Param</span>
                                            <input
                                                type="text"
                                                class="param-id"
                                                placeholder="id"
                                                required
                                                v-model="param.id" />
                                            <input
                                                type="text"
                                                class="param-name"
                                                placeholder="name"
                                                v-model="param.name" />
                                            <input
                                                type="text"
                                                class="param-value"
                                                placeholder="value"
                                                required
                                                v-model="param.value" />
                                            <input
                                                type="text"
                                                class="icon-input"
                                                placeholder="icon"
                                                title="Icon (e.g. icon_alert, mdi:lamp:filled)"
                                                :value="getIcon([port.id, method.id, param.id])"
                                                :disabled="!port.id || !method.id || !param.id"
                                                @input="setIcon([port.id, method.id, param.id], $event.target.value)" />
                                            <button
                                                class="btn-delete"
                                                title="Remove param"
                                                @click="removeParam(ai, pi, mi, ppi)">
                                                ×
                                            </button>
                                        </div>
                                        <CommentRow
                                            :owner="param"
                                            @add="addComment(param)"
                                            @remove="removeComment(param)" />
                                    </div>
                                    <button
                                        class="btn-add"
                                        title="Add a parameter to this method (only used when type = 'actions'). The method's command string can substitute '%' with the param's value."
                                        @click="addParam(ai, pi, mi)">
                                        + Param
                                    </button>
                                </div>
                            </div>
                            <button
                                class="btn-add"
                                title="Add another method to this port (a method is a single command or a set of commands you can call by id, e.g. 'power.on')."
                                @click="addMethod(ai, pi)">
                                + Method
                            </button>
                        </div>
                    </div>
                    <button
                        class="btn-add"
                        title="Add another port to this adapter. Each port represents a connected device (or relay channel for iTachIP2CC)."
                        @click="addPort(ai)">
                        + Port
                    </button>
                </div>
            </div>
            <button
                class="btn-add btn-add-section"
                title="Add another adapter (a network or USB-serial bridge that hosts one or more device ports)."
                @click="addAdapter">
                + Adapter
            </button>

            <!-- ============== SCENES ============== -->
            <h3 class="section-title">Scenes</h3>
            <div
                v-for="(scene, si) in localProfile.scenes"
                :key="'scene-' + si"
                class="scene-card">
                <div class="scene-header">
                    <span class="row-label">Scene</span>
                    <input
                        type="text"
                        class="scene-id"
                        placeholder="id"
                        required
                        v-model="scene.id" />
                    <input
                        type="text"
                        class="scene-name"
                        placeholder="name"
                        required
                        v-model="scene.name" />
                    <input
                        type="text"
                        class="scene-icon"
                        placeholder="icon (optional)"
                        v-model="scene.icon" />
                    <button
                        class="btn-delete"
                        title="Remove scene"
                        @click="removeScene(si)">
                        ×
                    </button>
                </div>
                <CommentRow
                    :owner="scene"
                    @add="addComment(scene)"
                    @remove="removeComment(scene)" />
                <div class="commands-section">
                    <div
                        v-for="(_, ci) in scene.commands"
                        :key="'cmd-' + ci"
                        class="command-row">
                        <span class="row-label small">Cmd</span>
                        <input
                            type="text"
                            class="command-ref"
                            placeholder="device.method[.param]"
                            required
                            v-model="scene.commands[ci]" />
                        <button
                            class="btn-delete"
                            title="Remove command"
                            @click="removeSceneCommand(si, ci)">
                            ×
                        </button>
                    </div>
                    <button
                        class="btn-add"
                        title="Add a command to run when this scene fires. Commands reference an existing method as port.method[.param], e.g. display.power.on."
                        @click="addSceneCommand(si)">
                        + Command
                    </button>
                </div>
            </div>
            <button
                class="btn-add btn-add-section"
                title="Add a scene — a button shown at the top of the Native Room Controls UI that fires a list of commands when pressed."
                @click="addScene">
                + Scene
            </button>

            <!-- ============== STYLES ============== -->
            <!-- Every documented style pattern is handled by a dedicated -->
            <!-- control elsewhere in the builder (names live on the port/ -->
            <!-- method directly, icons / main_method / invisible / event-only -->
            <!-- have their own inputs). This section is an escape hatch for -->
            <!-- patterns Zoom adds later or that we haven't surfaced yet. -->
            <h3 class="section-title">Styles</h3>
            <p class="section-hint">
                Escape hatch for style patterns the builder doesn't know about
                yet. Names and icons live on the port / method / param fields
                above; main method, invisible, and events-only have their own
                controls.
            </p>
            <div
                v-for="item in freeFormStyles"
                :key="'style-' + item.index"
                class="style-row">
                <span class="row-label small">Style</span>
                <input
                    type="text"
                    class="style-text"
                    placeholder="key.path=value"
                    required
                    :value="item.value"
                    @input="localProfile.styles[item.index] = $event.target.value" />
                <button
                    class="btn-delete"
                    title="Remove style"
                    @click="removeStyle(item.index)">
                    ×
                </button>
            </div>
            <button
                class="btn-add btn-add-section"
                title="Add a raw style entry — used for style patterns the builder doesn't have a dedicated control for yet. Format is 'key.path=value'."
                @click="addStyle">
                + Style
            </button>

            <!-- ============== RULES ============== -->
            <h3 class="section-title">Rules</h3>
            <div
                v-for="([event, cmds], ri) in ruleEntries"
                :key="'rule-' + event"
                class="rule-card">
                <div class="rule-header">
                    <span class="row-label">Event</span>
                    <input
                        type="text"
                        class="rule-event"
                        :value="event"
                        placeholder="event_name (e.g. zr_meeting_started)"
                        required
                        @change="renameRule(event, $event.target.value)" />
                    <button
                        class="btn-delete"
                        title="Remove rule"
                        @click="removeRule(event)">
                        ×
                    </button>
                </div>
                <div class="commands-section">
                    <div
                        v-for="(_, ci) in cmds"
                        :key="'rcmd-' + ci"
                        class="command-row">
                        <span class="row-label small">Cmd</span>
                        <input
                            type="text"
                            class="command-ref"
                            placeholder="device.method[.param]"
                            required
                            v-model="localProfile.rules[event][ci]" />
                        <button
                            class="btn-delete"
                            title="Remove command"
                            @click="removeRuleCommand(event, ci)">
                            ×
                        </button>
                    </div>
                    <button
                        class="btn-add"
                        title="Add a command to run when this event fires. Commands reference an existing method as port.method[.param]."
                        @click="addRuleCommand(event)">
                        + Command
                    </button>
                </div>
            </div>
            <button
                class="btn-add btn-add-section"
                title="Add a rule — binds a Zoom event (zr_meeting_started, zr_meeting_ended, custom events from response filters, etc.) to a list of commands to run automatically."
                @click="addRule">
                + Rule
            </button>

            <!-- ============== RESPONSE FILTERS ============== -->
            <h3 class="section-title">Response Filters</h3>
            <div
                v-for="(filter, fi) in localProfile.response_filters"
                :key="'filter-' + fi"
                class="filter-card">
                <div class="filter-header">
                    <span class="row-label">Filter</span>
                    <input
                        type="text"
                        class="filter-name"
                        placeholder="name"
                        required
                        v-model="filter.name" />
                    <button
                        class="btn-delete"
                        title="Remove filter"
                        @click="removeFilter(fi)">
                        ×
                    </button>
                </div>
                <div class="filter-fields">
                    <label class="kv-row">
                        <span class="kv-key">regex</span>
                        <input
                            type="text"
                            v-model="filter.filter_regex"
                            placeholder="filter_regex"
                            required />
                    </label>
                    <label class="kv-row">
                        <span class="kv-key">trigger</span>
                        <input
                            type="text"
                            v-model="filter.trigger_event"
                            placeholder="trigger_event (rule key)"
                            required />
                    </label>
                </div>
                <CommentRow
                    :owner="filter"
                    @add="addComment(filter)"
                    @remove="removeComment(filter)" />
            </div>
            <button
                class="btn-add btn-add-section"
                title="Add a response filter — watches incoming data from a port for a regex match and fires a custom event (referenced by a rule) when it matches."
                @click="addFilter">
                + Filter
            </button>
        </div>
    </section>
</template>

<script>
import { SCHEMA_URL, EDITOR_URL, todayIso, orderProfileKeys } from '@/config';

// Small inline component for the "+ Comment / $comment" row. Owns no state of
// its own — emits to the parent which mutates the owner directly.
const CommentRow = {
    name: 'CommentRow',
    props: {
        owner: { type: Object, required: true },
    },
    emits: ['add', 'remove'],
    template: `
        <div v-if="hasComment" class="comment-row">
            <span class="row-label small">$comment</span>
            <input
                type="text"
                class="comment-input"
                v-model="owner.$comment"
                placeholder="comment text" />
            <button class="btn-delete" title="Remove comment" @click="$emit('remove')">×</button>
        </div>
        <button
            v-else
            class="btn-comment"
            title="Add a $comment field to this item — free-form text for documenting why something is set up the way it is. Zoom Rooms (and the schema validator) ignore $comment entirely; it's only for humans reading the JSON later."
            @click="$emit('add')">+ Comment</button>
    `,
    computed: {
        hasComment() {
            return Object.prototype.hasOwnProperty.call(this.owner, '$comment');
        },
    },
};

// One info-block row. Holds its own `localKey` state instead of binding the
// input value straight to the data, so the user's typed key survives parent
// re-renders (e.g. when +Item adds a sibling row) — that was the source of
// the "all my renames revert to customN" bug. The placeholder follows the
// typed key, not the committed key, so typing "job" immediately swaps to
// the corresponding hint. Duplicate keys are detected here against the
// `allKeys` list and shown as an inline warning; the rename is *not* emitted
// until the conflict is resolved, but the typed text stays put for the user
// to see and fix.
const InfoRow = {
    name: 'InfoRow',
    props: {
        rowKey: { type: String, required: true },
        modelValue: { type: String, default: '' },
        allKeys: { type: Array, default: () => [] },
        placeholderMap: { type: Object, default: () => ({}) },
    },
    emits: ['rename', 'update:modelValue', 'remove'],
    data() {
        return { localKey: this.rowKey };
    },
    computed: {
        hasConflict() {
            const trimmed = (this.localKey || '').trim();
            if (!trimmed) return false;
            // Count how many entries in allKeys hold the same key. When
            // we're already committed at this key (rowKey === trimmed),
            // a count > 1 means another entry duplicates us. When we're
            // mid-typing (rowKey !== trimmed), a count >= 1 means another
            // entry already has the typed key.
            let count = 0;
            for (const k of this.allKeys) {
                if (k === trimmed) count++;
            }
            if (this.rowKey === trimmed) {
                return count > 1;
            }
            return count >= 1;
        },
        valuePlaceholder() {
            return this.placeholderMap[this.localKey] || 'value';
        },
    },
    watch: {
        // When the data's key for this row changes (e.g., rename committed
        // or prop sync after JSON-text edit), reset local input to match.
        rowKey(newVal) {
            this.localKey = newVal;
        },
    },
    methods: {
        onKeyBlur() {
            const trimmed = (this.localKey || '').trim();
            // Empty keys aren't useful in a JSON object — revert. Anything
            // else commits unconditionally, even if it collides with an
            // existing key. The parent's renameInfoKey handles the collision
            // by overwriting the existing entry so the UI and data never
            // drift out of sync. The `hasConflict` computed still drives
            // the visual warning while the user is typing — that's the
            // heads-up that the commit is going to replace another field.
            if (!trimmed) {
                this.localKey = this.rowKey;
                return;
            }
            if (trimmed === this.rowKey) return;
            this.$emit('rename', trimmed);
        },
    },
    template: `
        <div class="kv-row" :class="{ 'kv-row-conflict': hasConflict }">
            <input
                type="text"
                class="kv-key-input"
                v-model="localKey"
                placeholder="key"
                @change="onKeyBlur" />
            <input
                type="text"
                :value="modelValue"
                @input="$emit('update:modelValue', $event.target.value)"
                :placeholder="valuePlaceholder" />
            <span
                v-if="hasConflict"
                class="kv-conflict"
                :title="'Another field is already named ' + localKey.trim()">
                duplicate
            </span>
            <button class="btn-delete" title="Remove item" @click="$emit('remove')">×</button>
        </div>
    `,
};

// Known adapter models. These populate the model picker dropdown; users can
// still type any custom string (e.g., a Zoom-added model we don't yet know
// about) directly into the input.
const ADAPTER_MODELS = ['iTachIP2SL', 'iTachIP2CC', 'GenericNetworkAdapter', 'USB2Serial'];

// Known info fields surfaced in the schema. Anything else the user adds via
// "+ Item" is preserved as a custom property.
const INFO_KEYS = [
    'customer',
    'location',
    'job',
    'displayType',
    'automation',
    'createdBy',
    'createdDate',
];

// Example values shown as input placeholders so each known info field gets
// a meaningful hint instead of just echoing its label.
const INFO_PLACEHOLDERS = {
    customer: 'Veridian Dynamics',
    location: 'Huddle Room 3',
    job: 'ACME-1234',
    displayType: 'Samsung QM75R',
    automation: 'Display on at meeting start, off at operation hours end',
    createdBy: 'J. Programmer',
    createdDate: 'YYYY-MM-DD',
};

const ITACH_BAUD = ['300', '1200', '2400', '4800', '9600', '19200', '38400', '57600', '115200'];
const ITACH_FLOW = ['FLOW_NONE', 'FLOW_HARDWARE'];
const ITACH_PARITY = ['PARITY_NO', 'PARITY_ODD', 'PARITY_EVEN'];

const USB_BAUD = [300, 600, 1200, 1800, 2400, 4800, 7200, 9600, 14400, 19200, 28800, 38400, 115200, 230400];
const USB_DATA_BITS = [5, 6, 7, 8];
const USB_PARITY_LABELS = ['None', 'Odd', 'Even', 'Mark', 'Space'];
const USB_STOP_BITS = [1, 2, 3];
const USB_STOP_BITS_LABELS = ['1', '2', '1.5'];
const USB_FLOW_LABELS = ['None', 'Software', 'Hardware'];

// Patterns for styles entries that have dedicated UI controls. Anything
// matching here is hidden from the free-form Styles section and managed via
// the corresponding checkbox / radio / global toggle.
const STYLE_PATTERNS = {
    eventOnly: (s) => s === 'zr_event_only=true',
    mainMethod: (s) => /^[A-Za-z0-9_]+\.main_method=/.test(s),
    methodInvisible: (s) => /^[A-Za-z0-9_]+\.[A-Za-z0-9_]+\.invisible=/.test(s),
    icon: (s) => /^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+){0,2}\.icon=/.test(s),
    managedByUI(s) {
        return (
            this.eventOnly(s) ||
            this.mainMethod(s) ||
            this.methodInvisible(s) ||
            this.icon(s)
        );
    },
};

// Built via JSON, not structuredClone — Vue's reactive Proxy can expose
// framework internals that structuredClone refuses to serialize.
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// Build a fresh info object with all known fields as empty strings, in
// INFO_KEYS order. The user can rename, fill, or delete any of them; the
// placeholders give a hint about what each is for, and deleting is just
// `× this row`.
function makeBlankInfo() {
    const info = {};
    for (const k of INFO_KEYS) info[k] = '';
    return info;
}

// Strip the special `$comment` property out of an info object so we can
// compare just the user-facing fields. The CommentRow at the bottom of the
// info card manages `$comment` independently of the entries array.
function infoWithoutComment(info) {
    if (!info) return {};
    const out = {};
    for (const k of Object.keys(info)) {
        if (k !== '$comment') out[k] = info[k];
    }
    return out;
}

// Cheap deep-equal — info is always plain JSON-shaped data so JSON.stringify
// is a fine yardstick. Used to detect "echoes" of our own emits coming back
// through the prop, so we can skip pointless re-sync work.
function shallowJsonEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}

// Custom JSON serializer used in place of JSON.stringify when emitting the
// profile. It handles every value type the same way as JSON.stringify (so the
// non-info parts of the profile come out byte-identical), but for the info
// section it emits one line per entry in the supplied array — which lets
// duplicate keys appear in the JSON text (JSON.stringify can't do this since
// plain JS objects can't hold duplicate keys).
function serializeProfileJson(profile, infoEntries, indent = 4) {
    return serializeValue(profile, 0, indent, infoEntries);
}

function pad(level, indent) {
    return ' '.repeat(level * indent);
}

function serializeValue(value, level, indent, infoEntries) {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        const items = value.map(
            (v) => pad(level + 1, indent) + serializeValue(v, level + 1, indent, infoEntries)
        );
        return '[\n' + items.join(',\n') + '\n' + pad(level, indent) + ']';
    }
    const keys = Object.keys(value);
    if (keys.length === 0) return '{}';
    const pairs = keys.map((k) => {
        const childIndent = pad(level + 1, indent);
        if (level === 0 && k === 'info') {
            return (
                childIndent +
                JSON.stringify(k) +
                ': ' +
                serializeInfoSection(value[k], infoEntries, level + 1, indent)
            );
        }
        return (
            childIndent +
            JSON.stringify(k) +
            ': ' +
            serializeValue(value[k], level + 1, indent, infoEntries)
        );
    });
    return '{\n' + pairs.join(',\n') + '\n' + pad(level, indent) + '}';
}

function serializeInfoSection(infoObj, entries, level, indent) {
    const childIndent = pad(level + 1, indent);
    const pairs = [];
    // `$comment` is owned by CommentRow, not by the entries array, so emit it
    // first from the underlying info object if present.
    if (infoObj && '$comment' in infoObj) {
        pairs.push(
            childIndent + '"$comment": ' + JSON.stringify(infoObj.$comment)
        );
    }
    // Then every entry in order — including duplicates. The resulting JSON
    // text shows two lines with the same key. JSON.parse will collapse them
    // (last-wins) when the file is consumed, but writing them out is honest
    // about what's in the builder.
    for (const e of entries) {
        pairs.push(
            childIndent + JSON.stringify(e.key) + ': ' + JSON.stringify(e.value)
        );
    }
    if (pairs.length === 0) return '{}';
    return '{\n' + pairs.join(',\n') + '\n' + pad(level, indent) + '}';
}

export default {
    name: 'BuilderPanel',
    components: { CommentRow, InfoRow },
    props: {
        profile: {
            type: Object,
            default: null,
        },
    },
    emits: ['update:json', 'download'],
    data() {
        // Build the initial info entries from the prop. Each entry has a
        // stable id so the array can hold duplicate keys without v-for
        // collisions — that's what lets the user actually see two rows
        // labelled "job" instead of having one silently overwrite the other.
        const initialInfo = (this.profile || {}).info || null;
        const initialEntries = [];
        let nextEntryId = 1;
        if (initialInfo) {
            for (const [k, v] of Object.entries(initialInfo)) {
                if (k === '$comment') continue;
                initialEntries.push({ id: nextEntryId++, key: k, value: v });
            }
        }
        return {
            localProfile: deepClone(this.profile || {}),
            syncingFromProp: false,
            // -1 when no model picker is open; otherwise the adapter index
            // whose dropdown is currently expanded. Tracked at the component
            // level rather than per-adapter so opening one closes the others.
            openModelDropdownIndex: -1,
            // Info rendered as an ordered array of {id, key, value} rather
            // than as the underlying object's keys so duplicate keys can
            // coexist visually. The entries->info pipeline collapses
            // duplicates (last write wins) only at the boundary to the
            // emitted profile. See the watchers below.
            infoEntries: initialEntries,
            nextInfoEntryId: nextEntryId,
            // Last-known non-$comment info content, used to detect when an
            // incoming prop change actually requires re-syncing entries from
            // info (external JSON edit) vs. is just an echo of our own emit
            // or a $comment-only change.
            lastSyncedNonCommentInfo: deepClone(infoWithoutComment(initialInfo)),
            ADAPTER_MODELS,
            INFO_KEYS,
            INFO_PLACEHOLDERS,
            ITACH_BAUD,
            ITACH_FLOW,
            ITACH_PARITY,
            USB_BAUD,
            USB_DATA_BITS,
            USB_PARITY_LABELS,
            USB_STOP_BITS,
            USB_STOP_BITS_LABELS,
            USB_FLOW_LABELS,
        };
    },
    computed: {
        // Flat list of keys currently held by the entries array. Includes
        // duplicates intentionally — InfoRow's conflict detection counts
        // occurrences against this list so two entries with the same key
        // both flag each other as duplicates. `$comment` is also pushed in
        // (from localProfile.info) so renaming a row to `$comment` is
        // detected as colliding with the CommentRow-managed property.
        allInfoKeys() {
            const keys = this.infoEntries.map((e) => e.key);
            if (this.localProfile.info && '$comment' in this.localProfile.info) {
                keys.push('$comment');
            }
            return keys;
        },
        ruleEntries() {
            if (!this.localProfile.rules) return [];
            return Object.entries(this.localProfile.rules).filter(
                ([k]) => k !== '$comment'
            );
        },
        eventOnly: {
            get() {
                return (this.localProfile.styles || []).includes('zr_event_only=true');
            },
            set(value) {
                this.setStylesFiltered(
                    (s) => s !== 'zr_event_only=true',
                    value ? 'zr_event_only=true' : null
                );
            },
        },
        // Styles entries that aren't managed by a dedicated UI control above.
        // We keep the original index alongside the value so deletes hit the
        // right slot in the underlying array.
        freeFormStyles() {
            const styles = this.localProfile.styles || [];
            return styles
                .map((value, index) => ({ value, index }))
                .filter(({ value }) => !STYLE_PATTERNS.managedByUI(value));
        },
    },
    mounted() {
        // Close the model dropdown when clicking outside it. The chevron
        // button and the dropdown <ul> use @click.stop to prevent their own
        // clicks from bubbling up and closing themselves.
        document.addEventListener('click', this.closeModelDropdown);
    },
    beforeUnmount() {
        document.removeEventListener('click', this.closeModelDropdown);
    },
    watch: {
        profile: {
            deep: true,
            handler(newProfile) {
                this.syncingFromProp = true;
                this.localProfile = deepClone(newProfile || {});
                // Re-sync the info entries only if the *non-$comment* part
                // of info actually changed. Skipping the sync when the
                // change came from our own emit (echo) or from a CommentRow
                // mutation lets duplicate entries survive the round-trip;
                // we'd lose them if we always rebuilt entries from info.
                const incomingNoComment = infoWithoutComment(
                    this.localProfile.info
                );
                if (!shallowJsonEqual(incomingNoComment, this.lastSyncedNonCommentInfo)) {
                    this.syncEntriesFromInfo(this.localProfile.info);
                }
                this.$nextTick(() => {
                    this.syncingFromProp = false;
                });
            },
        },
        infoEntries: {
            deep: true,
            handler() {
                if (this.syncingFromProp) return;
                const newInfo = this.buildInfoFromEntries();
                const newNoComment = infoWithoutComment(newInfo);
                if (shallowJsonEqual(newNoComment, this.lastSyncedNonCommentInfo)) {
                    return;
                }
                this.lastSyncedNonCommentInfo = deepClone(newNoComment);
                // newInfo === null means there are no entries AND no
                // $comment, so the info block is effectively empty — drop
                // the key entirely so v-if="localProfile.info" hides the
                // card and serialized JSON doesn't carry an empty info: {}.
                if (newInfo === null) {
                    delete this.localProfile.info;
                } else {
                    this.localProfile.info = newInfo;
                }
            },
        },
        localProfile: {
            deep: true,
            handler() {
                if (this.syncingFromProp) return;
                if (this.profile === null) return;
                // Emit the JSON *text* instead of an object so duplicate info
                // keys (which a plain object can't hold) make it to the
                // editor. The custom serializer reads `infoEntries` directly
                // for the info section so each duplicate gets its own line.
                const ordered = orderProfileKeys(this.localProfile);
                const json = serializeProfileJson(ordered, this.infoEntries);
                this.$emit('update:json', json);
            },
        },
    },
    methods: {
        ipPlaceholder(/* model */) {
            // Plain field-name placeholder so empty + required highlight
            // doesn't read as "an address that's malformed". The model-aware
            // hint can live in the title attribute if we ever surface it.
            return 'address';
        },

        // ----- Info entries <-> info object plumbing -----
        // Build entries from an info object, preserving existing entry IDs
        // when their keys still match (so a row's input doesn't lose focus
        // / cursor position across prop syncs). `$comment` is held back
        // because CommentRow handles it directly.
        syncEntriesFromInfo(info) {
            const existingByKey = {};
            for (const e of this.infoEntries) {
                if (!existingByKey[e.key]) existingByKey[e.key] = [];
                existingByKey[e.key].push(e);
            }
            const newEntries = [];
            for (const [k, v] of Object.entries(info || {})) {
                if (k === '$comment') continue;
                const existing = existingByKey[k] && existingByKey[k].shift();
                newEntries.push(
                    existing
                        ? { id: existing.id, key: k, value: v }
                        : { id: this.nextInfoEntryId++, key: k, value: v }
                );
            }
            this.infoEntries = newEntries;
            this.lastSyncedNonCommentInfo = deepClone(infoWithoutComment(info));
        },
        // Collapse the entries array into a plain object suitable for
        // emitting as part of the profile. Duplicate keys collapse with
        // the later entry winning (standard JSON object semantics).
        // Returns null when there is nothing to emit (no entries, no
        // $comment) so the caller can delete the info key entirely.
        buildInfoFromEntries() {
            const hasComment =
                this.localProfile.info && '$comment' in this.localProfile.info;
            if (this.infoEntries.length === 0 && !hasComment) {
                return null;
            }
            const info = {};
            if (hasComment) {
                info.$comment = this.localProfile.info.$comment;
            }
            for (const e of this.infoEntries) {
                info[e.key] = e.value;
            }
            return info;
        },

        // ----- Top-level -----
        newProfile() {
            if (!confirm('Clear the profile and start over? This will discard all current data.')) {
                return;
            }
            // Seed with a single GenericNetworkAdapter and one empty port so
            // the user has a real starting structure to fill in, instead of
            // having to click + Adapter + Port + Method themselves before
            // any preview can render.
            // Seed `info` with all known fields (empty) plus the editor's
            // identifying stamps. If the user deletes the info block later,
            // the download path won't recreate it — so this is a one-time
            // provision, not an enforced floor.
            const info = makeBlankInfo();
            info.createdDate = todayIso();
            info.tool = EDITOR_URL;
            this.localProfile = {
                $schema: SCHEMA_URL,
                info,
                adapters: [
                    {
                        model: 'GenericNetworkAdapter',
                        ip: '',
                        ports: [
                            {
                                id: '',
                                name: '',
                                methods: [],
                            },
                        ],
                    },
                ],
            };
            // Rebuild entries from the new info so the builder UI reflects
            // the seed data immediately rather than waiting for the prop
            // round-trip to populate it.
            this.syncEntriesFromInfo(info);
        },
        openProfile() {
            if (!confirm('Replace the current profile with one from a file? Current edits will be lost.')) {
                return;
            }
            // Trigger the hidden file input — the OS file picker takes over
            // from here, and onFileChosen handles the result.
            this.$refs.fileInput.click();
        },
        onFileChosen(event) {
            const file = event.target.files && event.target.files[0];
            // Always clear so picking the same file twice in a row still
            // fires `change`; the actual file processing happens below.
            event.target.value = '';
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                const text = String(reader.result || '');
                // Hand the raw text up to HomeView via the existing
                // update:json channel. If it doesn't parse, the JSON parse
                // error will surface in the preview just like a bad paste —
                // we don't pre-validate here so a partially-broken file
                // still loads for the user to fix in the editor.
                this.$emit('update:json', text);
            };
            reader.onerror = () => {
                alert('Could not read file: ' + (reader.error && reader.error.message));
            };
            reader.readAsText(file);
        },

        // ----- Info -----
        addInfo() {
            if (this.localProfile.info) return;
            this.localProfile.info = makeBlankInfo();
            const entries = [];
            for (const k of INFO_KEYS) {
                entries.push({ id: this.nextInfoEntryId++, key: k, value: '' });
            }
            this.infoEntries = entries;
            this.lastSyncedNonCommentInfo = deepClone(
                infoWithoutComment(this.localProfile.info)
            );
        },
        removeInfo() {
            this.infoEntries = [];
            this.lastSyncedNonCommentInfo = {};
            delete this.localProfile.info;
        },
        addInfoItem() {
            // Auto-name to keep keys non-empty for valid JSON output. The
            // user can rename freely (including to a duplicate, which the
            // entries array now supports with the inline conflict warning).
            const existing = new Set(this.infoEntries.map((e) => e.key));
            let i = 1;
            while (existing.has(`custom${i}`)) i++;
            this.infoEntries.push({
                id: this.nextInfoEntryId++,
                key: `custom${i}`,
                value: '',
            });
        },
        renameInfoEntry(entryId, newKey) {
            newKey = (newKey || '').trim();
            if (!newKey) return;
            const entry = this.infoEntries.find((e) => e.id === entryId);
            if (!entry || newKey === entry.key) return;
            // Renaming to "$comment" is the one special case: $comment is
            // owned by CommentRow, not by the entries array. Move the value
            // there and drop the entry.
            if (newKey === '$comment') {
                if (!this.localProfile.info) this.localProfile.info = {};
                this.localProfile.info.$comment = entry.value;
                this.infoEntries = this.infoEntries.filter(
                    (e) => e.id !== entryId
                );
                return;
            }
            // For everything else, just update the key on the existing entry.
            // Duplicates are allowed — the entries array is an ordered list,
            // not a map, so two rows can both be "job" and the user sees a
            // duplicate warning instead of losing data. The entries-to-info
            // pipeline collapses duplicates on emit (later wins).
            entry.key = newKey;
        },
        removeInfoEntry(entryId) {
            this.infoEntries = this.infoEntries.filter(
                (e) => e.id !== entryId
            );
        },

        // ----- Comments -----
        addComment(obj) {
            obj.$comment = '';
        },
        removeComment(obj) {
            delete obj.$comment;
        },

        // ----- Adapters -----
        addAdapter() {
            if (!this.localProfile.adapters) this.localProfile.adapters = [];
            this.localProfile.adapters.push({
                model: 'iTachIP2SL',
                ip: '',
                ports: [],
            });
        },
        removeAdapter(ai) {
            this.localProfile.adapters.splice(ai, 1);
        },
        onAdapterModelChange(ai) {
            const adapter = this.localProfile.adapters[ai];
            if (adapter.model === 'USB2Serial') {
                if (adapter.com == null) adapter.com = '';
            }
        },
        toggleModelDropdown(ai) {
            this.openModelDropdownIndex =
                this.openModelDropdownIndex === ai ? -1 : ai;
        },
        selectModel(ai, model) {
            this.localProfile.adapters[ai].model = model;
            this.openModelDropdownIndex = -1;
            this.onAdapterModelChange(ai);
        },
        closeModelDropdown() {
            this.openModelDropdownIndex = -1;
        },

        // ----- Ports -----
        addPort(ai) {
            const adapter = this.localProfile.adapters[ai];
            if (!adapter.ports) adapter.ports = [];
            const port = { id: '', name: '' };
            if (adapter.model === 'iTachIP2CC') {
                port.position = 1;
            } else {
                port.methods = [];
            }
            adapter.ports.push(port);
        },
        removePort(ai, pi) {
            this.localProfile.adapters[ai].ports.splice(pi, 1);
        },
        ensurePortSettings(port, model) {
            if (port.settings) return;
            if (model === 'iTachIP2SL') {
                port.settings = {
                    baud_rate: '9600',
                    flow_control: 'FLOW_NONE',
                    parity: 'PARITY_NO',
                };
            } else if (model === 'USB2Serial') {
                port.settings = {
                    baud_rate: 9600,
                    data_bits: 8,
                    parity: 0,
                    stop_bits: 1,
                    flow_control: 0,
                };
            }
        },

        // ----- Methods -----
        addMethod(ai, pi) {
            const port = this.localProfile.adapters[ai].ports[pi];
            if (!port.methods) port.methods = [];
            port.methods.push({
                id: '',
                name: '',
                command: '',
                type: 'action',
            });
        },
        removeMethod(ai, pi, mi) {
            this.localProfile.adapters[ai].ports[pi].methods.splice(mi, 1);
        },
        onMethodTypeChange(method) {
            if (method.type === 'actions') {
                if (!Array.isArray(method.params)) method.params = [];
            } else {
                // type='action' rejects a params property entirely
                delete method.params;
            }
        },

        // ----- Params -----
        addParam(ai, pi, mi) {
            const method = this.localProfile.adapters[ai].ports[pi].methods[mi];
            if (!Array.isArray(method.params)) method.params = [];
            method.params.push({ id: '', name: '', value: '' });
        },
        removeParam(ai, pi, mi, ppi) {
            this.localProfile.adapters[ai].ports[pi].methods[mi].params.splice(ppi, 1);
        },

        // ----- Scenes -----
        addScene() {
            if (!this.localProfile.scenes) this.localProfile.scenes = [];
            this.localProfile.scenes.push({ id: '', name: '', commands: [] });
        },
        removeScene(si) {
            this.localProfile.scenes.splice(si, 1);
            if (this.localProfile.scenes.length === 0) delete this.localProfile.scenes;
        },
        addSceneCommand(si) {
            this.localProfile.scenes[si].commands.push('');
        },
        removeSceneCommand(si, ci) {
            this.localProfile.scenes[si].commands.splice(ci, 1);
        },

        // ----- Styles -----
        addStyle() {
            if (!this.localProfile.styles) this.localProfile.styles = [];
            this.localProfile.styles.push('');
        },
        removeStyle(sti) {
            this.localProfile.styles.splice(sti, 1);
            if (this.localProfile.styles.length === 0) delete this.localProfile.styles;
        },
        // Apply a styles mutation: keep only entries that pass `keepPredicate`,
        // then optionally append `addEntry`. Cleans up an empty styles array.
        setStylesFiltered(keepPredicate, addEntry) {
            const styles = this.localProfile.styles || [];
            const next = styles.filter(keepPredicate);
            if (addEntry) next.push(addEntry);
            if (next.length === 0) {
                if (this.localProfile.styles) delete this.localProfile.styles;
            } else {
                this.localProfile.styles = next;
            }
        },

        // ----- main_method (styles-backed) -----
        getMainMethod(portId) {
            if (!portId) return null;
            const prefix = `${portId}.main_method=`;
            for (const s of this.localProfile.styles || []) {
                if (s.startsWith(prefix)) return s.slice(prefix.length);
            }
            return null;
        },
        setMainMethod(portId, methodId) {
            if (!portId) return;
            const prefix = `${portId}.main_method=`;
            this.setStylesFiltered(
                (s) => !s.startsWith(prefix),
                methodId ? `${portId}.main_method=${methodId}` : null
            );
        },
        toggleMainMethod(port, method) {
            if (!port.id || !method.id) return;
            const current = this.getMainMethod(port.id);
            this.setMainMethod(port.id, current === method.id ? null : method.id);
        },

        // ----- method invisible (styles-backed) -----
        isMethodInvisible(portId, methodId) {
            if (!portId || !methodId) return false;
            const target = `${portId}.${methodId}.invisible=true`;
            return (this.localProfile.styles || []).includes(target);
        },
        setMethodInvisible(port, method, invisible) {
            if (!port.id || !method.id) return;
            const prefix = `${port.id}.${method.id}.invisible=`;
            this.setStylesFiltered(
                (s) => !s.startsWith(prefix),
                invisible ? `${port.id}.${method.id}.invisible=true` : null
            );
            // Hiding a method shouldn't leave it dangling as the port's main
            // method — the renderer would surface it in the port header even
            // though the user marked it invisible. Clear the main-method
            // selection so the star toggle reads zero-selected too.
            if (invisible && this.getMainMethod(port.id) === method.id) {
                this.setMainMethod(port.id, null);
            }
        },

        // ----- icons (styles-backed) -----
        // `path` is the dot-segment chain identifying the target level:
        //   [portId]                       → port-level icon
        //   [portId, methodId]             → method-level icon
        //   [portId, methodId, paramId]    → param-level icon
        // If any segment is empty/falsy we treat the call as "incomplete" and
        // return blank / no-op so partially-filled rows don't write bad styles.
        iconStyleKey(path) {
            return path.join('.') + '.icon=';
        },
        getIcon(path) {
            if (!path.every(Boolean)) return '';
            const prefix = this.iconStyleKey(path);
            for (const s of this.localProfile.styles || []) {
                if (s.startsWith(prefix)) return s.slice(prefix.length);
            }
            return '';
        },
        setIcon(path, value) {
            if (!path.every(Boolean)) return;
            const prefix = this.iconStyleKey(path);
            this.setStylesFiltered(
                (s) => !s.startsWith(prefix),
                value ? `${prefix}${value}` : null
            );
        },

        // ----- Rules -----
        addRule() {
            if (!this.localProfile.rules) this.localProfile.rules = {};
            let i = 1;
            while (`event_${i}` in this.localProfile.rules) i++;
            // Seed with one empty command — schema requires `minItems: 1`,
            // so an event with no commands is invalid anyway.
            this.localProfile.rules[`event_${i}`] = [''];
        },
        removeRule(event) {
            delete this.localProfile.rules[event];
            if (Object.keys(this.localProfile.rules).length === 0) {
                delete this.localProfile.rules;
            }
        },
        renameRule(oldKey, newKey) {
            newKey = (newKey || '').trim();
            if (!newKey || newKey === oldKey) return;
            if (newKey in this.localProfile.rules) return;
            const next = {};
            for (const k of Object.keys(this.localProfile.rules)) {
                next[k === oldKey ? newKey : k] = this.localProfile.rules[k];
            }
            this.localProfile.rules = next;
        },
        addRuleCommand(event) {
            this.localProfile.rules[event].push('');
        },
        removeRuleCommand(event, ci) {
            this.localProfile.rules[event].splice(ci, 1);
        },

        // ----- Response filters -----
        addFilter() {
            if (!this.localProfile.response_filters) this.localProfile.response_filters = [];
            this.localProfile.response_filters.push({
                name: '',
                filter_regex: '',
                trigger_event: '',
            });
        },
        removeFilter(fi) {
            this.localProfile.response_filters.splice(fi, 1);
            if (this.localProfile.response_filters.length === 0) {
                delete this.localProfile.response_filters;
            }
        },
    },
};
</script>

<style lang="scss">
// Not `scoped` because the InfoRow and CommentRow helper components defined
// inline in this file use runtime-compiled string templates — their elements
// don't get this component's `data-v-…` attribute, so scoped selectors would
// miss them. Class names below are unique to the builder so nothing leaks
// to other components. The one bare `input, select` rule is manually scoped
// with `.builder-panel` to keep it from styling inputs in other views.
@use '@/styles/colors' as c;
@use '@/styles/buttons' as b;

.builder-panel {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    overflow: auto;
}

.builder-title-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
    position: sticky;
    top: -0.75rem;
    background: c.$background;
    margin: -0.75rem -0.75rem 0;
    padding: 0.5rem 0.75rem;
    z-index: 1;
}

.builder-actions {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.3rem;
}

.file-input-hidden {
    // OS file picker is triggered via the Open button; the input itself is
    // off-screen so it doesn't take up layout space or pick up focus rings.
    display: none;
}

.btn-icon {
    @include b.btn-shared;
    background: c.$primary;
    color: c.$text-light;
    border: none;
    border-radius: 4px;
    width: 32px;
    height: 32px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;

    .material-icons {
        font-size: 20px;
        line-height: 1;
    }

    &:hover:not(:disabled) {
        background: c.$accent;
    }

    &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
}

.cb-event-only {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.15rem;
    font-size: 0.85rem;
    color: c.$text-dark;
    cursor: pointer;
    user-select: none;
    padding: 0.25rem 0;

    input[type='checkbox'] {
        cursor: pointer;
    }

    .cb-event-only-row {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
    }

    .cb-event-only-hint {
        font-size: 0.75rem;
        font-style: italic;
        opacity: 0.65;
    }
}

// Below-method toggle row: star (main method) + eye (visibility). Lives on
// its own line under the busy top method row, indented to align under the
// method's input columns rather than under the row label.
.method-toggles {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.9rem;
}

.btn-method-toggle {
    @include b.btn-shared;
    flex: 0 0 auto;
    width: 22px;
    height: 22px;
    padding: 0;
    background: transparent;
    border: none;
    color: #b8bcc4;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;

    .material-icons {
        font-size: 18px;
    }

    &:disabled {
        cursor: not-allowed;
        opacity: 0.4;
    }
}

// Star: outlined gray when not main, filled gold when set. Faded out when
// the method is hidden (kept in flow with visibility:hidden so the eye stays
// in the same horizontal position regardless of state).
.btn-main-method {
    &:hover:not(:disabled) {
        color: #d9a700;
    }

    &.active {
        color: #f1b300;

        &:hover {
            color: #c89500;
        }
    }

    &.hidden {
        visibility: hidden;
    }
}

// Eye: open gray when visible, crossed firebrick when hidden. The "active"
// state is when the method has been marked invisible — the red signals "this
// won't show up in Zoom".
.btn-visibility {
    &:hover:not(:disabled) {
        color: c.$text-dark;
    }

    &.active {
        color: firebrick;

        &:hover {
            color: #a02020;
        }
    }
}

.icon-input {
    flex: 1 1 110px;
    min-width: 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace;
    font-size: 0.78rem;

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
}

.builder-empty {
    color: c.$text-dark;
    opacity: 0.6;
    font-style: italic;
    font-size: 0.9rem;
    padding: 1rem;
    text-align: center;
    border: 1px dashed c.$border;
    border-radius: 6px;
}

.builder-content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.section-title {
    font-size: 0.95rem;
    font-weight: 600;
    color: c.$text-dark;
    margin: 0.5rem 0 0.25rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.6;
}

.section-hint {
    font-size: 0.78rem;
    font-style: italic;
    color: c.$text-dark;
    opacity: 0.6;
    line-height: 1.4;
    margin: -0.1rem 0 0.3rem;
}

// ---- Cards ----
%card {
    background: #fff;
    border: 1px solid c.$border;
    border-radius: 8px;
    padding: 0.5rem 0.6rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
}

.info-card,
.adapter-card,
.scene-card,
.rule-card,
.filter-card {
    @extend %card;
}

.card-header,
.adapter-header,
.scene-header,
.rule-header,
.filter-header {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
}

// ---- Info ----
.info-fields {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
}

.kv-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.4rem;

    .kv-key-input {
        flex: 0 0 110px;
    }

    input {
        flex: 1 1 auto;
        min-width: 0;
    }

    &.kv-row-conflict .kv-key-input {
        border-color: #c03221;
        background: #fef2f2;
    }

    .kv-conflict {
        flex: 0 0 auto;
        font-size: 0.72rem;
        font-style: italic;
        color: #c03221;
        cursor: help;
    }
}

// ---- Adapter ----
.adapter-model-combo {
    position: relative;
    display: flex;
    flex: 0 0 auto;
    align-items: stretch;
}

.adapter-model {
    width: 11.5rem;
    border-radius: 3px 0 0 3px;
    border-right: none;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace;
    font-size: 0.82rem;
}

.model-chevron {
    background: #fff;
    border: 1px solid c.$border;
    border-radius: 0 3px 3px 0;
    cursor: pointer;
    padding: 0 0.45rem;
    font-size: 0.7rem;
    color: c.$text-dark;
    line-height: 1;

    &:hover {
        background: c.$zoom-button;
    }
}

.model-dropdown {
    position: absolute;
    top: calc(100% + 2px);
    left: 0;
    right: 0;
    z-index: 10;
    background: #fff;
    border: 1px solid c.$border;
    border-radius: 3px;
    list-style: none;
    margin: 0;
    padding: 2px 0;
    max-height: 200px;
    overflow-y: auto;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);

    li {
        padding: 0.25rem 0.5rem;
        cursor: pointer;
        font-size: 0.82rem;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace;
        color: c.$text-dark;

        &:hover {
            background: c.$zoom-button;
        }

        &.selected {
            background: c.$zoom-button;
            font-weight: 600;
        }
    }
}

.adapter-addr {
    flex: 1 1 140px;
    min-width: 0;
}
.adapter-uuid {
    flex: 1 1 140px;
    min-width: 0;
}

.ports-section {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-left: 1rem;
}

// ---- Port ----
.port-card {
    background: c.$zoom-button;
    border-radius: 6px;
    padding: 0.4rem 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
}

.port-header {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;

    .port-id,
    .port-name {
        flex: 1 1 80px;
        min-width: 0;
    }
    .port-position {
        flex: 0 0 60px;
    }
}

.port-hint {
    font-size: 0.78rem;
    font-style: italic;
    color: c.$text-dark;
    opacity: 0.7;
    margin-left: 1rem;
}

// ---- Settings ----
.settings-card {
    background: rgba(255, 255, 255, 0.6);
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 4px;
    padding: 0.3rem 0.4rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
}

.settings-grid {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 0.3rem;

    label {
        display: flex;
        flex-direction: column;
        font-size: 0.7rem;
        opacity: 0.65;
        gap: 2px;

        select {
            font-size: 0.8rem;
        }
    }
}

// ---- Methods ----
.methods-section {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    margin-left: 1rem;
}

.method-card {
    background: #fff;
    border: 1px solid c.$border;
    border-radius: 4px;
    padding: 0.3rem 0.4rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;

    // Hidden methods read as "ghost" rows — same footprint, dashed border so
    // it's visible in the GUI builder that this one won't render in Zoom.
    // border-style swap doesn't change the box width, so no layout shift.
    &.method-hidden {
        border-style: dashed;
    }

    // Main method gets a gold inner ring (matches the gold star toggle) layered
    // on top of the existing 1px border, creating a "doubled" border effect
    // without changing the actual border width — toggling on/off doesn't
    // reflow surrounding content. Box-shadow rather than outline so this can
    // coexist with the required-field cascade outline.
    &.method-main {
        box-shadow: inset 0 0 0 2px rgba(241, 179, 0, 0.55);
    }
}

.method-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.3rem;
    flex-wrap: wrap;

    .method-id {
        flex: 1 1 80px;
        min-width: 0;
    }
    .method-name {
        flex: 1 1 90px;
        min-width: 0;
    }
    .method-cmd {
        flex: 1 1 140px;
        min-width: 0;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace;
        font-size: 0.8rem;
    }
}

// ---- Params ----
.params-section {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-left: 1rem;
}

.param-card {
    background: rgba(0, 0, 0, 0.02);
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 3px;
    padding: 0.25rem 0.35rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
}

.param-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.25rem;
    flex-wrap: wrap;

    .param-id {
        flex: 1 1 70px;
        min-width: 0;
    }
    .param-name {
        flex: 1 1 80px;
        min-width: 0;
    }
    .param-value {
        flex: 1 1 100px;
        min-width: 0;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace;
        font-size: 0.8rem;
    }
}

// ---- Scenes / commands ----
.scene-id,
.scene-name {
    flex: 1 1 80px;
    min-width: 0;
}
.scene-icon {
    flex: 1 1 110px;
    min-width: 0;
}

.commands-section {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    margin-left: 1rem;
}

.command-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.3rem;

    .command-ref {
        flex: 1 1 auto;
        min-width: 0;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace;
        font-size: 0.8rem;
    }
}

// ---- Styles ----
.style-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.3rem;

    .style-text {
        flex: 1 1 auto;
        min-width: 0;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace;
        font-size: 0.8rem;
    }
}

// ---- Rules ----
.rule-event {
    flex: 1 1 auto;
    min-width: 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace;
    font-size: 0.85rem;
}

// ---- Filters ----
.filter-name {
    flex: 1 1 auto;
    min-width: 0;
}

.filter-fields {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
}

// ---- Comment row ----
.comment-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.3rem;

    .comment-input {
        flex: 1 1 auto;
        min-width: 0;
        font-size: 0.8rem;
        font-style: italic;
        color: c.$text-dark;
    }
}

.btn-comment {
    @include b.btn-shared;
    background: transparent;
    border: 1px dashed c.$border;
    color: c.$text-dark;
    border-radius: 3px;
    padding: 0.1rem 0.5rem;
    font-size: 0.72rem;
    line-height: 1.3;
    align-self: flex-start;
    opacity: 0.55;

    &:hover {
        opacity: 1;
        background: rgba(0, 0, 0, 0.03);
    }
}

// ---- Shared labels and form controls ----
.row-label {
    font-size: 0.7rem;
    font-weight: 600;
    color: c.$text-dark;
    opacity: 0.55;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    flex: 0 0 auto;

    &.small {
        font-size: 0.65rem;
    }
}

.builder-panel input,
.builder-panel select {
    font-size: 0.85rem;
    padding: 0.25rem 0.4rem;
    border: 1px solid c.$border;
    border-radius: 3px;
    background: #fff;
    color: c.$text-dark;
    font-family: inherit;
}

.builder-panel input:focus,
.builder-panel select:focus {
    outline: 1px solid c.$accent;
    outline-offset: 0;
}

// Empty required inputs — soft red tint so the user can see what still needs
// filling at a glance. Drops back to normal as soon as a value is typed
// (validity is recomputed by the browser on every input event).
.builder-panel input:required:invalid {
    border-color: #d97777;
    background: #fff5f5;
}
.builder-panel input:required:invalid:focus {
    outline-color: #d97777;
}

// Cascade the invalid-input hint up through every wrapping container so a
// user scanning the builder can spot "there's a problem somewhere inside
// this card" at a glance and follow the dashed-red trail inward to the leaf
// that's actually empty. The leaf input keeps its solid pale-red treatment;
// only the ancestors switch to a dashed accent so the two reads as a chain,
// not duplicate flags. Pure CSS via `:has()` — no JS state to keep in sync.
// Uses `outline` (not `border`) so cards without a baseline border (port-card,
// style-row) don't reflow when the indicator turns on; outline-offset: -1px
// tucks the dashes flush against the card edge.
.builder-panel {
    .adapter-card:has(input:required:invalid),
    .port-card:has(input:required:invalid),
    .method-card:has(input:required:invalid),
    .param-card:has(input:required:invalid),
    .scene-card:has(input:required:invalid),
    .filter-card:has(input:required:invalid),
    .rule-card:has(input:required:invalid),
    .style-row:has(input:required:invalid) {
        outline: 1px dashed #d97777;
        outline-offset: -1px;
    }
}

.btn-add {
    @include b.btn-shared;
    background: transparent;
    border: 1px dashed c.$border;
    color: c.$text-dark;
    border-radius: 4px;
    padding: 0.2rem 0.6rem;
    font-size: 0.78rem;
    line-height: 1.4;
    align-self: flex-start;
    opacity: 0.7;

    &:hover {
        opacity: 1;
        background: rgba(0, 0, 0, 0.03);
    }
}

.btn-add-section {
    align-self: flex-start;
    font-size: 0.85rem;
    padding: 0.3rem 0.8rem;
    opacity: 0.9;
}

.btn-delete {
    @include b.btn-shared;
    background: transparent;
    border: none;
    color: c.$text-dark;
    opacity: 0.45;
    font-size: 1.1rem;
    line-height: 1;
    width: 22px;
    height: 22px;
    padding: 0;
    border-radius: 4px;
    flex: 0 0 auto;

    &:hover {
        opacity: 1;
        background: rgba(0, 0, 0, 0.06);
    }
}
</style>
