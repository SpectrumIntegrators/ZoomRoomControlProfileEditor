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
                <button
                    class="btn-icon"
                    :disabled="!canScreenshot || screenshotBusy"
                    :title="screenshotTitle"
                    @click="$emit('screenshot')">
                    <span class="material-icons">photo_camera</span>
                </button>
                <button
                    class="btn-icon btn-icon-help"
                    title="About & Editing tips"
                    @click="helpVisible = true">
                    <span class="material-icons">help_outline</span>
                </button>
            </div>
            <span
                v-if="screenshotBusy"
                class="builder-status"
                aria-live="polite">
                <span class="material-icons spin">progress_activity</span>
                Saving screenshot…
            </span>
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
                class="adapter-card"
                :class="{ 'has-validation-error': errorTargets.adapters.has(String(ai)) }">
                <div class="adapter-header">
                    <span class="row-label">Adapter</span>
                    <div class="adapter-model-combo">
                        <input
                            type="text"
                            v-model="adapter.model"
                            class="adapter-model"
                            :class="{ 'has-validation-error': errorTargets.adapterFields.has(ai + '#model') }"
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
                        :class="{ 'has-validation-error': errorTargets.adapterFields.has(ai + '#ip') }"
                        :placeholder="ipPlaceholder(adapter.model)"
                        v-model="adapter.ip"
                        :required="!adapter.uuid" />
                    <input
                        v-else
                        type="text"
                        class="adapter-addr"
                        :class="{ 'has-validation-error': errorTargets.adapterFields.has(ai + '#com') }"
                        placeholder="com port"
                        v-model="adapter.com"
                        required />
                    <input
                        v-if="adapter.model === 'iTachIP2SL' || adapter.model === 'iTachIP2CC'"
                        type="text"
                        class="adapter-uuid"
                        :class="{ 'has-validation-error': errorTargets.adapterFields.has(ai + '#uuid') }"
                        placeholder="GlobalCache_<MAC> (optional)"
                        title="iTach beacon UUID, e.g. GlobalCache_000C1E051AEE. Optional — Zoom doesn't use it, but recording it makes the profile self-documenting."
                        pattern="^GlobalCache_[0-9A-Fa-f]{12}$"
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
                        class="port-card"
                        :class="{ 'has-validation-error': errorTargets.ports.has(ai + ':' + (port.id || '#' + pi)) }">
                        <div class="port-header">
                            <span class="row-label">Port</span>
                            <input
                                type="text"
                                class="port-id"
                                placeholder="id"
                                required
                                v-model="port.id"
                                @focus="onIdFocus(port, 'id')"
                                @change="onPortIdCommit(port)" />
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
                                @input="setIcon([port.id], $event.target.value)"
                                @focus="iconFocusTracker.set($event.target)" />
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
                                <label :class="{ 'has-validation-error': settingHasError(ai, port, pi, 'baud_rate') }">baud
                                    <select :value="port.settings?.baud_rate"
                                            @change="ensurePortSettings(port, 'iTachIP2SL'); port.settings.baud_rate = $event.target.value">
                                        <option v-for="b in ITACH_BAUD" :key="b" :value="b">{{ b }}</option>
                                    </select>
                                </label>
                                <label :class="{ 'has-validation-error': settingHasError(ai, port, pi, 'flow_control') }">flow
                                    <select :value="port.settings?.flow_control"
                                            @change="ensurePortSettings(port, 'iTachIP2SL'); port.settings.flow_control = $event.target.value">
                                        <option v-for="f in ITACH_FLOW" :key="f.value" :value="f.value">{{ f.label }}</option>
                                    </select>
                                </label>
                                <label :class="{ 'has-validation-error': settingHasError(ai, port, pi, 'parity') }">parity
                                    <select :value="port.settings?.parity"
                                            @change="ensurePortSettings(port, 'iTachIP2SL'); port.settings.parity = $event.target.value">
                                        <option v-for="p in ITACH_PARITY" :key="p.value" :value="p.value">{{ p.label }}</option>
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
                                <label :class="{ 'has-validation-error': settingHasError(ai, port, pi, 'baud_rate') }">baud
                                    <select :value="port.settings?.baud_rate"
                                            @change="ensurePortSettings(port, 'USB2Serial'); port.settings.baud_rate = Number($event.target.value)">
                                        <option v-for="b in USB_BAUD" :key="b" :value="b">{{ b }}</option>
                                    </select>
                                </label>
                                <label :class="{ 'has-validation-error': settingHasError(ai, port, pi, 'data_bits') }">data
                                    <select :value="port.settings?.data_bits"
                                            @change="ensurePortSettings(port, 'USB2Serial'); port.settings.data_bits = Number($event.target.value)">
                                        <option v-for="d in USB_DATA_BITS" :key="d" :value="d">{{ d }}</option>
                                    </select>
                                </label>
                                <label :class="{ 'has-validation-error': settingHasError(ai, port, pi, 'parity') }">parity
                                    <select :value="port.settings?.parity"
                                            @change="ensurePortSettings(port, 'USB2Serial'); port.settings.parity = Number($event.target.value)">
                                        <option v-for="(label, i) in USB_PARITY_LABELS" :key="i" :value="i">{{ label }}</option>
                                    </select>
                                </label>
                                <label :class="{ 'has-validation-error': settingHasError(ai, port, pi, 'stop_bits') }">stop
                                    <select :value="port.settings?.stop_bits"
                                            @change="ensurePortSettings(port, 'USB2Serial'); port.settings.stop_bits = Number($event.target.value)">
                                        <option v-for="(label, i) in USB_STOP_BITS_LABELS" :key="i" :value="USB_STOP_BITS[i]">{{ label }}</option>
                                    </select>
                                </label>
                                <label :class="{ 'has-validation-error': settingHasError(ai, port, pi, 'flow_control') }">flow
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
                                    'has-validation-error': errorTargets.methods.has(ai + ':' + (port.id || '#' + pi) + '#' + mi),
                                }">
                                <div class="method-row">
                                    <span class="row-label">Method</span>
                                    <input
                                        type="text"
                                        class="method-id"
                                        placeholder="id"
                                        required
                                        v-model="method.id"
                                        @focus="onIdFocus(method, 'id', { portId: port.id })"
                                        @change="onMethodIdCommit(port, method)" />
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
                                        @input="setIcon([port.id, method.id], $event.target.value)"
                                        @focus="iconFocusTracker.set($event.target)" />
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
                                        class="param-card"
                                        :class="{
                                            'has-validation-error':
                                                errorTargets.params.has(ai + ':' + (port.id || '#' + pi) + '#' + mi + '#' + ppi),
                                        }">
                                        <div class="param-row">
                                            <span class="row-label">Param</span>
                                            <input
                                                type="text"
                                                class="param-id"
                                                placeholder="id"
                                                required
                                                v-model="param.id"
                                                @focus="onIdFocus(param, 'id', { portId: port.id, methodId: method.id })"
                                                @change="onParamIdCommit(port, method, param)" />
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
                                                @input="setIcon([port.id, method.id, param.id], $event.target.value)"
                                                @focus="iconFocusTracker.set($event.target)" />
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
                        v-model="scene.icon"
                        @focus="iconFocusTracker.set($event.target)" />
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
                    <div class="rule-event-combo">
                        <input
                            type="text"
                            class="rule-event"
                            :class="{ 'has-validation-error': hasRuleEventConflict(event) }"
                            :value="ruleEventDisplay(event)"
                            placeholder="event_name (e.g. zr_meeting_started)"
                            required
                            :title="hasRuleEventConflict(event)
                                ? `Another rule already has the key '${ruleEventDisplay(event)}'. Remove that rule (or change this one) to commit the rename.`
                                : ruleEventTooltip(ruleEventDisplay(event))"
                            @input="setRuleEventDraft(event, $event.target.value)"
                            @change="commitRuleEvent(event)" />
                        <button
                            type="button"
                            class="model-chevron"
                            :aria-expanded="openRuleEventDropdownIndex === ri"
                            title="Pick from known Zoom Room events"
                            @click.stop="toggleRuleEventDropdown(ri)">
                            ▾
                        </button>
                        <ul
                            v-if="openRuleEventDropdownIndex === ri"
                            class="rule-event-dropdown"
                            @click.stop>
                            <template
                                v-for="bucket in BUILTIN_EVENTS_BY_CATEGORY"
                                :key="bucket.category">
                                <li class="dropdown-category">{{ bucket.category }}</li>
                                <li
                                    v-for="ev in bucket.events"
                                    :key="ev.id"
                                    :class="{ selected: ruleEventDisplay(event) === ev.id }"
                                    :title="ev.note || ''"
                                    @click="selectRuleEvent(event, ev.id)">
                                    <span class="event-label">{{ ev.label }}</span>
                                    <span class="event-id">{{ ev.id }}</span>
                                </li>
                            </template>
                        </ul>
                    </div>
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
            <p
                v-if="Array.isArray(localProfile.response_filters) && localProfile.response_filters.length > 0"
                class="section-hint">
                Type the regex as you'd write it in JavaScript / std::regex (e.g.
                <code>[\s\S]*Login:</code>) — the editor handles JSON
                double-escaping for you. Real control characters in your input
                show as <code>\r</code> / <code>\n</code> / <code>\t</code> for
                visibility.
            </p>
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
                            :value="displayRegex(filter.filter_regex)"
                            @input="filter.filter_regex = $event.target.value"
                            placeholder="filter_regex"
                            title="Control characters (CR / LF / TAB) are shown as \r \n \t escape sequences for visibility — the regex engine treats them the same as the raw bytes."
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

        <!-- Editing tips popup. Modal-style: click the backdrop OR the close
             button OR press Escape to dismiss. Lives at the bottom of the
             builder so its stacking context covers the whole panel. -->
        <div
            v-if="helpVisible"
            class="help-backdrop"
            @click.self="helpVisible = false"
            @keydown.esc="helpVisible = false"
            tabindex="-1"
            ref="helpBackdrop">
            <div class="help-card" role="dialog" aria-label="Editing tips and confirmed behavior">
                <header class="help-card-header">
                    <div class="help-tabs" role="tablist">
                        <button
                            type="button"
                            role="tab"
                            class="help-tab"
                            :class="{ active: helpActiveTab === 'tips' }"
                            :aria-selected="helpActiveTab === 'tips'"
                            @click="helpActiveTab = 'tips'">
                            Editing Tips
                        </button>
                        <button
                            type="button"
                            role="tab"
                            class="help-tab"
                            :class="{ active: helpActiveTab === 'quirks' }"
                            :aria-selected="helpActiveTab === 'quirks'"
                            @click="helpActiveTab = 'quirks'">
                            Undocumented but Confirmed Behavior
                        </button>
                        <button
                            type="button"
                            role="tab"
                            class="help-tab"
                            :class="{ active: helpActiveTab === 'about' }"
                            :aria-selected="helpActiveTab === 'about'"
                            @click="helpActiveTab = 'about'">
                            About
                        </button>
                    </div>
                    <button
                        class="help-close"
                        title="Close"
                        @click="helpVisible = false">
                        <span class="material-icons">close</span>
                    </button>
                </header>
                <div
                    v-if="helpActiveTab === 'tips'"
                    class="help-card-body"
                    role="tabpanel">
                    <section>
                        <h3>Backslashes and JSON</h3>
                        <p>
                            In the actual JSON file, escape sequences like
                            <code>\xFF</code> have to be written with two
                            backslashes (<code>\\xFF</code>) for the JSON
                            parser. This gets messy fast, especially with
                            filter regexes. This editor handles the
                            double-escaping for you, so in every
                            <code>command</code>, <code>value</code>, and
                            <code>filter_regex</code> field you can just use
                            a single backslash as normal.
                        </p>
                    </section>
                    <section>
                        <h3>Command strings (port → device)</h3>
                        <p>
                            A method's <code>command</code> is the raw bytes
                            sent on the wire. Use <code>\r</code>,
                            <code>\n</code>, <code>\t</code> for control
                            characters and <code>\xNN</code> for any
                            arbitrary byte (<code>\xFF</code>,
                            <code>\x02</code>, etc.). Zoom decodes these at
                            send time; the byte that hits the device is the
                            single character each escape represents.
                        </p>
                        <p>
                            For methods with <code>type: "actions"</code>,
                            <code>%</code> in the command string is replaced
                            with the matched param's <code>value</code> at
                            send time. Add a <code>params</code> array and
                            use <code>%</code> as the placeholder. If it's
                            <code>type: "action"</code> (singular), the
                            <code>%</code> is just sent as a literal percent
                            character.
                        </p>
                    </section>
                    <section>
                        <h3>Regex flavor for response filters</h3>
                        <p>
                            Zoom uses MSVC <code>std::regex</code> with the
                            ECMAScript flavor — equivalent to JavaScript's
                            <code>RegExp</code>. To test patterns externally,
                            use
                            <a href="https://regex101.com" target="_blank" rel="noopener noreferrer">regex101.com</a>
                            with <strong>"JavaScript" flavor selected</strong>.
                            Don't tick the <code>s</code> (dotAll) flag — it
                            postdates Zoom's regex engine. Use
                            <code>[\s\S]</code> when you would need
                            <code>.</code> to also match newlines.
                        </p>
                        <p>
                            <strong>Whole-input match.</strong> Zoom uses
                            <code>regex_match</code>, not
                            <code>regex_search</code> — the entire received
                            buffer has to match your pattern, not just
                            contain it. To match a string anywhere inside a
                            larger reply, wrap your pattern with
                            <code>[\s\S]*</code> on both sides. For example,
                            looking for a login prompt: use
                            <code>[\s\S]*Login:[\s\S]*</code>, not just
                            <code>Login:</code>.
                        </p>
                        <p>
                            Captured groups don't pass through to rule
                            handlers — filters fire by name only. Use the
                            response-injection panel (in the activity log
                            drawer) to test patterns against simulated
                            device replies.
                        </p>
                        <p>
                            <strong>ASCII-only.</strong> Zoom's receive
                            pipeline runs incoming bytes through a UTF-8
                            decoder before the regex sees them, so bytes
                            <code>0x80</code>–<code>0xFF</code> are dropped
                            (lone continuation bytes are invalid UTF-8) and
                            never reach the matcher. Patterns like
                            <code>\xAA</code> or <code>\xFF</code> won't
                            fire against real device output. If the device
                            sends raw binary, match on a nearby ASCII
                            status code instead.
                        </p>
                    </section>
                    <section>
                        <h3>Comments</h3>
                        <p>
                            The <code>$comment</code> field on any block
                            (info, adapter, port, method, param, scene, rule,
                            filter) is ignored by Zoom and by schema
                            validation. Free-form notes for whoever opens
                            the profile next. Add one with the
                            <code>+ Comment</code> button on any item.
                        </p>
                    </section>
                </div>
                <div
                    v-else-if="helpActiveTab === 'quirks'"
                    class="help-card-body"
                    role="tabpanel">
                    <p class="help-quirks-intro">
                        These are behaviors Zoom Rooms enforces (or exhibits)
                        at profile-load and run time that aren't expressible
                        in the JSON Schema. The validator catches the ones it
                        can so you don't find out in a customer's room with
                        them standing there.
                    </p>
                    <ul class="help-quirks">
                        <li>
                            <strong>Response filters don't work on USB2Serial
                            adapters.</strong> Zoom rejects profiles where a
                            <code>port.response_filter</code> is set on a
                            USB2Serial port.
                        </li>
                        <li>
                            <strong><code>response_filter.trigger_event</code>
                            cannot shadow a built-in <code>zr_*</code>
                            event.</strong> Zoom rejects profiles where a
                            custom filter trigger collides with one of the
                            built-in event names (see
                            <code>doc/zoom_events.csv</code> in the repo).
                        </li>
                        <li>
                            <strong><code>response_filter.trigger_event</code>
                            must reference a rule that exists.</strong> A
                            filter pointing at an undefined rule key is
                            rejected.
                        </li>
                        <li>
                            <strong>Rule and scene command arrays must not
                            be empty.</strong> If a rule's commands or a
                            scene's commands list is <code>[]</code>, Zoom
                            rejects the profile at parse time. The builder catches
                            this before the JSON ever reaches Zoom.
                        </li>
                        <li>
                            <strong>Port ids should be unique across all
                            adapters.</strong> The validator flags duplicates at
                            edit time.
                        </li>
                        <li>
                            <strong>Rule keys are case-sensitive.</strong>
                            <code>meeting_started</code> and
                            <code>Meeting_started</code> are different
                            rules. The schema's pattern check enforces this
                            in both directions, but it's worth knowing.
                        </li>
                        <li>
                            <strong>Response filters dispatch all-match, not
                            first-match.</strong> When data arrives on a
                            port, Zoom evaluates <em>every</em> filter
                            assigned to that port and fires the
                            <code>trigger_event</code> of every one whose
                            regex matches.
                        </li>
                        <li>
                            <strong>The pattern must match the <em>entire</em> received
                            buffer</strong>. Wrap patterns with
                            <code>[\s\S]*</code> on both sides to absorb
                            surrounding content (e.g.
                            <code>[\s\S]*Login:[\s\S]*</code>).
                        </li>
                        <li>
                            <strong>Response filter matching is per-chunk,
                            not per-line.</strong> Each receive callback
                            regexes whatever was delivered. If a device
                            fragments its reply across TCP packets, each
                            fragment is matched independently — a regex
                            that needs to see the full reply will be
                            unreliable on slow / chatty connections.
                        </li>
                        <li>
                            <strong>Response filter regex flavor is MSVC
                            <code>std::regex</code> ECMAScript.</strong>
                            JavaScript's <code>RegExp</code> implements the
                            same dialect, so the simulator and Zoom match
                            identically for practical ASCII patterns.
                        </li>
                        <li>
                            <strong>Response filter matching is ASCII-only
                            in practice.</strong> Bytes from `0x80` to `0xff`
                            cannot be used in the filter regex.
                            Match on printable status codes instead. If
                            the protocol is purely binary, response
                            filters are not the right tool.
                        </li>
                    </ul>
                </div>
                <div
                    v-else-if="helpActiveTab === 'about'"
                    class="help-card-body"
                    role="tabpanel">
                    <section>
                        <h3>Zoom Room Control Profile Editor</h3>
                        <p>
                            Built by <a href="https://github.com/ke4ukz" target="_blank" rel="noopener noreferrer">Jonathan Dean</a> at 
                            <a href="https://spectrumintegrators.com" target="_blank" rel="noopener noreferrer">Spectrum Integrators</a>
                            for the AV / Zoom Rooms community.
                            Free, open-source, no analytics, no signup. Profile
                            data stays in your browser unless you click
                            <strong>Download</strong>.
                        </p>
                        <p>
                            Source on
                            <a href="https://github.com/SpectrumIntegrators/ZoomRoomControlProfileEditor"
                                target="_blank"
                                rel="noopener noreferrer">GitHub</a>.
                            File an issue or open a PR if you find a bug or
                            want to suggest something.
                        </p>
                    </section>
                    <section class="help-disclaimer">
                        <h3>Disclaimer</h3>
                        <p>
                            This tool is published as-is for convenience.
                            Profiles you generate are <strong>not
                            guaranteed</strong> to load successfully on any
                            given Zoom Room, work with any specific device,
                            or behave correctly in production — Zoom's
                            behavior can and does change between releases,
                            our validator catches what it can but isn't
                            exhaustive, and your hardware may simply not
                            cooperate. Test on a non-production room before
                            deploying to a customer site.
                        </p>
                        <p>
                            No warranty is given, express or implied.
                            Spectrum Integrators accepts no liability for
                            any damages, loss of business, downtime, or
                            other consequences arising from use of this
                            tool or of the profiles it produces. We're
                            not affiliated with, endorsed by, or
                            sponsored by Zoom Communications, Inc.
                        </p>
                    </section>
                    <section>
                        <h3>Attribution</h3>
                        <p>
                            This project is a fork of
                            <a href="https://github.com/jeffderek/zoom-native-room-controls-preview"
                                target="_blank"
                                rel="noopener noreferrer"><code>zoom-native-room-controls-preview</code></a>
                            by
                            <a href="https://www.jeffmcaleer.com"
                                target="_blank"
                                rel="noopener noreferrer">Jeff McAleer</a>,
                            used under the MIT License. The majority of
                            the Zoom controls preview itself is inherited
                            from the original project. 
                        </p>
                    </section>
                    <section>
                        <h3>Built with</h3>
                        <p>
                            Open-source libraries that make this work, all
                            MIT-licensed unless noted:
                        </p>
                        <ul>
                            <li>
                                <a href="https://vuejs.org" target="_blank" rel="noopener noreferrer">Vue 3</a>
                                — UI framework
                            </li>
                            <li>
                                <a href="https://vitejs.dev" target="_blank" rel="noopener noreferrer">Vite</a>
                                — build system; with
                                <a href="https://sass-lang.com" target="_blank" rel="noopener noreferrer">Sass</a>
                                for styling
                            </li>
                            <li>
                                <a href="https://ajv.js.org" target="_blank" rel="noopener noreferrer">AJV</a>
                                — JSON Schema validator
                            </li>
                            <li>
                                <a href="https://codemirror.net" target="_blank" rel="noopener noreferrer">CodeMirror 6</a>
                                via
                                <a href="https://github.com/surmon-china/vue-codemirror"
                                    target="_blank"
                                    rel="noopener noreferrer">vue-codemirror</a>,
                                <code>@codemirror/lang-json</code>, and
                                <a href="https://github.com/sanity-io/codemirror-json-schema"
                                    target="_blank"
                                    rel="noopener noreferrer">codemirror-json-schema</a>
                                — JSON editor with schema autocomplete
                            </li>
                            <li>
                                <a href="https://github.com/antoniandre/splitpanes"
                                    target="_blank"
                                    rel="noopener noreferrer">splitpanes</a>
                                — resizable pane layout
                            </li>
                        </ul>
                    </section>
                    <section>
                        <h3>Icons &amp; fonts</h3>
                        <ul>
                            <li>
                                <a href="https://fonts.google.com/icons"
                                    target="_blank"
                                    rel="noopener noreferrer">Material Icons</a>
                                by Google — Apache 2.0. Loaded directly
                                from
                                <code>fonts.googleapis.com</code>.
                            </li>
                            <li>
                                <a href="https://fonts.google.com/specimen/Lato"
                                    target="_blank"
                                    rel="noopener noreferrer">Lato</a>
                                by Łukasz Dziedzic — SIL Open Font License.
                            </li>
                            <li>
                                Zoom Rooms built-in icon glyphs (the
                                <code>icon_*</code> set) are Zoom's; we
                                ship a local copy of the PNG assets so the
                                preview renders without an internet
                                connection. We have no affiliation with
                                Zoom Communications, Inc.
                            </li>
                        </ul>
                    </section>
                    <section>
                        <h3>License</h3>
                        <p>
                            MIT —
                            <a :href="licenseUrl" target="_blank" rel="noopener noreferrer">read the full text</a>.
                            Copyright © 2022 Jeff McAleer and © 2026
                            Spectrum Integrators. The software is provided
                            "as is", without warranty of any kind.
                        </p>
                    </section>
                </div>
            </div>
        </div>
    </section>
</template>

<script>
import { SCHEMA_URL, EDITOR_URL, todayIso, orderProfileKeys } from '@/config';
import { BUILTIN_EVENTS_BY_CATEGORY, BUILTIN_EVENT_BY_ID } from '@/data/builtinEvents';
import { iconFocusTracker } from '@/data/iconPalette';

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
// Display labels paired with the raw values Zoom expects. Mirror the
// USB2Serial dropdowns ('None' / 'Hardware', 'None' / 'Even' / 'Odd') so the
// two adapter UIs read consistently while the JSON still gets the string
// tokens iTachIP2SL requires.
const ITACH_FLOW = [
    { value: 'FLOW_NONE', label: 'None' },
    { value: 'FLOW_HARDWARE', label: 'Hardware' },
];
const ITACH_PARITY = [
    { value: 'PARITY_NO', label: 'None' },
    { value: 'PARITY_EVEN', label: 'Even' },
    { value: 'PARITY_ODD', label: 'Odd' },
];

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
        // { adapters, ports, methods, params, settings, scenes } — sets of
        // string keys identifying which items have validation errors. Used
        // to paint the same dashed-red indicator on builder cards/fields
        // that the preview already uses. Falls back to empty sets when not
        // wired so the builder still works in isolation.
        errorTargets: {
            type: Object,
            default: () => ({
                adapters: new Set(),
                adapterFields: new Set(),
                ports: new Set(),
                methods: new Set(),
                params: new Set(),
                settings: new Set(),
                scenes: new Set(),
            }),
        },
        // Whether the preview has anything renderable to screenshot. False
        // when the JSON doesn't parse or when the profile is event-only
        // without "Show hidden controls" enabled. Drives the camera
        // button's disabled state and tooltip.
        canScreenshot: {
            type: Boolean,
            default: false,
        },
        // True while a screenshot rasterize is in flight — disables the
        // button so a second click doesn't queue another capture.
        screenshotBusy: {
            type: Boolean,
            default: false,
        },
    },
    emits: ['update:json', 'download', 'profile-reset', 'screenshot'],
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
            // Same idea for the rule-event combo: which rule-card's event
            // dropdown is open.
            openRuleEventDropdownIndex: -1,
            // In-progress rule-event renames keyed by the rule's CURRENT
            // key. When the user types or picks something that would
            // conflict with another existing rule key, the rename can't
            // commit (Object can't hold duplicates), but we keep their
            // typed value here so the input still shows it and the
            // hasRuleEventConflict computed flags it red. Cleared (well,
            // orphaned and ignored) once the rename successfully commits.
            ruleEventDrafts: {},
            // Make the imported events visible to the template.
            BUILTIN_EVENTS_BY_CATEGORY,
            // Shared tracker the icon-palette drawer (in HomeView) reads
            // when the user clicks a palette icon — if our last-focused
            // `.icon-input` is still around, the click fills it; otherwise
            // the palette falls back to clipboard.
            iconFocusTracker,
            // Editing-tips modal visibility. Help button in the builder
            // header toggles it; Escape and backdrop click close it.
            helpVisible: false,
            // URL to the LICENSE.txt served alongside the build. Used by
            // the About tab. BASE_URL keeps it valid when the app is
            // hosted under a subpath (e.g. GitHub Pages without a custom
            // domain).
            licenseUrl: import.meta.env.BASE_URL + 'LICENSE.txt',
            // Active tab inside the help popup. Resets to 'tips' on each
            // open so a returning user lands on the default tab unless
            // they explicitly navigated to the quirks list.
            helpActiveTab: 'tips',
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
        screenshotTitle() {
            if (this.screenshotBusy) return 'Saving screenshot…';
            if (!this.canScreenshot) return 'No controls to capture';
            return 'Save preview as PNG';
        },
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
        // Close the model / rule-event dropdowns when clicking outside them.
        // The chevron buttons and the dropdown <ul>s use @click.stop to
        // prevent their own clicks from bubbling up and closing themselves.
        document.addEventListener('click', this.closeModelDropdown);
        document.addEventListener('click', this.closeRuleEventDropdown);
    },
    beforeUnmount() {
        document.removeEventListener('click', this.closeModelDropdown);
        document.removeEventListener('click', this.closeRuleEventDropdown);
    },
    watch: {
        // Focus the help modal's backdrop when it opens so the Escape key
        // handler (@keydown.esc on the backdrop element) actually fires —
        // without focus, the event never reaches it. Also reset to the
        // default tab so the popup always opens to "Editing Tips" first.
        helpVisible(isOpen) {
            if (isOpen) {
                this.helpActiveTab = 'tips';
                this.$nextTick(() => {
                    if (this.$refs.helpBackdrop) this.$refs.helpBackdrop.focus();
                });
            }
        },
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
        settingHasError(adapterIndex, port, portIndex, field) {
            const key = adapterIndex + ':' + (port.id || `#${portIndex}`) + '#' + field;
            return this.errorTargets.settings.has(key);
        },
        // Render an editable string-with-control-chars as a single visible
        // line. CR / LF / TAB get shown as `\r` `\n` `\t` escape sequences
        // so the user can actually see what's in their regex — the bare
        // `<input>` element strips real control chars on display, which is
        // how a JSON-source `"\r"` (a literal CR byte after parse) was
        // ending up invisible in the builder. The regex engine treats the
        // escape-sequence form and the raw-byte form identically, so any
        // edit lands in the JSON as escape-sequence text (cleaner JSON).
        displayRegex(s) {
            if (typeof s !== 'string') return '';
            let out = '';
            for (let i = 0; i < s.length; i++) {
                const ch = s[i];
                if (ch === '\r') out += '\\r';
                else if (ch === '\n') out += '\\n';
                else if (ch === '\t') out += '\\t';
                else out += ch;
            }
            return out;
        },
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
                                // Seed one empty method so the schema's
                                // `methods.minItems: 1` is satisfied right
                                // out of the gate — the user only needs to
                                // fill values, not click "+ Method" first.
                                methods: [
                                    {
                                        id: '',
                                        name: '',
                                        command: '',
                                        type: 'action',
                                    },
                                ],
                            },
                        ],
                    },
                ],
            };
            // Rebuild entries from the new info so the builder UI reflects
            // the seed data immediately rather than waiting for the prop
            // round-trip to populate it.
            this.syncEntriesFromInfo(info);
            // Let HomeView wipe the output preview and activity log too —
            // they belong to the old profile and would just confuse the
            // user staring at a fresh document.
            this.$emit('profile-reset');
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
                // Wipe the output preview and activity log first — they
                // belong to the previous profile, not this newly-loaded one.
                this.$emit('profile-reset');
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
            // GenericNetworkAdapter is the most permissive default — it
            // doesn't require a UUID (iTach) or COM port (USB2Serial), so
            // the user can fill in just the address and start adding ports
            // without first having to satisfy a model-specific constraint.
            this.localProfile.adapters.push({
                model: 'GenericNetworkAdapter',
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
        closeRuleEventDropdown() {
            this.openRuleEventDropdownIndex = -1;
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
            }
            // Intentionally NOT seeding port.methods = [] — Zoom rejects
            // empty methods arrays in the JSON (minItems: 1), and
            // `addMethod` lazily creates the array when the user actually
            // adds a method. The builder UI works fine with methods
            // undefined (v-for over undefined renders nothing).
            //
            // Seed serial settings with sane defaults (9600-8N1, no flow)
            // so newly-added USB2Serial / iTachIP2SL ports don't immediately
            // light up with "missing required field" warnings before the
            // user even gets a chance to type anything.
            if (adapter.model === 'USB2Serial' || adapter.model === 'iTachIP2SL') {
                this.ensurePortSettings(port, adapter.model);
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
            const port = this.localProfile.adapters[ai].ports[pi];
            port.methods.splice(mi, 1);
            // Drop the key entirely when it goes empty — Zoom rejects an
            // empty methods array (minItems: 1), and an absent key is the
            // canonical representation of "no methods yet."
            if (port.methods.length === 0) delete port.methods;
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

        // ----- Id-rename plumbing -----
        // When a user renames a port / method / param id, every style entry
        // (icons, main_method, invisible, etc.) that keyed off the OLD id
        // would otherwise be orphaned — the rendered preview would lose its
        // icons until the user manually re-typed them. We capture the id at
        // focus time so the commit (blur / Enter) can do a one-shot rename
        // of the matching style keys. Per-keystroke renaming via v-model is
        // a non-starter — mid-edit ids like "s", "sc", "scr" would tag the
        // styles to transient values and never recover.
        onIdFocus(target, field, parents) {
            // Stash a snapshot at focus time keyed by the in-memory object so
            // the matching change handler can read it back without us having
            // to thread state through every input.
            this._idFocusSnapshot = {
                target,
                value: target[field],
                portId: parents && parents.portId,
                methodId: parents && parents.methodId,
            };
        },
        readIdFocusSnapshot(target) {
            const snap = this._idFocusSnapshot;
            this._idFocusSnapshot = null;
            // Only honor a snapshot if it was for the same object — guards
            // against weird focus-loss / refocus races.
            if (!snap || snap.target !== target) return null;
            return snap;
        },
        renameStylesPrefix(oldPrefix, newPrefix) {
            if (!Array.isArray(this.localProfile.styles)) return;
            this.localProfile.styles = this.localProfile.styles.map((s) =>
                typeof s === 'string' && s.startsWith(oldPrefix)
                    ? newPrefix + s.slice(oldPrefix.length)
                    : s
            );
            // Also rewrite the bare "<portId>.main_method=<methodId>" values:
            // the main_method's *value* references a method id by name, so a
            // method rename has to update both the key and the value half.
            // Handled by callers via renameMainMethodValue when relevant.
        },
        renameMainMethodValue(portId, oldMethodId, newMethodId) {
            if (!Array.isArray(this.localProfile.styles)) return;
            const prefix = `${portId}.main_method=`;
            this.localProfile.styles = this.localProfile.styles.map((s) => {
                if (typeof s !== 'string' || !s.startsWith(prefix)) return s;
                return s.slice(prefix.length) === oldMethodId
                    ? `${prefix}${newMethodId}`
                    : s;
            });
        },
        onPortIdCommit(port) {
            const snap = this.readIdFocusSnapshot(port);
            if (!snap) return;
            const oldId = snap.value;
            const newId = port.id;
            if (!oldId || !newId || oldId === newId) return;
            this.renameStylesPrefix(`${oldId}.`, `${newId}.`);
        },
        onMethodIdCommit(port, method) {
            const snap = this.readIdFocusSnapshot(method);
            if (!snap) return;
            const oldMethodId = snap.value;
            const newMethodId = method.id;
            const portId = snap.portId || port.id;
            if (!portId || !oldMethodId || !newMethodId || oldMethodId === newMethodId) return;
            this.renameStylesPrefix(
                `${portId}.${oldMethodId}.`,
                `${portId}.${newMethodId}.`
            );
            // If this method was the port's main_method, the value side of
            // the main_method= style needs updating too — it references the
            // method by name.
            this.renameMainMethodValue(portId, oldMethodId, newMethodId);
        },
        onParamIdCommit(port, method, param) {
            const snap = this.readIdFocusSnapshot(param);
            if (!snap) return;
            const oldParamId = snap.value;
            const newParamId = param.id;
            const portId = snap.portId || port.id;
            const methodId = snap.methodId || method.id;
            if (!portId || !methodId || !oldParamId || !newParamId || oldParamId === newParamId) return;
            this.renameStylesPrefix(
                `${portId}.${methodId}.${oldParamId}.`,
                `${portId}.${methodId}.${newParamId}.`
            );
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
        // ----- Rule-event dropdown -----
        toggleRuleEventDropdown(ri) {
            this.openRuleEventDropdownIndex =
                this.openRuleEventDropdownIndex === ri ? -1 : ri;
        },
        // The value the input field should currently show. If there's an
        // in-progress draft for this rule, show that; otherwise show the
        // committed key. Drafts diverge from the committed key only when
        // the user typed/picked something that would collide with another
        // rule's key (Object can't hold duplicates, so we can't commit it
        // but we still want the UI to reflect the user's intent).
        ruleEventDisplay(event) {
            return event in this.ruleEventDrafts ? this.ruleEventDrafts[event] : event;
        },
        setRuleEventDraft(event, val) {
            this.ruleEventDrafts[event] = val;
        },
        hasRuleEventConflict(event) {
            const draft = this.ruleEventDrafts[event];
            if (draft === undefined) return false;
            const trimmed = (draft || '').trim();
            if (!trimmed || trimmed === event) return false;
            // Conflict iff another rule already has this key.
            return Object.prototype.hasOwnProperty.call(this.localProfile.rules || {}, trimmed);
        },
        commitRuleEvent(event) {
            const draft = this.ruleEventDrafts[event];
            if (draft === undefined) return;
            const trimmed = (draft || '').trim();
            if (!trimmed || trimmed === event) {
                // Empty / unchanged — drop the draft and re-render to the
                // committed key.
                delete this.ruleEventDrafts[event];
                return;
            }
            if (this.hasRuleEventConflict(event)) return; // leave draft visible
            // Safe to commit: rename, then clear the (now-orphaned) draft.
            this.renameRule(event, trimmed);
            delete this.ruleEventDrafts[event];
        },
        selectRuleEvent(currentEvent, newEventId) {
            this.openRuleEventDropdownIndex = -1;
            this.setRuleEventDraft(currentEvent, newEventId);
            // Try to commit immediately; if it conflicts, the draft stays
            // visible with the conflict styling and the user can either
                // delete the other rule or pick something else.
            this.commitRuleEvent(currentEvent);
        },
        ruleEventTooltip(eventId) {
            // Show the friendly label + note in the input's title attribute
            // when the current value matches a known built-in event. Custom
            // events get a generic placeholder.
            const entry = BUILTIN_EVENT_BY_ID.get(eventId);
            if (!entry) return 'Custom event name';
            const parts = [`${entry.label} (${entry.category})`];
            if (entry.note) parts.push(entry.note);
            return parts.join(' — ');
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

// Transient status text shown to the right of the action buttons while a
// long-running toolbar action is in flight (currently just the screenshot
// render — html-to-image's rasterize takes ~1-2 s on a complex profile and
// the cursor-only `wait` was easy to miss). `aria-live="polite"` in the
// template ensures screen readers announce it when it appears.
.builder-status {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    color: c.$text-dark;
    opacity: 0.7;
    font-size: 0.85rem;
    font-style: italic;

    .material-icons {
        font-size: 16px;
        line-height: 1;
    }
    .spin {
        animation: builder-status-spin 1s linear infinite;
    }
}

@keyframes builder-status-spin {
    to { transform: rotate(360deg); }
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

// Help button sits at the far right of the builder header; the small left
// margin nudges it away from the New/Open/Download cluster so it reads as a
// separate "what is this thing?" affordance rather than another doc action.
.btn-icon-help {
    margin-left: auto;
}

// Editing-tips modal. Fixed-position so it covers the whole builder pane;
// click-outside on the dimmed backdrop dismisses, X button in the card
// header dismisses, Escape dismisses (via the @keydown.esc binding plus the
// focus pulse in the watcher).
.help-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    outline: none;
}

.help-card {
    background: #fff;
    border-radius: 8px;
    width: min(640px, 100%);
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.25);
    overflow: hidden;
}

// Header strip uses the accent purple — distinct from both the editor's
// black navbar AND from a dark-mode Zoom preview backdrop, so the modal
// reads as a clearly different UI surface regardless of what's behind it.
.help-card-header {
    flex: 0 0 auto;
    display: flex;
    align-items: stretch;
    padding: 0.4rem 0.5rem 0 0.5rem;
    background: c.$accent;
    color: c.$text-light;
}

.help-tabs {
    flex: 1 1 auto;
    display: flex;
    align-items: stretch;
    gap: 0.3rem;
    min-width: 0;
}

// Tabs styled as physical chips that sit on top of the body card. Inactive
// tabs are dimmer, smaller-looking pills; the active one is a brighter
// rectangle whose bottom edge merges with the body (its background matches
// the body background and overshoots the header's bottom edge by 1px so
// the border line under inactive tabs visibly doesn't pass through the
// active one).
.help-tab {
    @include b.btn-shared;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-bottom: none;
    border-radius: 6px 6px 0 0;
    color: c.$text-light;
    opacity: 0.7;
    padding: 0.5rem 0.9rem 0.55rem;
    margin-bottom: -1px;
    font-size: 0.92rem;
    font-weight: 500;
    line-height: 1.2;
    cursor: pointer;
    white-space: nowrap;

    &:hover {
        opacity: 0.95;
        background: rgba(255, 255, 255, 0.15);
    }

    &.active {
        opacity: 1;
        background: #fff;
        color: c.$primary;
        border-color: #fff;
        font-weight: 600;
        // Slight lift to make it look like the active tab sits a touch
        // higher than the inactive ones, reinforcing the chip metaphor.
        padding-top: 0.6rem;
        padding-bottom: 0.65rem;
    }
}

.help-close {
    @include b.btn-shared;
    background: transparent;
    border: none;
    color: c.$text-light;
    padding: 2px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    opacity: 0.7;

    .material-icons { font-size: 20px; }
    &:hover { opacity: 1; }
}

.help-card-body {
    flex: 1 1 auto;
    overflow: auto;
    padding: 1rem 1.25rem;
    font-size: 0.88rem;
    line-height: 1.5;
    color: c.$text-dark;

    section {
        margin-bottom: 1.1rem;

        &:last-child { margin-bottom: 0; }
    }

    h3 {
        margin: 0 0 0.35rem;
        font-size: 0.95rem;
        font-weight: 600;
        color: c.$primary;
    }

    p {
        margin: 0 0 0.6rem;

        &:last-child { margin-bottom: 0; }
    }

    code {
        background: #efeff4;
        border-radius: 2px;
        padding: 0 4px;
        font-size: 0.92em;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace;
    }

    a {
        color: c.$accent;
        text-decoration: underline;
    }

    strong {
        color: c.$primary;
    }

    // The global `* { padding: 0; margin: 0 }` reset (style.scss) zeroes
    // out the default ul padding, which would otherwise render bullets
    // outside the list's content edge and crammed against the body's
    // left padding. Restore enough left padding for the bullets to sit
    // at the paragraph's text-start position and the item text to indent
    // past them.
    ul {
        padding-left: 1.25rem;
        margin: 0 0 0.6rem;

        &:last-child { margin-bottom: 0; }
    }
    li {
        margin: 0.15rem 0;
    }

    // Disclaimer block in the About tab. Sets it apart from the
    // surrounding credits sections so the "as is, no warranty" framing
    // doesn't blend into the rest of the prose.
    .help-disclaimer {
        background: #fef3c7;
        border-left: 3px solid #f59e0b;
        border-radius: 3px;
        padding: 0.6rem 0.85rem;

        h3 {
            color: #78350f;
        }

        p {
            color: #78350f;
        }

        strong {
            color: #78350f;
        }
    }

    // "Undocumented but Confirmed Behavior" tab — intro paragraph + a
    // densely-packed bulleted list. Slightly tighter line-height than the
    // tips tab because the list reads as a reference.
    .help-quirks-intro {
        color: c.$text-dark;
        opacity: 0.8;
        font-style: italic;
        margin-bottom: 0.9rem;
    }

    .help-quirks {
        list-style: disc;
        padding-left: 1.3rem;
        margin: 0;

        li {
            margin-bottom: 0.7rem;
            line-height: 1.45;

            &:last-child { margin-bottom: 0; }
        }
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

    // Subtle when disabled (typically because the parent id is missing —
    // the cascading red outline on the card already tells the user where the
    // real problem is, so this shouldn't shout "broken").
    &:disabled {
        opacity: 0.7;
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

    // Disabled when the parent's id is empty (icons are styles-backed, keyed
    // by the id, so there's nothing to save against yet). Kept very subtle —
    // the dashed red cascade outline already flags the real problem.
    &:disabled {
        opacity: 0.85;
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

// ---- Rule event combo ----
// Same chevron pattern as adapter-model, but the dropdown is wider and has
// a two-line layout per entry (friendly label on top, `zr_*` id below).
// Categories are surfaced as inline section headers within the list.
.rule-event-combo {
    position: relative;
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
    align-items: stretch;

    .rule-event {
        flex: 1 1 auto;
        min-width: 0;
        border-radius: 3px 0 0 3px;
        border-right: none;
    }
}

.rule-event-dropdown {
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
    max-height: 320px;
    overflow-y: auto;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
    font-size: 0.82rem;

    li {
        padding: 0.3rem 0.6rem;
        cursor: pointer;
        color: c.$text-dark;
        display: flex;
        flex-direction: column;
        gap: 0.05rem;

        &:hover {
            background: c.$zoom-button;
        }

        &.selected {
            background: c.$zoom-button;

            .event-label { font-weight: 600; }
        }
    }

    .dropdown-category {
        background: #f4f4f8;
        padding: 0.25rem 0.6rem;
        text-transform: uppercase;
        font-size: 0.66rem;
        font-weight: 600;
        letter-spacing: 0.05em;
        color: c.$text-dark;
        opacity: 0.6;
        cursor: default;
        border-top: 1px solid c.$border;

        &:first-child { border-top: none; }
        &:hover { background: #f4f4f8; }
    }

    .event-label {
        font-size: 0.82rem;
    }

    .event-id {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace;
        font-size: 0.72rem;
        color: c.$text-dark;
        opacity: 0.7;
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

// Validator-driven error indicator. Used by anything the validator flagged
// (cards via `errorTargets` props, individual setting <label>s via
// `settingHasError`). Uses outline (not border) so toggling it doesn't
// reflow the builder, and matches the dashed-firebrick style we use in the
// preview pane for consistency.
.builder-panel {
    .has-validation-error {
        outline: 1px dashed firebrick;
        outline-offset: -1px;
    }

    // For text inputs flagged by the validator (adapter ip/com/uuid/model
    // pointed at by a schema error), match the pink treatment that empty
    // required fields get via `:required:invalid` so the user can see the
    // specific input at fault, not just the dashed card outline.
    input.has-validation-error {
        border-color: #d97777;
        background: #fff5f5;
    }

    // Flagged serial-settings labels: tint the select to match the pink
    // background used by `:required:invalid` text inputs so the error reads
    // the same way across all input types instead of being a faint dashed
    // outline on an otherwise-normal-looking dropdown.
    .settings-grid > label.has-validation-error {
        padding: 0 0.25rem;
        border-radius: 3px;
        background: #fff5f5;

        select {
            border-color: #d97777;
            background: #fff5f5;
        }
    }
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
