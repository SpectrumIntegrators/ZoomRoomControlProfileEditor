<template>
    <section class="builder-panel">
        <header class="builder-title-row">
            <h2 class="builder-title">Builder</h2>
            <label
                v-if="profile !== null"
                class="cb-event-only">
                <input
                    type="checkbox"
                    v-model="eventOnly" />
                Events only
            </label>
            <button
                class="btn-new"
                @click="newProfile">
                New
            </button>
        </header>

        <div
            v-if="profile === null"
            class="builder-empty">
            JSON parsing failed. Fix the JSON to enable the builder.
        </div>

        <div
            v-else
            class="builder-content">
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
                <div class="info-fields">
                    <div
                        v-for="key in INFO_KEYS"
                        :key="key"
                        class="kv-row">
                        <label class="kv-key">{{ key }}</label>
                        <input
                            type="text"
                            v-model="localProfile.info[key]"
                            :placeholder="key" />
                    </div>
                    <div
                        v-for="key in customInfoKeys"
                        :key="'custom-' + key"
                        class="kv-row">
                        <input
                            type="text"
                            class="kv-key-input"
                            :value="key"
                            placeholder="key"
                            @change="renameInfoKey(key, $event.target.value)" />
                        <input
                            type="text"
                            v-model="localProfile.info[key]"
                            placeholder="value" />
                        <button
                            class="btn-delete"
                            title="Remove item"
                            @click="removeInfoKey(key)">
                            ×
                        </button>
                    </div>
                </div>
                <button
                    class="btn-add"
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
                @click="addInfo">
                + Info
            </button>

            <!-- ============== ADAPTERS ============== -->
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
                        v-model="adapter.ip" />
                    <input
                        v-else
                        type="text"
                        class="adapter-addr"
                        placeholder="COM3"
                        v-model="adapter.com" />
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
                                class="method-card">
                                <div class="method-row">
                                    <input
                                        type="radio"
                                        class="cb-main-method"
                                        :name="`main-${ai}-${pi}`"
                                        :checked="getMainMethod(port.id) === method.id"
                                        :disabled="!port.id || !method.id"
                                        title="Set as main method"
                                        @click="toggleMainMethod(port, method)" />
                                    <span class="row-label">Method</span>
                                    <input
                                        type="text"
                                        class="method-id"
                                        placeholder="id"
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
                                    <label class="cb-invisible">
                                        <input
                                            type="checkbox"
                                            :checked="isMethodInvisible(port.id, method.id)"
                                            :disabled="!port.id || !method.id"
                                            @change="setMethodInvisible(port, method, $event.target.checked)" />
                                        invisible
                                    </label>
                                    <button
                                        class="btn-delete"
                                        title="Remove method"
                                        @click="removeMethod(ai, pi, mi)">
                                        ×
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
                                        @click="addParam(ai, pi, mi)">
                                        + Param
                                    </button>
                                </div>
                            </div>
                            <button
                                class="btn-add"
                                @click="addMethod(ai, pi)">
                                + Method
                            </button>
                        </div>
                    </div>
                    <button
                        class="btn-add"
                        @click="addPort(ai)">
                        + Port
                    </button>
                </div>
            </div>
            <button
                class="btn-add btn-add-section"
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
                        v-model="scene.id" />
                    <input
                        type="text"
                        class="scene-name"
                        placeholder="name"
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
                        @click="addSceneCommand(si)">
                        + Command
                    </button>
                </div>
            </div>
            <button
                class="btn-add btn-add-section"
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
                        @click="addRuleCommand(event)">
                        + Command
                    </button>
                </div>
            </div>
            <button
                class="btn-add btn-add-section"
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
                            placeholder="filter_regex" />
                    </label>
                    <label class="kv-row">
                        <span class="kv-key">trigger</span>
                        <input
                            type="text"
                            v-model="filter.trigger_event"
                            placeholder="trigger_event (rule key)" />
                    </label>
                </div>
                <CommentRow
                    :owner="filter"
                    @add="addComment(filter)"
                    @remove="removeComment(filter)" />
            </div>
            <button
                class="btn-add btn-add-section"
                @click="addFilter">
                + Filter
            </button>
        </div>
    </section>
</template>

<script>
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
        <button v-else class="btn-comment" @click="$emit('add')">+ Comment</button>
    `,
    computed: {
        hasComment() {
            return Object.prototype.hasOwnProperty.call(this.owner, '$comment');
        },
    },
};

const SCHEMA_URL =
    'https://cdn.jsdelivr.net/gh/SpectrumIntegrators/PublicSchemas@main/ZoomRoomsControlProfile/v1/zrcs-profile.schema.json';

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

export default {
    name: 'BuilderPanel',
    components: { CommentRow },
    props: {
        profile: {
            type: Object,
            default: null,
        },
    },
    emits: ['update:profile'],
    data() {
        return {
            localProfile: deepClone(this.profile || {}),
            syncingFromProp: false,
            // -1 when no model picker is open; otherwise the adapter index
            // whose dropdown is currently expanded. Tracked at the component
            // level rather than per-adapter so opening one closes the others.
            openModelDropdownIndex: -1,
            ADAPTER_MODELS,
            INFO_KEYS,
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
        customInfoKeys() {
            if (!this.localProfile.info) return [];
            return Object.keys(this.localProfile.info).filter(
                (k) => !INFO_KEYS.includes(k) && k !== '$comment'
            );
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
                this.$nextTick(() => {
                    this.syncingFromProp = false;
                });
            },
        },
        localProfile: {
            deep: true,
            handler() {
                if (this.syncingFromProp) return;
                if (this.profile === null) return;
                this.$emit('update:profile', deepClone(this.localProfile));
            },
        },
    },
    methods: {
        ipPlaceholder(model) {
            return model === 'GenericNetworkAdapter'
                ? 'tcp://192.168.1.50:5000'
                : '192.168.1.10';
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
            this.localProfile = {
                $schema: SCHEMA_URL,
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
        },

        // ----- Info -----
        addInfo() {
            if (this.localProfile.info) return;
            this.localProfile.info = {};
        },
        removeInfo() {
            delete this.localProfile.info;
        },
        addInfoItem() {
            if (!this.localProfile.info) this.localProfile.info = {};
            let i = 1;
            while (`custom${i}` in this.localProfile.info) i++;
            this.localProfile.info[`custom${i}`] = '';
        },
        renameInfoKey(oldKey, newKey) {
            newKey = (newKey || '').trim();
            if (!newKey || newKey === oldKey) return;
            if (newKey in this.localProfile.info) return;
            // Rebuild the object so the renamed key stays in its original slot
            // rather than getting reinserted at the end.
            const next = {};
            for (const k of Object.keys(this.localProfile.info)) {
                next[k === oldKey ? newKey : k] = this.localProfile.info[k];
            }
            this.localProfile.info = next;
        },
        removeInfoKey(key) {
            delete this.localProfile.info[key];
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
            this.localProfile.rules[`event_${i}`] = [];
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

<style lang="scss" scoped>
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
    padding: 0.75rem 0.75rem 0.5rem;
    z-index: 1;
}

.builder-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: c.$text-dark;
    margin: 0;
}

.btn-new {
    @include b.btn-shared;
    background: c.$primary;
    color: c.$text-light;
    border: none;
    padding: 0.3rem 0.8rem;
    border-radius: 4px;
    font-size: 0.85rem;

    &:hover {
        background: c.$accent;
    }
}

.cb-event-only {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.8rem;
    color: c.$text-dark;
    opacity: 0.85;
    cursor: pointer;
    user-select: none;
    margin-left: auto;

    input[type='checkbox'] {
        cursor: pointer;
    }
}

.cb-main-method {
    flex: 0 0 auto;
    cursor: pointer;

    &:disabled {
        cursor: not-allowed;
        opacity: 0.4;
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

.cb-invisible {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.72rem;
    color: c.$text-dark;
    opacity: 0.75;
    cursor: pointer;
    user-select: none;
    flex: 0 0 auto;

    input[type='checkbox'] {
        cursor: pointer;
        margin: 0;
    }

    &:has(input:disabled) {
        opacity: 0.4;
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

    .kv-key {
        font-size: 0.78rem;
        font-weight: 500;
        color: c.$text-dark;
        opacity: 0.7;
        flex: 0 0 90px;
    }

    .kv-key-input {
        flex: 0 0 110px;
    }

    input {
        flex: 1 1 auto;
        min-width: 0;
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
:deep(.comment-row) {
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

:deep(.btn-comment) {
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

input,
select {
    font-size: 0.85rem;
    padding: 0.25rem 0.4rem;
    border: 1px solid c.$border;
    border-radius: 3px;
    background: #fff;
    color: c.$text-dark;
    font-family: inherit;
}

input:focus,
select:focus {
    outline: 1px solid c.$accent;
    outline-offset: 0;
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
