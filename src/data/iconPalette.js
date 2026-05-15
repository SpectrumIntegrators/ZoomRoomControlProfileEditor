// Icon-palette data: the Zoom built-in icon names plus a curated list of
// Material Design Icons grouped by likely AV-control use. Imported by the
// palette drawer in HomeView and the focus tracker by BuilderPanel.

// Zoom's officially documented built-in icons (per
// `C:\Users\JonathanDean\Desktop\zoom-rooms-icons.csv`). These are the
// values the user pastes into an `icon` field. `icon_alert` and
// `icon_water` exist in our PNG assets (carried forward from the original
// fork) but Zoom doesn't document them — kept on disk as a runtime fallback
// for unknown names but left out of the palette so users don't pick names
// that may or may not actually render on Zoom Rooms.
//
// Note on `icon_dry`: documented under that name, but the actual asset
// Zoom's site uses for it is the one named `icon_water.png`
// (https://assets.zoom.us/images/en-us/zoom-rooms/controller/room-control-icons/icon_water.png).
// We map it via `ZOOM_ICON_ASSET_ALIASES` so the palette tile for
// `icon_dry` renders the same image but the value pasted into the profile
// is still the documented `icon_dry` string.
// Maps documented Zoom icon names to the asset filename we actually have
// on disk when they differ. Used by both the preview renderer and the
// palette so the user sees the right image whichever name they reference.
export const ZOOM_ICON_ASSET_ALIASES = {
    icon_dry: 'icon_water',
};

export const ZOOM_BUILTIN_ICONS = [
    'icon_air_conditioner',
    'icon_cable_tv',
    'icon_ceiling_mic',
    'icon_cold',
    'icon_curtain',
    'icon_down',
    'icon_dry',
    'icon_dvd_player',
    'icon_game_console',
    'icon_hdmi',
    'icon_hot',
    'icon_laptop',
    'icon_light',
    'icon_power',
    'icon_projector',
    'icon_rack_equipment',
    'icon_satellite_dish',
    'icon_speaker',
    'icon_speakerphone',
    'icon_tv',
    'icon_up',
    'icon_wind',
];

// Material Icons (Google), curated for AV control profiles. Each category
// is a small focused set rather than a wall of every available glyph —
// covers the typical "device, button, status, navigation" needs without
// burying the user. Values render via the Material Icons font face that's
// already loaded for the rest of the UI; the value the user pastes into
// an `icon` field is `mdi:<name>` for filled (default) or
// `mdi:<name>:<style>` for outlined / rounded / sharp / two_tone.
export const MDI_STYLES = ['filled', 'outlined', 'rounded', 'sharp', 'two_tone'];

// Tight AV-control set. Zoom Room profiles are fire-and-forget commands
// with no feedback, no toggle states, and no status reporting, so the
// palette only carries icons that map to an action you'd actually wire to
// a button: power, source switching, display, lighting, climate, shades,
// audio level, media transport, basic motion. No "sync problem,"
// "precision manufacturing," "admin panel settings," etc. — those exist
// in Material Icons but have nowhere meaningful to live in a Zoom Room
// UI. If something's missing, add it explicitly here rather than
// category-trawling.
export const MDI_ICON_CATEGORIES = [
    {
        label: 'Power',
        icons: [
            'power_settings_new', 'power_off', 'restart_alt',
        ],
    },
    {
        label: 'Display',
        icons: [
            'tv', 'monitor', 'cast', 'present_to_all', 'screen_share',
            'fullscreen', 'aspect_ratio',
        ],
    },
    {
        label: 'Audio',
        icons: [
            'volume_up', 'volume_down', 'volume_mute', 'volume_off',
            'mic', 'mic_off', 'headphones', 'speaker',
        ],
    },
    {
        label: 'Camera',
        icons: [
            'videocam', 'videocam_off', 'video_camera_front', 'photo_camera',
        ],
    },
    {
        label: 'Sources',
        icons: [
            'input', 'switch_video', 'cable',
        ],
    },
    {
        label: 'Lighting',
        icons: [
            'lightbulb', 'lightbulb_outline', 'light_mode', 'dark_mode',
            'brightness_high', 'brightness_medium', 'brightness_low',
        ],
    },
    {
        label: 'Climate',
        icons: [
            'ac_unit', 'thermostat', 'whatshot', 'air',
        ],
    },
    {
        label: 'Shades',
        icons: [
            'curtains', 'curtains_closed', 'blinds', 'blinds_closed',
        ],
    },
    {
        label: 'Media',
        icons: [
            'play_arrow', 'pause', 'stop',
            'skip_next', 'skip_previous', 'fast_forward', 'fast_rewind',
        ],
    },
    {
        label: 'Motion',
        icons: [
            'arrow_upward', 'arrow_downward', 'arrow_back', 'arrow_forward',
            'chevron_left', 'chevron_right',
        ],
    },
];

// Flat lookup for "is this a recognized MDI name?" (used by validators).
export const MDI_ICON_NAMES = new Set(
    MDI_ICON_CATEGORIES.flatMap((cat) => cat.icons)
);

// Last-focused icon input tracker. Updated by every `.icon-input` /
// `.scene-icon` field's @focus handler, read by the icon-palette drawer
// when the user clicks an icon. If the saved element is still in the DOM
// and editable, the palette types the icon value into it; otherwise it
// falls back to copying the value to the clipboard so the user can paste
// it wherever they actually want it.
//
// Held in a plain mutable object (not a Vue ref) because the consumer side
// only reads it on click, and we don't want every focus change to
// re-render anyone. The element reference is non-reactive on purpose.
export const iconFocusTracker = {
    el: null,
    set(el) {
        if (el && typeof el === 'object' && 'value' in el) {
            this.el = el;
        }
    },
    clear() {
        this.el = null;
    },
    // Best-effort: only return the element if it's still attached, still an
    // input, and not disabled. Anything else is stale and the consumer
    // should fall back to clipboard.
    take() {
        const el = this.el;
        if (!el) return null;
        if (!el.isConnected) { this.el = null; return null; }
        if (el.tagName !== 'INPUT' || el.disabled) { this.el = null; return null; }
        return el;
    },
};

// Tags an element as "part of the icon-palette UI" so the focus-tracker
// listener below doesn't clear the saved icon-input when the user clicks
// a palette tile or the palette's own search/style inputs. Used by class
// name `.icon-palette-internal` in HomeView's drawer markup.
function isPaletteInternal(el) {
    return !!(el && typeof el.closest === 'function' && el.closest('.palette-drawer'));
}

function isIconInput(el) {
    if (!el || el.tagName !== 'INPUT') return false;
    return el.classList.contains('icon-input') || el.classList.contains('scene-icon');
}

function isEditable(el) {
    if (!el) return false;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
    if (el.isContentEditable) return true;
    return false;
}

// Install a document-level focusin listener that keeps the tracker honest:
//   - Focus moves to an icon-input → set tracker.
//   - Focus moves to another editable field (and NOT inside the palette
//     drawer) → clear tracker, because the user is clearly editing
//     something else now and the icon-palette click should fall back to
//     clipboard rather than redirect into the stale field.
//   - Focus moves to a button / palette internals / non-editable → leave
//     the tracker alone. (Clicking the palette toggle moves focus to the
//     toolbar button; we want the originally-focused icon-input to still
//     be the target when the user picks an icon next.)
// Idempotent — calling more than once is a no-op.
let listenerInstalled = false;
export function installIconFocusListener(doc = document) {
    if (listenerInstalled) return;
    listenerInstalled = true;
    doc.addEventListener('focusin', (event) => {
        const target = event.target;
        if (isIconInput(target)) {
            iconFocusTracker.set(target);
            return;
        }
        if (isPaletteInternal(target)) return;
        if (isEditable(target)) {
            iconFocusTracker.clear();
        }
        // Buttons and other non-editable focusables: ignore (tracker stays).
    });
}
