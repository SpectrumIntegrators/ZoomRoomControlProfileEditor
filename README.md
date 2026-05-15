# Zoom Room Control Profile Editor

## Overview

A builder, validator, and preview tool for [Zoom Native Room Controls](https://support.zoom.us/hc/en-us/articles/360033716572-Zoom-Rooms-Native-Room-Controls) profiles. Lets you compose a control profile with a GUI editor or by manually typing JSON data, see schema/cross-reference errors, and preview the rendered Zoom Room control surface and command output.

## Features

- Visual representation of controls as they would appear on a Zoom Rooms control panel
- Light and dark mode preview
- Profile builder GUI
- Fully-featured JSON editor (autocomplete, folding, error highlighting, help text)
- Two-way sync between JSON text and builder GUI
- Command output preview for individual commands, scenes, and event rules
- Response injection to test response filters
- Activity log to investigate sequence flow
- Resizable panes - focus on the part that matters to you
- Schema validation to make sure your file follows what Zoom expects
- Visual indication of empty or invalid fields - easily see where errors are
- Forgiving validation - if Zoom adds something (or I missed something!), you can still generate a profile even if schema validation fails
- Open files from your computer, download your work to save
- Icon pallet - search for and browse available icons
- Image export - download the Zoom UI as a PNG

## Coming soon
- Templates for common devices

## Editing tips

The same tips are available in-app via the **?** button at the top-right of the builder.

### Backslashes and JSON

In the actual JSON file, escaped hex bytes must have two backslashes (`\xFF`). This gets messy, especially with filter regexes. This editor handles the double-escaping for you, so in every `command`, `value`, and `filter_regex` field you can just use a single backslash as normal.

### Command strings (port → device)

A method's `command` is the raw bytes sent on the wire. Use `\r`, `\n`, `\t` for control characters and `\xNN` for any arbitrary byte (`\xFF`, `\x02`, etc.). Zoom decodes these at send time; the byte that hits the device is the single character each escape represents.

For methods with `type: "actions"`, `%` in the command string is replaced with the matched param's `value` at send time. Add a `params` array and use `%` as the placeholder. If it's `type: "action"` (singulgar), the `%` is just sent as a literal percent character.

### Regex flavor for response filters

Zoom uses MSVC `std::regex` with the ECMAScript flavor — equivalent to JavaScript's `RegExp`. To test patterns externally, use [regex101.com](https://regex101.com) with **"JavaScript" flavor selected**. Don't tick the `s` (dotAll) flag — it postdates Zoom's regex engine. Use `[\s\S]` when you would need `.` to also match newlines.

Captured groups don't pass through to rule handlers — filters fire by name only. Use the response-injection panel (in the activity log drawer) to test patterns against simulated device replies.

### Comments

The `$comment` field on any block (info, adapter, port, method, param, scene, rule, filter) is ignored by Zoom and by schema validation. Free-form notes for whoever opens the profile next. Add one with the **+ Comment** button on any item.

## Undocumented but Confirmed Behavior

These are behaviors that the Zoom documentation does not indicate but have been confirmed through various methods. The validator catches violations so you don't find out in a customer's room with them standing there.

- **Response filters don't work on USB2Serial adapters.** Zoom rejects profiles where a `port.response_filter` is set on a USB2Serial port. 
- **`response_filter.trigger_event` cannot shadow a built-in `zr_*` event.** Zoom rejects profiles where a custom filter trigger collides with one of the built-in event names listed in the [Room Controls for Zoom Rooms](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0064072) documentation (list copied in `/doc/zoom_events.csv). 
- **`response_filter.trigger_event` must reference a rule that exists.** A filter pointing at an undefined rule key is rejected.
- **Rule and scene command arrays must not be empty.** If a rule's commands or a scene's commands list is `[]`, Zoom rejects the profile at parse time. The schema enforces this via `minItems: 1` on both, so the builder catches it before the JSON ever reaches Zoom. 
- **Port IDs should be unique across adapters.** Command references (`port.method[.param]`) have no adapter qualifier, so two adapters with the same port id leave the second port unreachable via refs (Zoom uses the first matching ID).
- **Rule keys are case-sensitive.** `meeting_started` and `Meeting_started` are different rules. The schema's pattern check enforces this in both directions, but it's worth knowing.
- **Response filters dispatch all-match, not first-match.** When data arrives on a port, Zoom evaluates *every* filter assigned to that port and fires the `trigger_event` of every one whose regex matches.
- **Response filters use `regex_match`, not `regex_search`.** The pattern must match the *entire* received buffer, not just a substring of it. Verified empirically — `a[\s\S]*b` doesn't fire on input `12ab` even though a search-based engine would find the match at offset 2. Wrap patterns with `[\s\S]*` on both sides to absorb surrounding content (e.g. `[\s\S]*Login:[\s\S]*`).
- **Response filter matching is per-chunk, not per-line.** Neither the per-protocol receive hook nor the dispatch loop accumulates bytes between calls. Each receive callback regexes whatever was delivered. If a device fragments its reply across TCP packets, each fragment is matched independently — a regex that needs to see the full reply will be unreliable on slow / chatty connections.
- **Response filter regex flavor is MSVC `std::regex` ECMAScript** JavaScript's `RegExp` implements the same dialect, so the simulator and Zoom match identically for practical ASCII patterns.
- **Response filter matching is ASCII-only in practice** Zoom's receive pipeline decodes incoming bytes as UTF-8 before the regex sees them. Bytes `0x80`–`0xFF` are invalid as lone UTF-8 bytes, so the decoder drops or replaces them and the regex never sees them. Verified empirically — patterns like `\xAA` and `[\s\S]*\xFF[\s\S]*` don't fire even when the device sends those exact bytes. Match on printable status codes instead; for purely binary protocols, response filters are not the right tool. The validator surfaces a warning if any `filter_regex` contains a `\xNN` escape with `NN > 0x7F`.

## Attribution

This project is a fork of [`zoom-native-room-controls-preview`](https://github.com/jeffderek/zoom-native-room-controls-preview) by [Jeff McAleer](https://www.jeffmcaleer.com), used under the MIT License.

## Development

```sh
npm install
npm run dev
```

`npm run build` produces a static bundle in `dist/`.

### Stack

Runtime dependencies:

- **Vue 3** (3.5.x) — Options API throughout; one inline runtime template (CommentRow / InfoRow in `BuilderPanel.vue`) which is why `vue` is aliased to `vue/dist/vue.esm-bundler.js` in `vite.config.js`.
- **AJV 8** — JSON Schema (draft-07) validation against the bundled schema, swapped at runtime for the live schema fetched from jsDelivr.
- **CodeMirror 6** via **vue-codemirror** — JSON editor with `@codemirror/lang-json` for syntax + folding, and `codemirror-json-schema` for schema-driven autocomplete / hover / lint.
- **splitpanes** (4.x) — resizable layout. The library writes inline `width:%` / `height:%` styles on each pane; the fullscreen-preview toggle uses class-based selectors rather than id-based to win specificity against splitpanes' inline styles.

Build / dev:

- **Vite 6** — dev server + production bundle. No CSS preprocessor plugin needed; Vite invokes Sass through `sass-embedded`.
- **@vitejs/plugin-vue** — SFC compilation.
- **sass-embedded** — modern Sass (`@use` module system) for the SCSS files under `src/styles/`.

External assets (loaded by the browser at runtime, not bundled):

- **Google Fonts**: Material Icons + Lato.
- **jsDelivr**: live copy of the profile JSON schema, mirrored from the `SpectrumIntegrators/PublicSchemas` GitHub repo. If the remote fetch fails, the bundled local copy is used as a fallback.

### Constants

`/src/config.js`

- `SCHEMA_URL`: URL to JSON schema from CDN
- `EDITOR_URL`: URL to the editor (automatically inserted into the info block)

### Validation pipeline

Validation lives in `src/validation/validateProfile.js` and orchestrates several discrete passes. Each pass catches what the others structurally can't.

#### Schema-based (AJV)

- **`runSchemaValidation(json)`** — runs the bundled/remote schema. Types, enums, `required`, regex patterns (private IPv4, Global Caché UUID, port-id format), `additionalProperties`, `minItems`/`maxItems`, and all the `if/then` model-conditional branches (e.g. "USB2Serial requires `com`", "iTachIP2SL requires `uuid`").

#### Hand-rolled (things the schema can't express)

- **`runDuplicateKeyValidation(rawText)`** — walks the JSON *source text*. `JSON.parse` silently collapses duplicate keys (later value wins), so by the time you have a parsed object the duplicate is gone; only the source has this information.
- **`runUniqueIdValidation(json)`** — globally-unique port ids, per-port-unique method ids, per-method-unique param ids, plus globally-unique scene ids and response-filter names. JSON Schema doesn't have a "values must be unique in *this field* across an array" primitive — `uniqueItems` only does deep-equal of whole entries. Skips empty ids on purpose (those are flagged separately by the schema's pattern check; double-flagging is noise).
- **`runSerialSettingsValidation(json)`** — backstop for USB2Serial / iTachIP2SL settings. Two reasons it exists: AJV's nested `if/then + $ref` chain sometimes drops conditional sub-errors, and even when it doesn't, AJV emits one error at the port level when `settings` is missing entirely. This pass emits one error per missing/invalid setting field so each dropdown in the builder can highlight individually.
- **`runCrossRefValidation(json)`** — resolves each `port.method[.param]` reference in scenes and rules via `findPortMethodParam`. JSON Schema can't validate "this string matches an id that exists elsewhere in the document."
- **`runQuirkValidation(rawText, json)`** — Zoom-specific gotchas. Currently just the "empty rules array must be `[]` with no whitespace" rule (Zoom rejects `[ ]` or `[\n]` even though both are valid JSON).

#### Post-processing

- **`buildPointerLineMap(rawText)` + `annotateLines(errors, lineMap)`** — one text walk to map every JSON pointer to its 1-based source line, then a sweep over the errors to attach `.line`. Drives the clickable `line N` badge that scrolls the editor to the offending row.
- **`friendlyPath(pointer, json)`** — translates `/adapters/0/ports/1/methods/0/id` into something like `GenericNetworkAdapter 10.1.1.2 / port 'display' / methods / 0 / id`. Used both as the error's `path` field and inline inside message strings, so warnings read in domain terms instead of raw JSON pointers.

#### Orchestration

```
alwaysErrors = duplicateKeys + uniqueIds + serialSettings   (always returned)
  → schemaErrors    → if any, return alwaysErrors + schemaErrors, stop
  → crossRefErrors  → if any, return alwaysErrors + crossRefErrors, stop
  → quirkErrors     → if any, return alwaysErrors + quirkErrors, stop
  → alwaysErrors only (or {ok:true,[]} if even those are empty)
```

The cascade is intentional: when the schema is failing, downstream checks (cross-ref especially) would fire in confusing secondary ways — a missing `scenes.commands` would make cross-ref report nothing useful. Each layer's report stays focused. The "always" group runs first because those failures are local (a dup key, a dup id, an invalid baud rate) and don't depend on the rest of the profile being well-formed.

## AI Disclosure

Portions of this software were developed or modified with the assistance of an artificial intelligence agent.

## License

> MIT License
> 
> Copyright (c) 2022 Jeff McAleer
> 
> Copyright (c) 2026 Spectrum Integrators
> 
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
> 
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
> 
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> SOFTWARE.
