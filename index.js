// Yahoo Messenger theme: toggles the scoped styles in style.css, builds the two windows (buddy list
// and conversation) around SillyTavern and exposes a small settings panel.

import { initBuddyList, markCurrent, refreshMe, scheduleRefresh } from './buddy.js';
import { registerNicknames } from './lib/chat-nicknames.js';
import { applyCustomize, emptyCustomize, normalizeCustomize, openCustomize } from './customize.js';
import { registerExtensionSwitch } from './lib/theme-extensions.js';
import { registerTheme, reloadPage } from './lib/theme-exclusive.js';
import { refreshBuzzMarks, initMessenger } from './messenger.js';
import { isOn, parkOwned, restoreOwned } from './own.js';
import { initSharpImages } from './sharp.js';
import { initTimes, labelMessages } from './times.js';
import { isPhone, t } from './util.js';
import { initWindow, refreshDrawerState, refreshWindow, setBranding } from './window.js';

const MODULE_NAME = 'yahooMessengerTheme';
/** Folder path under scripts/extensions/, e.g. third-party/SillyTavern-YahooMessenger */
const EXTENSION_FOLDER = new URL('.', import.meta.url).pathname
    .replace(/^.*\/scripts\/extensions\//, '')
    .replace(/\/$/, '');
const BODY_CLASS = 'yahoo-messenger';

const defaultSettings = Object.freeze({
    enabled: true,
    /** light, dark or system */
    appearance: 'light',
    /** transcript or bubbles */
    messageStyle: 'transcript',
    /** What a contact's second line shows: message, about or none */
    listLines: 'message',
    displayImages: true,
    tabs: true,
    presence: true,
    shortTimes: true,
    sounds: true,
    useBackground: true,
    /** Your status: available, busy, away or invisible, with a message of your own */
    status: 'available',
    statusText: '',
    /** Extensions picked to turn off with the theme, and the ones it has turned off */
    switchExtensions: [],
    switchedExtensions: [],
    /** While the theme is on, SillyTavern's own UI theme preset and Custom CSS are paused */
    pauseUserTheme: true,
    /** Customize page: { version, tokens, flags, css }, layered on the appearance */
    customize: { version: 1, tokens: {}, flags: {}, css: '' },
});

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
let customizeChecked = false;
/** init() has run, so the frame may be built */
let ready = false;
/** The frame has been built (it may be parked while the theme is off) */
let built = false;
/** @type {Promise<void>|null} */
let building = null;
/** One theme at a time: set up in init() */
let exclusive = { activated: () => {}, changed: () => {} };
/** Extensions the person picked to turn off while the theme is on */
const extensionSwitch = registerExtensionSwitch({
    settings: getSettings,
    isEnabled: () => !!getSettings().enabled,
    reload: message => reloadPage(message),
});

function getSettings() {
    const { extensionSettings } = SillyTavern.getContext();
    if (!extensionSettings[MODULE_NAME]) {
        extensionSettings[MODULE_NAME] = structuredClone(defaultSettings);
    }
    const settings = extensionSettings[MODULE_NAME];
    for (const key of Object.keys(defaultSettings)) {
        if (!Object.hasOwn(settings, key)) {
            settings[key] = structuredClone(defaultSettings[key]);
        }
    }
    // cleaned once per load (hand edits)
    if (!customizeChecked) {
        settings.customize = normalizeCustomize(settings.customize);
        customizeChecked = true;
    }
    return settings;
}

function saveSettings() {
    SillyTavern.getContext().saveSettingsDebounced();
}

function isDark(settings) {
    return settings.appearance === 'dark' || (settings.appearance === 'system' && darkQuery.matches);
}

/** Body classes that follow a setting while the theme is on */
const SETTING_CLASSES = {
    'ym-dark': isDark,
    'ym-bubbles': settings => settings.messageStyle === 'bubbles',
    'ym-images-on': settings => settings.displayImages,
    'ym-tabs-on': settings => settings.tabs,
    'ym-presence-on': settings => settings.presence,
    'ym-short-times': settings => settings.shortTimes,
    'ym-use-bg': settings => settings.useBackground,
};

function applySettings() {
    const settings = getSettings();
    const on = !!settings.enabled;
    const body = document.body.classList;
    body.toggle(BODY_CLASS, on);
    document.documentElement.classList.toggle('ym-html', on);
    for (const [name, test] of Object.entries(SETTING_CLASSES)) {
        body.toggle(name, on && !!test(settings));
    }
    if (!on) {
        // the frame's own state classes (open menus, phone pane, home)
        body.remove(...[...body].filter(name => name.startsWith('ym-') && name !== 'ym-booting' && name !== 'ym-boot-done'));
    }
    setBranding(on);
    applyCustomize(settings.customize, on);
    // the windows exist only while the theme is on: built the first time it's turned on, taken
    // out when it's switched off, and put back as they were when it's on again
    if (!on) {
        parkOwned();
    } else if (built) {
        restoreOwned();
        refreshFrame();
    } else if (ready) {
        build();
    }
}

/** Opens the Customize page; changes show at once and are saved as they're made. */
function customizeTheme() {
    const settings = getSettings();
    return openCustomize({
        get: () => settings.customize,
        set: (value) => { settings.customize = value ?? emptyCustomize(); },
        changed: () => {
            applySettings();
            saveSettings();
        },
    });
}

/** Phones show one window at a time: the buddy list, or the open conversation. */
function showChatOnPhone() {
    if (isPhone()) {
        document.body.classList.add('ym-m-chat');
    }
}

function setAppearance(appearance) {
    const settings = getSettings();
    settings.appearance = appearance;
    applySettings();
    saveSettings();
    const select = /** @type {HTMLSelectElement} */ (document.getElementById('ym_appearance'));
    if (select) {
        select.value = appearance;
    }
}

function onChatChanged(chatId) {
    if (!isOn()) {
        return;
    }
    refreshWindow();
    refreshMe();
    if (chatId) {
        showChatOnPhone();
    } else {
        document.body.classList.remove('ym-m-chat');
    }
}

async function renderSettingsPanel() {
    const { renderExtensionTemplateAsync } = SillyTavern.getContext();
    const html = await renderExtensionTemplateAsync(EXTENSION_FOLDER, 'settings');
    const container = document.getElementById('extensions_settings2');
    if (!container || document.querySelector('.ym-settings')) {
        return;
    }
    container.insertAdjacentHTML('beforeend', html);

    const settings = getSettings();
    const checkbox = (id, key, after) => {
        const input = /** @type {HTMLInputElement} */ (document.getElementById(id));
        input.checked = !!settings[key];
        return [input, key, () => input.checked, after];
    };
    const select = (id, key, after) => {
        const input = /** @type {HTMLSelectElement} */ (document.getElementById(id));
        input.value = settings[key];
        return [input, key, () => input.value, after];
    };

    const controls = [
        // turning the theme on turns the other themes off and reloads the page; off applies live
        checkbox('ym_enabled', 'enabled', () => {
            if (settings.enabled) {
                exclusive.activated();
                extensionSwitch.sync();
                reloadWhenOn('Yahoo Messenger is on.');
            } else {
                exclusive.changed();
                if (extensionSwitch.sync()) {
                    reloadPage(SillyTavern.getContext().translate('Extensions updated.'));
                }
            }
        }),
        checkbox('ym_pause_user_theme', 'pauseUserTheme', () => exclusive.changed()),
        select('ym_appearance', 'appearance'),
        select('ym_message_style', 'messageStyle'),
        select('ym_list_lines', 'listLines', () => scheduleRefresh(0)),
        checkbox('ym_display_images', 'displayImages'),
        checkbox('ym_tabs', 'tabs'),
        checkbox('ym_presence', 'presence'),
        checkbox('ym_short_times', 'shortTimes', () => labelMessages()),
        checkbox('ym_sounds', 'sounds'),
        checkbox('ym_use_background', 'useBackground'),
    ];
    for (const [element, key, read, after] of controls) {
        element.addEventListener('input', () => {
            settings[key] = read();
            applySettings();
            saveSettings();
            after?.();
        });
    }
    document.getElementById('ym_customize')?.addEventListener('click', () => customizeTheme());
    await extensionSwitch.renderPicker(document.getElementById('ym_extension_switch'));
}

async function init() {
    exclusive = registerTheme({
        id: 'yahoomessenger',
        name: 'Yahoo Messenger',
        folder: EXTENSION_FOLDER.split('/').pop(),
        settingsKey: MODULE_NAME,
        bodyClass: BODY_CLASS,
        isEnabled: () => !!getSettings().enabled,
        disable: () => {
            getSettings().enabled = false;
            applySettings();
            const toggle = /** @type {HTMLInputElement|null} */ (document.getElementById('ym_enabled'));
            if (toggle) {
                toggle.checked = false;
            }
            saveSettings();
            if (extensionSwitch.sync()) {
                reloadPage(SillyTavern.getContext().translate('Extensions updated.'));
            }
        },
        pauseUserTheme: () => !!getSettings().pauseUserTheme,
    });
    darkQuery.addEventListener('change', applySettings);
    ready = true;
    applySettings();
    if (building) {
        await building;
    }
    endBoot();

    try {
        await renderSettingsPanel();
    } catch (error) {
        console.error('[Yahoo Messenger] Could not render the settings panel', error);
    }
}

/** Builds the windows around SillyTavern; once, the first time the theme is on. */
function build() {
    built = true;
    building = buildFrame();
    return building;
}

async function buildFrame() {
    const options = {
        settings: getSettings,
        save: saveSettings,
        setAppearance,
        customize: customizeTheme,
        opened: showChatOnPhone,
    };
    registerNicknames({
        isOn,
        changed: () => {
            refreshWindow();
            refreshMe();
            scheduleRefresh(0);
        },
        t,
    });
    initWindow(options);
    initMessenger(options);
    const listLoaded = initBuddyList(options);
    applySettings();
    initTimes();
    initSharpImages();

    const { eventSource, eventTypes } = SillyTavern.getContext();
    eventSource.on(eventTypes.CHAT_CHANGED, onChatChanged);
    onChatChanged(SillyTavern.getContext().getCurrentChatId());
    markCurrent();
    await Promise.race([listLoaded, delay(3000)]);
}

/** Brings the windows up to date after they were put back (things may have changed while out). */
function refreshFrame() {
    refreshDrawerState();
    refreshWindow();
    markCurrent();
    scheduleRefresh(0);
    labelMessages();
    refreshBuzzMarks();
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/** Lifts the loading screen once the windows have painted. */
function endBoot() {
    const body = document.body;
    if (!body.classList.contains('ym-booting')) {
        return;
    }
    requestAnimationFrame(() => requestAnimationFrame(() => {
        body.classList.add('ym-boot-done');
        setTimeout(() => body.classList.remove('ym-booting', 'ym-boot-done'), 250);
    }));
}

/** The loading screen from the moment this code loads (SillyTavern has its settings by then). */
function bootLook() {
    const settings = SillyTavern.getContext().extensionSettings?.[MODULE_NAME];
    if (settings?.enabled === false) {
        return;
    }
    document.body.classList.add('ym-booting');
    if (settings) {
        applyCustomize(normalizeCustomize(settings.customize), true);
    }
    // never leave the cover up if something fails on the way
    setTimeout(endBoot, 20000);
    document.body.classList.toggle('ym-dark', !!settings && isDark({ ...defaultSettings, ...settings }));
}

/**
 * Reloads the page once the settings are saved, so the theme starts from a fresh page whenever
 * it's loaded into one that's already running. Called on a user's action only (installing,
 * turning on, updating), so it can't repeat by itself.
 */
function reloadWhenOn(message) {
    if (getSettings().enabled) {
        reloadPage(SillyTavern.getContext().translate(message), { stillWanted: () => !!getSettings().enabled });
    }
}

/** SillyTavern calls this right after installing the extension and loading it (manifest "hooks"). */
export function onInstall() {
    reloadWhenOn('Yahoo Messenger is installed.');
}

/**
 * SillyTavern calls this after updating the extension. The running code is the old version, so
 * the page reloads to load the new one.
 */
export function onUpdate() {
    reloadWhenOn('Yahoo Messenger was updated.');
}

bootLook();

const { eventSource, eventTypes } = SillyTavern.getContext();
eventSource.on(eventTypes.APP_READY, init);
