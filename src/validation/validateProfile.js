import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { schemaState } from './schemaLoader';
import { BUILTIN_EVENT_SET, BUILTIN_EVENT_BY_ID } from '@/data/builtinEvents';

let cachedSchema = null;
let cachedValidator = null;

function getValidator() {
    if (cachedSchema === schemaState.schema && cachedValidator) {
        return cachedValidator;
    }
    const ajv = new Ajv({ allErrors: true, strict: false });
    // Registers the standard JSON Schema formats (uri, email, date-time, uuid,
    // regex, etc.) so any `"format": "..."` declarations in the schema are
    // actually validated instead of silently skipped with a warning.
    addFormats(ajv);
    cachedValidator = ajv.compile(schemaState.schema);
    cachedSchema = schemaState.schema;
    return cachedValidator;
}

function formatPath(instancePath) {
    return instancePath || '(root)';
}

// Translate a JSON pointer like "/adapters/0/ports/0/id" into something the
// user can locate in their profile: "GenericNetworkAdapter 192.168.1.10 /
// port 'cc_light' / id". Walks the parsed JSON in parallel so each numeric
// index can be replaced with the corresponding identifier; falls back to
// ordinal ("first port", "second port", …) when the item has no id/name yet,
// and to the raw segment when the JSON shape doesn't match what we'd expect
// (e.g. a broken profile where the path goes off the rails).
const ORDINALS = [
    'first', 'second', 'third', 'fourth', 'fifth',
    'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
];
function ordinal(n) {
    if (n < ORDINALS.length) return ORDINALS[n];
    return `#${n + 1}`;
}
function nameOrOrdinal(obj, idx, noun) {
    if (obj && typeof obj === 'object') {
        if (typeof obj.id === 'string' && obj.id) return `${noun} '${obj.id}'`;
        if (typeof obj.name === 'string' && obj.name) return `${noun} '${obj.name}'`;
    }
    return `${ordinal(idx)} ${noun}`;
}
function describeAdapter(adapter) {
    if (!adapter || typeof adapter !== 'object') return 'adapter';
    const model = adapter.model || 'adapter';
    const addr = adapter.ip || adapter.com || adapter.uuid || '';
    return addr ? `${model} ${addr}` : model;
}
function friendlyPath(instancePath, json) {
    if (!instancePath || instancePath === '(root)') return '(root)';
    const segs = instancePath.split('/').slice(1); // drop leading empty
    const out = [];
    let cur = json;
    for (let i = 0; i < segs.length; i++) {
        const seg = segs[i];
        const next = segs[i + 1];
        const idx = next != null ? Number(next) : NaN;
        const numericNext = Number.isInteger(idx);

        if (seg === 'adapters' && numericNext && Array.isArray(cur && cur.adapters)) {
            const adapter = cur.adapters[idx];
            out.push(describeAdapter(adapter));
            cur = adapter;
            i++;
        } else if (seg === 'ports' && numericNext && Array.isArray(cur && cur.ports)) {
            const port = cur.ports[idx];
            out.push(nameOrOrdinal(port, idx, 'port'));
            cur = port;
            i++;
        } else if (seg === 'methods' && numericNext && Array.isArray(cur && cur.methods)) {
            const method = cur.methods[idx];
            out.push(nameOrOrdinal(method, idx, 'method'));
            cur = method;
            i++;
        } else if (seg === 'params' && numericNext && Array.isArray(cur && cur.params)) {
            const param = cur.params[idx];
            out.push(nameOrOrdinal(param, idx, 'param'));
            cur = param;
            i++;
        } else if (seg === 'scenes' && numericNext && Array.isArray(cur && cur.scenes)) {
            const scene = cur.scenes[idx];
            out.push(nameOrOrdinal(scene, idx, 'scene'));
            cur = scene;
            i++;
        } else if (seg === 'response_filters' && numericNext && Array.isArray(cur && cur.response_filters)) {
            const filter = cur.response_filters[idx];
            // response filters use `name` (not `id`) as their identifier.
            if (filter && typeof filter.name === 'string' && filter.name) {
                out.push(`response filter '${filter.name}'`);
            } else {
                out.push(`${ordinal(idx)} response filter`);
            }
            cur = filter;
            i++;
        } else if (seg === 'commands' && numericNext) {
            out.push(`command ${idx + 1}`);
            cur = Array.isArray(cur && cur.commands) ? cur.commands[idx] : undefined;
            i++;
        } else if (seg === 'rules' && next != null) {
            out.push(`rule '${next}'`);
            cur = cur && cur.rules ? cur.rules[next] : undefined;
            i++;
            // The next segment after a rule key is an index into the rule's
            // command array — translate that too.
            const cmdSeg = segs[i + 1];
            if (cmdSeg != null && Number.isInteger(Number(cmdSeg)) && Array.isArray(cur)) {
                out.push(`command ${Number(cmdSeg) + 1}`);
                cur = cur[Number(cmdSeg)];
                i++;
            }
        } else {
            // Leaf field name, or a segment we don't recognize. Keep it as-is
            // — it's still informative (e.g. 'settings', 'icon', 'id').
            out.push(seg);
            if (cur && typeof cur === 'object') cur = cur[seg];
        }
    }
    return out.join(' / ');
}

// ----- Pattern-failure diagnosis -----------------------------------------
// A bare "doesn't match the pattern" is useless for the fields users actually
// type by hand — adapter addresses above all. Work out *which* part of the
// value is wrong (missing scheme, missing port, public IP, bad hostname) and
// say that instead. Falls back to the schema's `patternExample` prose, and
// only then to the generic message.

function valueAtPointer(json, pointer) {
    if (!pointer) return json;
    let cur = json;
    for (const raw of pointer.split('/').slice(1)) {
        if (cur === null || typeof cur !== 'object') return undefined;
        const seg = raw.replace(/~1/g, '/').replace(/~0/g, '~');
        cur = Array.isArray(cur) ? cur[Number(seg)] : cur[seg];
    }
    return cur;
}

// `err.schemaPath` looks like '#/definitions/genericNetworkUrl/pattern'. Walk
// it against the live schema and hand back the object that owns the failing
// keyword, so we can read its `patternExample`.
function schemaForError(schemaPath) {
    if (typeof schemaPath !== 'string' || schemaPath[0] !== '#') return null;
    const segs = schemaPath.slice(1).split('/').filter(Boolean);
    segs.pop();
    let cur = schemaState.schema;
    for (const raw of segs) {
        if (!cur || typeof cur !== 'object') return null;
        cur = cur[raw.replace(/~1/g, '/').replace(/~0/g, '~')];
    }
    return cur && typeof cur === 'object' ? cur : null;
}

const IPV4_SHAPE = /^\d{1,3}(?:\.\d{1,3}){3}$/;
// RFC 1123 hostname: LDH labels, each starting and ending alphanumeric.
const HOSTNAME_SHAPE =
    /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/;
const PUBLIC_IP_NOTE =
    'Zoom rejects profiles containing public IPs (ZRCSErrorCode_IP_Is_Public)';
const RFC1918_HINT = 'an RFC 1918 address (10.x, 172.16-31.x, or 192.168.x)';

function ipv4Octets(s) {
    if (!IPV4_SHAPE.test(s)) return null;
    const parts = s.split('.').map(Number);
    return parts.every((n) => n >= 0 && n <= 255) ? parts : null;
}
function isPrivateIpv4(o) {
    return (
        o[0] === 10 ||
        (o[0] === 172 && o[1] >= 16 && o[1] <= 31) ||
        (o[0] === 192 && o[1] === 168)
    );
}

// Each of these returns a sentence fragment naming the single most likely
// problem, or null when that part of the value is fine.
function hostProblem(host) {
    if (!host) return 'the host is empty';
    if (host === '255.255.255.255') return null; // limited broadcast, allowed
    const octets = ipv4Octets(host);
    if (octets) {
        return isPrivateIpv4(octets)
            ? null
            : `'${host}' is a public IP — ${PUBLIC_IP_NOTE}. Use ${RFC1918_HINT} or a hostname`;
    }
    if (/^[\d.]+$/.test(host)) {
        return `'${host}' looks like an IP address but isn't a valid one`;
    }
    if (host.includes('_')) {
        return `hostname '${host}' contains an underscore — hostnames allow letters, digits, hyphens, and dots only`;
    }
    if (!HOSTNAME_SHAPE.test(host)) {
        return `'${host}' isn't a usable hostname — letters, digits, hyphens, and dots only, and every label must start and end with a letter or digit`;
    }
    return null;
}
function portProblem(port) {
    if (!/^\d+$/.test(port)) return `port '${port}' isn't a number`;
    const n = Number(port);
    if (n < 1 || n > 65535) return `port ${n} is out of range (1-65535)`;
    return null;
}
function splitHostPort(rest) {
    const i = rest.lastIndexOf(':');
    if (i < 0) return null;
    return { host: rest.slice(0, i), port: rest.slice(i + 1) };
}
function hostPortProblem(hp) {
    return hostProblem(hp.host) || portProblem(hp.port);
}

function diagnoseGenericNetworkUrl(value) {
    if (typeof value !== 'string' || !value) return null;
    const m = /^([A-Za-z][A-Za-z0-9+.-]*):\/\/([\s\S]*)$/.exec(value);
    if (!m) {
        // No scheme at all — the most common mistake by far. When the rest of
        // the value is already a usable host:port, hand back the exact string
        // the user should have typed rather than describing the grammar.
        const hp = splitHostPort(value);
        if (!hp) {
            return `missing the 'tcp://' or 'udp://' prefix and the ':<port>' suffix — e.g. 'tcp://${value}:<port>'`;
        }
        const problem = hostPortProblem(hp);
        return problem
            ? `missing the 'tcp://' or 'udp://' prefix, and ${problem}`
            : `missing the 'tcp://' or 'udp://' prefix — use 'tcp://${value}' (or 'udp://${value}')`;
    }
    const scheme = m[1];
    const rest = m[2];
    if (scheme !== 'tcp' && scheme !== 'udp') {
        return `'${scheme}://' isn't a supported scheme — use 'tcp://' or 'udp://'`;
    }
    const hp = splitHostPort(rest);
    if (!hp) return `missing the ':<port>' suffix — use '${scheme}://${rest}:<port>'`;
    return hostPortProblem(hp);
}

function diagnosePrivateIpv4(value) {
    if (typeof value !== 'string' || !value) return null;
    const m = /^([A-Za-z][A-Za-z0-9+.-]*):\/\/([\s\S]*)$/.exec(value);
    if (m) {
        const extra = /:\d+$/.test(m[2]) ? " and the ':<port>' suffix" : '';
        return `iTach adapters take a bare IP address, not a URL — drop the '${m[1]}://' prefix${extra}`;
    }
    const octets = ipv4Octets(value);
    if (octets) {
        return isPrivateIpv4(octets)
            ? null
            : `'${value}' is a public IP — ${PUBLIC_IP_NOTE}. iTach adapters must sit on ${RFC1918_HINT}`;
    }
    if (/^[\d.]+$/.test(value)) return `'${value}' isn't a valid IPv4 address`;
    if (HOSTNAME_SHAPE.test(value)) {
        return `iTach adapters are addressed by IP, not by name — '${value}' is a hostname; use the device's RFC 1918 address (e.g. 192.168.1.50)`;
    }
    return null;
}

function definitionNameFromSchemaPath(schemaPath) {
    const m = /#\/definitions\/([^/]+)\//.exec(schemaPath || '');
    return m ? m[1] : null;
}

function formatSchemaError(err, json) {
    const path = friendlyPath(err.instancePath, json);
    switch (err.keyword) {
        case 'required':
            return `${path} is missing required field '${err.params.missingProperty}'`;
        case 'additionalProperties':
            return `${path} has unknown field '${err.params.additionalProperty}'`;
        case 'enum':
            return `${path} must be one of: ${err.params.allowedValues.join(', ')}`;
        case 'pattern': {
            const defName = definitionNameFromSchemaPath(err.schemaPath);
            const value = valueAtPointer(json, err.instancePath);
            const detail =
                defName === 'genericNetworkUrl'
                    ? diagnoseGenericNetworkUrl(value)
                    : defName === 'privateIpv4'
                      ? diagnosePrivateIpv4(value)
                      : null;
            if (detail) return `${path} — ${detail}.`;
            // No field-specific diagnosis: fall back to the schema's own
            // prose example, which still beats the raw regex.
            const owner = schemaForError(err.schemaPath);
            if (owner && owner.patternExample) {
                return `${path} doesn't match the required format — expected ${owner.patternExample}.`;
            }
            return defName
                ? `${path} does not match the required format (${defName})`
                : `${path} does not match the required format`;
        }
        case 'type':
            return `${path} must be of type ${err.params.type}`;
        case 'minItems':
            return `${path} must have at least ${err.params.limit} item(s)`;
        case 'maxItems':
            return `${path} must have at most ${err.params.limit} item(s)`;
        case 'minimum':
            return `${path} must be >= ${err.params.limit}`;
        case 'maximum':
            return `${path} must be <= ${err.params.limit}`;
        case 'const':
            return `${path} must equal ${JSON.stringify(err.params.allowedValue)}`;
        case 'not': {
            // Method-level: type 'action' but with 'params' attached.
            if (/\/methods\/\d+$/.test(err.instancePath || '')) {
                return `${path} has type 'action' but includes 'params'. Use type 'actions' when params are present, or remove 'params' for type 'action'.`;
            }
            // Adapter-level: model picked but a field that doesn't belong to
            // that model is present (e.g. USB2Serial with leftover `ip`/`uuid`
            // from a previous iTach config, or iTach with a `com`). Look at
            // the adapter and call out exactly which extra fields are the
            // problem — the bare "matched a disallowed pattern" reads like
            // we're rejecting the address itself, which is misleading.
            const adapterMatch = /^\/adapters\/(\d+)$/.exec(err.instancePath || '');
            if (adapterMatch && json && Array.isArray(json.adapters)) {
                const adapter = json.adapters[Number(adapterMatch[1])];
                if (adapter && typeof adapter === 'object') {
                    const FORBIDDEN_BY_MODEL = {
                        iTachIP2SL: ['com'],
                        iTachIP2CC: ['com'],
                        GenericNetworkAdapter: ['uuid', 'com'],
                        USB2Serial: ['uuid', 'ip'],
                    };
                    const ADDRESS_FIELD = {
                        iTachIP2SL: 'ip',
                        iTachIP2CC: 'ip',
                        GenericNetworkAdapter: 'ip',
                        USB2Serial: 'com',
                    };
                    const forbidden = FORBIDDEN_BY_MODEL[adapter.model] || [];
                    const present = forbidden.filter((f) => f in adapter);
                    if (present.length > 0) {
                        const list = present.map((f) => `'${f}'`).join(' and ');
                        const correct = ADDRESS_FIELD[adapter.model];
                        const hint = correct
                            ? ` ${adapter.model} adapters use '${correct}' instead.`
                            : '';
                        return `${path} has ${list} set, which ${adapter.model} adapters don't use — remove ${present.length === 1 ? 'it' : 'them'}.${hint}`;
                    }
                }
            }
            return `${path} matched a disallowed pattern`;
        }
        default:
            return `${path} ${err.message}`;
    }
}

function runSchemaValidation(json) {
    const validate = getValidator();
    const ok = validate(json);
    if (ok) return [];
    // Ajv emits a cascade of errors when if/then/anyOf branches fail. The first
    // concrete error is usually the most actionable; the rest are noise from
    // upstream conditional wrappers. Prefer non-'if'/'anyOf' errors when present.
    const errors = validate.errors || [];
    const informative = errors.filter(
        (e) => e.keyword !== 'if' && e.keyword !== 'anyOf' && e.keyword !== 'allOf'
    );
    const chosen = informative.length > 0 ? informative : errors;
    return chosen.map((err) => ({
        source: 'schema',
        pointer: err.instancePath || '',
        path: friendlyPath(err.instancePath, json),
        message: formatSchemaError(err, json),
    }));
}

function findPortMethodParam(json, commandRef) {
    const [portId, methodId, paramId] = commandRef.split('.');
    let foundPort = null;
    let foundAdapter = null;
    if (json.adapters) {
        for (const adapter of json.adapters) {
            if (!adapter.ports) continue;
            const p = adapter.ports.find((pp) => pp.id === portId);
            if (p) {
                foundPort = p;
                foundAdapter = adapter;
                break;
            }
        }
    }
    if (!foundPort) return { error: `unknown port '${portId}'` };
    if (!methodId) return { port: foundPort };

    // iTachIP2CC ports get a 'power' method with on/off params auto-injected by
    // the transform pass. Cross-ref validation runs before that, so we have to
    // recognize the synthetic method here. Returns synthetic objects matching
    // what applyITachIP2CCMethods would produce, so transform's resolveScenes
    // (which also calls this) gets the same shape after methods are injected.
    if (foundAdapter.model === 'iTachIP2CC' && !foundPort.methods) {
        if (methodId !== 'power') {
            return {
                error: `unknown method '${methodId}' on port '${portId}' (iTachIP2CC ports only expose 'power')`,
            };
        }
        const syntheticMethod = { id: 'power', name: 'Power' };
        if (!paramId) return { port: foundPort, method: syntheticMethod };
        if (paramId !== 'on' && paramId !== 'off') {
            return {
                error: `unknown param '${paramId}' on method '${portId}.power' (iTachIP2CC only supports 'on'/'off')`,
            };
        }
        return {
            port: foundPort,
            method: syntheticMethod,
            param: {
                id: paramId,
                name: paramId === 'on' ? 'On' : 'Off',
                position: foundPort.position,
            },
        };
    }

    const method = (foundPort.methods || []).find((m) => m.id === methodId);
    if (!method) {
        return { error: `unknown method '${methodId}' on port '${portId}'` };
    }
    if (!paramId) return { port: foundPort, method };
    const param = (method.params || []).find((p) => p.id === paramId);
    if (!param) {
        return {
            error: `unknown param '${paramId}' on method '${portId}.${methodId}'`,
        };
    }
    return { port: foundPort, method, param };
}

function runCrossRefValidation(json) {
    const errors = [];

    if (Array.isArray(json.scenes)) {
        json.scenes.forEach((scene, i) => {
            if (!Array.isArray(scene.commands)) return;
            scene.commands.forEach((commandRef, j) => {
                const result = findPortMethodParam(json, commandRef);
                if (result.error) {
                    const pointer = `/scenes/${i}/commands/${j}`;
                    errors.push({
                        source: 'cross-ref',
                        pointer,
                        path: friendlyPath(pointer, json),
                        message: `Scene '${scene.id}' references ${result.error} in command '${commandRef}'`,
                    });
                }
            });
        });
    }

    if (json.rules && typeof json.rules === 'object') {
        Object.entries(json.rules).forEach(([event, commands]) => {
            if (event === '$comment' || !Array.isArray(commands)) return;
            commands.forEach((commandRef, j) => {
                const result = findPortMethodParam(json, commandRef);
                if (result.error) {
                    const pointer = `/rules/${event}/${j}`;
                    errors.push({
                        source: 'cross-ref',
                        pointer,
                        path: friendlyPath(pointer, json),
                        message: `Rule '${event}' references ${result.error} in command '${commandRef}'`,
                    });
                }
            });
        });
    }

    return errors;
}

// Walk the raw JSON text and report any object that has the same key more
// than once. `JSON.parse` collapses duplicates silently (last wins), so by
// the time we have the parsed object the duplicates are gone — the only
// place to spot them is in the source text. Returns [{ path, key }] per
// occurrence past the first.
function findDuplicateKeys(text) {
    const dups = [];
    const stack = []; // each item: { keys: Set, label: string }
    let i = 0;

    const skipWs = () => {
        while (i < text.length && /\s/.test(text[i])) i++;
    };

    const readString = () => {
        // text[i] === '"'
        const start = i;
        i++;
        while (i < text.length) {
            if (text[i] === '\\') {
                i += 2;
                continue;
            }
            if (text[i] === '"') break;
            i++;
        }
        const raw = text.slice(start, i + 1);
        i++; // past closing "
        try {
            return JSON.parse(raw);
        } catch {
            return '';
        }
    };

    const skipValue = () => {
        skipWs();
        if (i >= text.length) return;
        const ch = text[i];
        if (ch === '"') {
            readString();
            return;
        }
        if (ch === '{') {
            parseObject();
            return;
        }
        if (ch === '[') {
            parseArray();
            return;
        }
        while (i < text.length && !/[,}\]\s]/.test(text[i])) i++;
    };

    const currentPath = () =>
        stack
            .map((s) => s.label)
            .filter(Boolean)
            .join('/') || '(root)';

    const parseObject = () => {
        i++; // past {
        const ctx = {
            keys: new Set(),
            label: stack.length > 0 ? stack[stack.length - 1].lastKey : '',
        };
        stack.push(ctx);
        skipWs();
        while (i < text.length && text[i] !== '}') {
            skipWs();
            if (text[i] !== '"') break;
            const key = readString();
            if (ctx.keys.has(key)) {
                dups.push({ path: currentPath(), key });
            } else {
                ctx.keys.add(key);
            }
            ctx.lastKey = key;
            skipWs();
            if (text[i] === ':') i++;
            skipValue();
            skipWs();
            if (text[i] === ',') {
                i++;
                continue;
            }
        }
        if (text[i] === '}') i++;
        stack.pop();
    };

    const parseArray = () => {
        i++; // past [
        skipWs();
        while (i < text.length && text[i] !== ']') {
            skipValue();
            skipWs();
            if (text[i] === ',') {
                i++;
                continue;
            }
        }
        if (text[i] === ']') i++;
    };

    skipWs();
    if (text[i] === '{') parseObject();
    else if (text[i] === '[') parseArray();
    return dups;
}

// Walk the parsed profile and flag any place where an identifier is reused
// where it shouldn't be. Port ids are globally unique because the
// cross-reference resolver finds them by id across all adapters — two ports
// with the same id mean the second is unreachable. Methods are per-port,
// params are per-method, scenes share a global id space, and response filter
// names are referenced by port `response_filter` arrays.
function runUniqueIdValidation(json) {
    const errors = [];

    const flag = (pointer, message) =>
        errors.push({
            source: 'duplicate-id',
            pointer,
            path: friendlyPath(pointer, json),
            message,
        });

    if (Array.isArray(json.adapters)) {
        // Port ids are globally unique. Zoom's command refs are `port.method`
        // with no adapter qualifier, so two ports sharing an id on different
        // adapters would be ambiguous — the resolver finds the first match
        // and the rest are unreachable via refs.
        const portSeen = new Map();
        json.adapters.forEach((adapter, ai) => {
            if (!adapter || !Array.isArray(adapter.ports)) return;
            adapter.ports.forEach((port, pi) => {
                // Skip empty ids — that's a "missing required field" /
                // pattern problem, not a duplicate. Reporting both would
                // bury the actual fix the user needs to make.
                if (!port || typeof port.id !== 'string' || port.id === '') return;
                if (portSeen.has(port.id)) {
                    const first = portSeen.get(port.id);
                    flag(
                        `/adapters/${ai}/ports/${pi}`,
                        `Port id "${port.id}" already defined at ${friendlyPath(`/adapters/${first.ai}/ports/${first.pi}`, json)}. Port ids must be globally unique — command references resolve to the first match, making this one unreachable.`
                    );
                } else {
                    portSeen.set(port.id, { ai, pi });
                }

                // Method ids per port
                if (!Array.isArray(port.methods)) return;
                const methodSeen = new Map();
                port.methods.forEach((method, mi) => {
                    // Same rationale as the empty-port-id skip above:
                    // empty method ids are flagged separately by the schema,
                    // duplicate-on-empty is just noise.
                    if (!method || typeof method.id !== 'string' || method.id === '') return;
                    if (methodSeen.has(method.id)) {
                        flag(
                            `/adapters/${ai}/ports/${pi}/methods/${mi}`,
                            `Method id "${method.id}" already defined at ${friendlyPath(`/adapters/${ai}/ports/${pi}/methods/${methodSeen.get(method.id)}`, json)} on port "${port.id}".`
                        );
                    } else {
                        methodSeen.set(method.id, mi);
                    }

                    // Param ids per method
                    if (!Array.isArray(method.params)) return;
                    const paramSeen = new Map();
                    method.params.forEach((param, ppi) => {
                        if (!param || typeof param.id !== 'string' || param.id === '') return;
                        if (paramSeen.has(param.id)) {
                            flag(
                                `/adapters/${ai}/ports/${pi}/methods/${mi}/params/${ppi}`,
                                `Param id "${param.id}" already defined at ${friendlyPath(`/adapters/${ai}/ports/${pi}/methods/${mi}/params/${paramSeen.get(param.id)}`, json)} on method "${port.id}.${method.id}".`
                            );
                        } else {
                            paramSeen.set(param.id, ppi);
                        }
                    });
                });
            });
        });
    }

    if (Array.isArray(json.scenes)) {
        const seen = new Map();
        json.scenes.forEach((scene, si) => {
            if (!scene || typeof scene.id !== 'string' || scene.id === '') return;
            if (seen.has(scene.id)) {
                flag(
                    `/scenes/${si}`,
                    `Scene id "${scene.id}" already defined at ${friendlyPath(`/scenes/${seen.get(scene.id)}`, json)}.`
                );
            } else {
                seen.set(scene.id, si);
            }
        });
    }

    if (Array.isArray(json.response_filters)) {
        const seen = new Map();
        json.response_filters.forEach((filter, fi) => {
            if (!filter || typeof filter.name !== 'string' || filter.name === '') return;
            if (seen.has(filter.name)) {
                flag(
                    `/response_filters/${fi}`,
                    `Response filter name "${filter.name}" already defined at ${friendlyPath(`/response_filters/${seen.get(filter.name)}`, json)}. Port references resolve to the first one only.`
                );
            } else {
                seen.set(filter.name, fi);
            }
        });
    }

    return errors;
}

// Walk the JSON text once and build a map from JSON pointer to the 1-based
// line number where that path appears in the source. Sibling to
// findDuplicateKeys (same parsing shape) but emits ALL paths, not just dups.
// Used to annotate validation warnings with the line they live on so the
// user can jump straight to it in the editor.
function buildPointerLineMap(text) {
    const map = new Map();
    if (typeof text !== 'string' || text.length === 0) return map;
    let i = 0;
    let line = 1;
    const stack = []; // path segments, joined with '/' for the pointer

    const skipWs = () => {
        while (i < text.length && /\s/.test(text[i])) {
            if (text[i] === '\n') line++;
            i++;
        }
    };
    const readString = () => {
        const start = i;
        i++;
        while (i < text.length) {
            if (text[i] === '\\') { i += 2; continue; }
            if (text[i] === '"') break;
            if (text[i] === '\n') line++;
            i++;
        }
        const raw = text.slice(start, i + 1);
        i++;
        try { return JSON.parse(raw); } catch { return ''; }
    };
    const skipValue = () => {
        skipWs();
        if (i >= text.length) return;
        const ch = text[i];
        if (ch === '"') { readString(); return; }
        if (ch === '{') { parseObject(); return; }
        if (ch === '[') { parseArray(); return; }
        while (i < text.length && !/[,}\]\s]/.test(text[i])) {
            if (text[i] === '\n') line++;
            i++;
        }
    };
    const ptr = () => '/' + stack.map((s) => String(s)).join('/');
    function parseObject() {
        i++; // {
        skipWs();
        while (i < text.length && text[i] !== '}') {
            skipWs();
            if (text[i] !== '"') break;
            const keyLine = line;
            const key = readString();
            stack.push(key);
            // Record the location of this child path.
            if (!map.has(ptr())) map.set(ptr(), keyLine);
            skipWs();
            if (text[i] === ':') i++;
            skipValue();
            stack.pop();
            skipWs();
            if (text[i] === ',') { i++; continue; }
        }
        if (text[i] === '}') i++;
    }
    function parseArray() {
        i++; // [
        skipWs();
        let idx = 0;
        while (i < text.length && text[i] !== ']') {
            skipWs();
            const itemLine = line;
            stack.push(idx);
            if (!map.has(ptr())) map.set(ptr(), itemLine);
            skipValue();
            stack.pop();
            idx++;
            skipWs();
            if (text[i] === ',') { i++; continue; }
        }
        if (text[i] === ']') i++;
    }

    skipWs();
    if (text[i] === '{') parseObject();
    else if (text[i] === '[') parseArray();
    return map;
}

// Find the nearest enclosing pointer in the line map. If `/a/b/c` isn't a
// key but `/a/b` is, return `/a/b`'s line — handy for "missing required
// field" errors where the field doesn't exist in the source.
function lineForPointer(map, pointer) {
    if (!pointer) return null;
    if (map.has(pointer)) return map.get(pointer);
    let p = pointer;
    while (p.length > 0) {
        const slash = p.lastIndexOf('/');
        if (slash < 0) break;
        p = p.slice(0, slash);
        if (map.has(p)) return map.get(p);
    }
    return null;
}

function runDuplicateKeyValidation(rawText) {
    if (typeof rawText !== 'string') return [];
    return findDuplicateKeys(rawText).map((d) => {
        const pointer = '/' + d.path + (d.path === '(root)' ? d.key : '/' + d.key);
        return {
            source: 'duplicate-key',
            pointer,
            path: pointer,
            message: `Duplicate key "${d.key}" in ${d.path}. JSON parsers collapse duplicates (later value wins) — remove one.`,
        };
    });
}

// Filter-specific rules that Zoom enforces at profile load and that we
// confirmed by spelunking the installer binary:
//   - USB2Serial ports cannot carry a response_filter assignment
//     (ZRCSParser::ParseFilterNames: "usb2serial device do not support
//     response filter")
//   - response_filter.trigger_event must reference a rule that exists
//     (ZRCSParser::ParseResponseFilters: "response_filter event is not
//     exist")
//   - response_filter.trigger_event must NOT collide with a built-in zr_*
//     rule name (ZRCSParser::ParseResponseFilters: "response_filter
//     trigger_event is same as built-in rule")
function runResponseFilterValidation(json) {
    const errors = [];

    // USB2Serial ports can't have a response_filter assignment.
    if (Array.isArray(json.adapters)) {
        json.adapters.forEach((adapter, ai) => {
            if (!adapter || adapter.model !== 'USB2Serial') return;
            if (!Array.isArray(adapter.ports)) return;
            adapter.ports.forEach((port, pi) => {
                if (!port || !Array.isArray(port.response_filter)) return;
                if (port.response_filter.length === 0) return;
                const pointer = `/adapters/${ai}/ports/${pi}/response_filter`;
                errors.push({
                    source: 'response-filter',
                    pointer,
                    path: friendlyPath(pointer, json),
                    message: `${friendlyPath(pointer, json)} — USB2Serial ports don't support response filters. Zoom rejects the profile at load.`,
                });
            });
        });
    }

    // Inspect every defined filter for trigger_event problems and regex
    // syntax. The schema enforces presence; this layer covers the cross-ref
    // and compile checks Zoom only does at receive time (which means a
    // broken regex would otherwise sit silent until the device replies).
    if (Array.isArray(json.response_filters)) {
        const ruleKeys = new Set(
            json.rules && typeof json.rules === 'object'
                ? Object.keys(json.rules).filter((k) => k !== '$comment')
                : []
        );
        json.response_filters.forEach((filter, fi) => {
            if (!filter || typeof filter !== 'object') return;

            // Regex syntax: Zoom defers compile to receive-time, so a bad
            // pattern in filter_regex loads fine and only crashes when data
            // arrives. Pre-compile here using JS's RegExp (same ECMAScript
            // flavor as MSVC std::regex) so the user sees it now.
            const pattern = filter.filter_regex;
            if (typeof pattern === 'string' && pattern !== '') {
                try {
                    new RegExp(pattern);
                } catch (e) {
                    const pointer = `/response_filters/${fi}/filter_regex`;
                    errors.push({
                        source: 'response-filter',
                        pointer,
                        path: friendlyPath(pointer, json),
                        message: `${friendlyPath(pointer, json)} — regex won't compile: ${e.message}. Zoom doesn't catch this at profile load; it would throw a regex_error the first time the device replied.`,
                    });
                }

                // High-bit byte detection: Zoom's receive pipeline runs the
                // incoming bytes through what looks like a UTF-8 decoder
                // before regex evaluation, so any byte > 0x7F either gets
                // dropped (lone continuation byte → invalid UTF-8) or
                // replaced with U+FFFD. Confirmed empirically: patterns
                // like \xAA, \xFF, and [\s\S]*\xAA[\s\S]* never fire even
                // when the device sends those exact bytes. Surface this as
                // a warning so the user doesn't ship a profile that works
                // in our simulator but is silently broken in production.
                const highByteHits = new Set();
                const hexRe = /\\x([0-9a-fA-F]{2})/g;
                let hexMatch;
                while ((hexMatch = hexRe.exec(pattern)) !== null) {
                    const byte = parseInt(hexMatch[1], 16);
                    if (byte > 0x7f) highByteHits.add(`\\x${hexMatch[1].toUpperCase()}`);
                }
                // Also catch any literal codepoint > 0x7F in the pattern —
                // happens if the user pasted a binary byte into the field
                // instead of typing the escape sequence.
                for (const ch of pattern) {
                    const code = ch.codePointAt(0);
                    if (code > 0x7f) {
                        const hex = code.toString(16).toUpperCase().padStart(2, '0');
                        highByteHits.add(`literal byte 0x${hex}`);
                    }
                }
                if (highByteHits.size > 0) {
                    const list = Array.from(highByteHits).join(', ');
                    const pointer = `/response_filters/${fi}/filter_regex`;
                    errors.push({
                        source: 'response-filter',
                        pointer,
                        path: friendlyPath(pointer, json),
                        message: `${friendlyPath(pointer, json)} contains high-bit bytes (${list}) — Zoom's receive pipeline drops bytes > 0x7F before regex evaluation, so these will not match anything from a real device. Use ASCII-only patterns; match a printable status code if your device sends one.`,
                    });
                }
            }

            const trigger = filter.trigger_event;
            if (typeof trigger !== 'string' || trigger === '') return; // covered elsewhere
            const pointer = `/response_filters/${fi}/trigger_event`;
            if (BUILTIN_EVENT_SET.has(trigger)) {
                errors.push({
                    source: 'response-filter',
                    pointer,
                    path: friendlyPath(pointer, json),
                    message: `${friendlyPath(pointer, json)} = "${trigger}" — this name is a built-in Zoom Room event. Zoom rejects custom filters that shadow built-in rules; pick a unique name.`,
                });
                return;
            }
            if (!ruleKeys.has(trigger)) {
                // Trigger isn't a literal rule key — but a `<port>.<method>.<param>`
                // shape that resolves against the profile's ports also counts.
                // This is the same lookup the rule-execution path does (Zoom
                // falls back to executing the named port command directly when
                // no rule matches), and it covers the iTachIP2CC case where
                // `<port>.power.on` / `<port>.power.off` are auto-generated by
                // the transform pass — those don't appear in `json.rules` but
                // are still valid trigger targets. `findPortMethodParam`
                // already has the IP2CC synthetic-method branch we need.
                let resolvesAsCommand = false;
                if (trigger.includes('.')) {
                    const result = findPortMethodParam(json, trigger);
                    if (
                        result &&
                        !result.error &&
                        result.port &&
                        result.method &&
                        result.param
                    ) {
                        resolvesAsCommand = true;
                    }
                }
                if (!resolvesAsCommand) {
                    errors.push({
                        source: 'response-filter',
                        pointer,
                        path: friendlyPath(pointer, json),
                        message: `${friendlyPath(pointer, json)} = "${trigger}" — no rule with that name is defined and it doesn't resolve as a port command. Add a rule with key "${trigger}", change the trigger_event to match an existing rule, or point it at a valid <port>.<method>.<param>.`,
                    });
                }
            }
        });
    }

    return errors;
}

// Some built-in events are semantic aliases of each other — e.g.
// `zr_meeting_started`, `zr_zoom_meeting_started`, and
// `zr_interop_meeting_started` all carry the "Meeting Started" label in
// `doc/zoom_events.csv`. Zoom fires every matching rule, so defining
// handlers for two aliases means the commands run twice on one logical
// event. The user almost never wants that — surface it as a warning.
function runOverlappingRulesValidation(json) {
    const errors = [];
    if (!json || typeof json.rules !== 'object' || json.rules === null) return errors;
    // Group rule keys by their CSV label.
    const byLabel = new Map();
    for (const key of Object.keys(json.rules)) {
        if (key === '$comment') continue;
        const entry = BUILTIN_EVENT_BY_ID.get(key);
        if (!entry) continue; // Custom event names have no semantic peer.
        if (!byLabel.has(entry.label)) byLabel.set(entry.label, []);
        byLabel.get(entry.label).push(key);
    }
    for (const [label, keys] of byLabel) {
        if (keys.length < 2) continue;
        // Emit one warning per participating rule key so each rule in the
        // builder picks up the dashed-red indicator via the existing
        // errorTargets mapping. The message names all the overlapping keys
        // so the user can see who their cohort is.
        const cohort = keys.map((k) => `"${k}"`).join(', ');
        for (const key of keys) {
            const pointer = `/rules/${key}`;
            errors.push({
                source: 'overlapping-rules',
                pointer,
                path: friendlyPath(pointer, json),
                message: `${friendlyPath(pointer, json)} — multiple rules fire on the "${label}" event (${cohort}). Zoom triggers every matching rule, so commands defined here will run alongside those in the others on the same underlying event. Pick one and remove the others, or accept the duplicate execution intentionally.`,
            });
        }
    }
    return errors;
}

// Zoom's per-model port ceilings. The iTach numbers come straight out of the
// parser's own log strings (`must config 1 device` for IP2SL, `must config
// 1-3 device` for IP2CC — see doc/zrcs-internals.md). IP2CC's three slots are
// its three relays, so a 3-relay IP2CC adapter is legitimate and must not
// warn. The other two models carry no documented limit, but a Zoom Room has
// been observed rejecting profiles that hang more than one port off a single
// adapter — so those get the softer, observation-based wording.
const MAX_PORTS_BY_MODEL = {
    iTachIP2SL: 1,
    iTachIP2CC: 3,
    GenericNetworkAdapter: 1,
    USB2Serial: 1,
};
// For the documented models the remedy follows from the hardware, not from
// JSON shape: an IP2SL has one physical COM port and an IP2CC has three
// physical relays, so "split across adapters sharing an address" — the
// right advice for a GenericNetworkAdapter endpoint fronting several logical
// devices — is meaningless for either iTach.
const PORT_LIMIT_REASON = {
    iTachIP2SL: {
        why: 'Zoom\'s IP2SL parser logs "must config 1 device" and takes exactly one port per adapter',
        fix: 'An IP2SL has a single serial port, so give each physical iTach its own adapter entry at its own address.',
    },
    iTachIP2CC: {
        why: 'Zoom\'s IP2CC parser logs "must config 1-3 device" and takes at most three relays per adapter',
        fix: 'An IP2CC has three relays — each one is a port on this same adapter with a distinct position of 1, 2, or 3.',
    },
};
const OBSERVED_PORT_LIMIT =
    'Zoom Rooms has been observed rejecting profiles that put more than one port on a single adapter';

// Advisory only — the profile is schema-valid and renders fine here. We warn
// rather than reject because the evidence is a field observation, not a
// string in the parser, and we don't want to block a config that a future
// Zoom build might accept.
function runMultiPortAdapterValidation(json) {
    const errors = [];
    if (!json || !Array.isArray(json.adapters)) return errors;
    json.adapters.forEach((adapter, ai) => {
        if (!adapter || !Array.isArray(adapter.ports)) return;
        const max = MAX_PORTS_BY_MODEL[adapter.model];
        const limit = max == null ? 1 : max;
        if (adapter.ports.length <= limit) return;
        const pointer = `/adapters/${ai}`;
        const where = friendlyPath(pointer, json);
        const n = adapter.ports.length;
        // Documented limits get flat wording; the observation-based ones stay
        // conditional, since we've only seen the rejection, not the check.
        const known = PORT_LIMIT_REASON[adapter.model];
        const message = known
            ? `${where} defines ${n} ports on one adapter. The JSON is schema-valid, but ${known.why}, so Zoom will reject this profile at load. ${known.fix}`
            : `${where} defines ${n} ports on one adapter. The JSON is valid and the profile renders here, but ${OBSERVED_PORT_LIMIT}. If Zoom rejects the profile, that is the likely cause. Split them across separate adapters — several adapters may share one address, which Zoom accepts.`;
        errors.push({
            source: 'adapter-port-count',
            pointer,
            path: where,
            message,
        });
    });
    return errors;
}
function runQuirkValidation(/* rawText, json */) {
    // No quirks at this layer right now. The previous "empty rules must be
    // literally [] with no whitespace" check turned out to be based on a
    // misreading of Zoom's actual behavior — the binary's ParseRules emits
    // `ruleMethods is empty, ruleName: <name>` for ANY empty rule.commands
    // array, regardless of whitespace. The schema already enforces
    // `minItems: 1` on both rule.commands and scene.commands, so AJV catches
    // it cleanly. Keeping this hook (returning []) so the validateProfile
    // cascade stays readable; new quirks can land here without restructuring.
    return [];
}

// Backstop for serial port settings. AJV's nested if/then branches with $ref
// schemas sometimes don't surface conditional sub-errors as cleanly as they
// should — particularly enum violations inside the model-conditional `then`
// clauses. Walk the adapters ourselves and spell out the exact allowed
// values so the user always sees "data_bits must be one of 5/6/7/8" instead
// of relying on AJV's chain-of-conditionals to bubble that up.
const USB_SERIAL_ALLOWED = {
    baud_rate: [300, 600, 1200, 1800, 2400, 4800, 7200, 9600, 14400, 19200, 28800, 38400, 115200, 230400],
    data_bits: [5, 6, 7, 8],
    parity: [0, 1, 2, 3, 4],
    stop_bits: [1, 2, 3], // 1 = 1 bit, 2 = 2 bits, 3 = 1.5 bits (per Zoom's encoding)
    flow_control: [0, 1, 2],
};
const ITACH_SERIAL_ALLOWED = {
    baud_rate: ['300', '1200', '2400', '4800', '9600', '19200', '38400', '57600', '115200'],
    flow_control: ['FLOW_NONE', 'FLOW_HARDWARE'],
    parity: ['PARITY_NO', 'PARITY_ODD', 'PARITY_EVEN'],
};
function runSerialSettingsValidation(json) {
    const errors = [];
    if (!Array.isArray(json.adapters)) return errors;
    json.adapters.forEach((adapter, ai) => {
        if (!adapter || !Array.isArray(adapter.ports)) return;
        let allowed;
        if (adapter.model === 'USB2Serial') allowed = USB_SERIAL_ALLOWED;
        else if (adapter.model === 'iTachIP2SL') allowed = ITACH_SERIAL_ALLOWED;
        else return; // Other models don't have serial settings.
        adapter.ports.forEach((port, pi) => {
            if (!port) return;
            const settings = port.settings;
            const settingsIsObject = settings && typeof settings === 'object';
            Object.entries(allowed).forEach(([field, allowedValues]) => {
                const pointer = `/adapters/${ai}/ports/${pi}/settings/${field}`;
                // Missing settings object, OR missing required field within
                // it (the model-conversion case where a port created under
                // GenericNetworkAdapter is reassigned to a serial model):
                // emit a per-field error so each dropdown can highlight
                // itself, instead of just the surrounding card.
                if (!settingsIsObject || !(field in settings)) {
                    errors.push({
                        source: 'serial-settings',
                        pointer,
                        path: friendlyPath(pointer, json),
                        message: `${friendlyPath(pointer, json)} is required for ${adapter.model} — must be one of: ${allowedValues.join(', ')}`,
                    });
                    return;
                }
                const value = settings[field];
                if (allowedValues.includes(value)) return;
                errors.push({
                    source: 'serial-settings',
                    pointer,
                    path: friendlyPath(pointer, json),
                    message: `${friendlyPath(pointer, json)} = ${JSON.stringify(value)} is not a valid ${adapter.model} value — must be one of: ${allowedValues.join(', ')}`,
                });
            });
        });
    });
    return errors;
}

function annotateLines(errors, lineMap) {
    for (const e of errors) {
        if (e.line) continue;
        const ln = lineForPointer(lineMap, e.pointer);
        if (ln) e.line = ln;
    }
    return errors;
}

export function validateProfile(rawText, json) {
    // Build the pointer→line map once per validation so every error can be
    // tagged with the line it sits on. Cheap (single text walk) and gives the
    // user something concrete to navigate to.
    const lineMap = buildPointerLineMap(rawText);

    // Duplicate-key (text-scan) and duplicate-id (parsed-object scan)
    // warnings apply regardless of schema/cross-ref state — they happen at a
    // level the other validators can't see. Always include them.
    const alwaysErrors = [
        ...runDuplicateKeyValidation(rawText),
        ...runUniqueIdValidation(json),
        ...runSerialSettingsValidation(json),
        ...runResponseFilterValidation(json),
        ...runOverlappingRulesValidation(json),
        ...runMultiPortAdapterValidation(json),
    ];

    const schemaErrors = runSchemaValidation(json);
    if (schemaErrors.length > 0) {
        return {
            ok: false,
            errors: annotateLines([...alwaysErrors, ...schemaErrors], lineMap),
        };
    }

    const crossRefErrors = runCrossRefValidation(json);
    if (crossRefErrors.length > 0) {
        return {
            ok: false,
            errors: annotateLines([...alwaysErrors, ...crossRefErrors], lineMap),
        };
    }

    const quirkErrors = runQuirkValidation(rawText, json);
    if (quirkErrors.length > 0) {
        return {
            ok: false,
            errors: annotateLines([...alwaysErrors, ...quirkErrors], lineMap),
        };
    }

    if (alwaysErrors.length > 0) {
        return { ok: false, errors: annotateLines(alwaysErrors, lineMap) };
    }

    return { ok: true, errors: [] };
}

export { findPortMethodParam };
