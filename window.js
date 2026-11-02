// The conversation window: its title strip with conversation tabs, the contact bar, the display
// images beside the transcript and the status line above the message box. SillyTavern's menus open
// as windows of their own over it, each with the title bar drawn here.

import { myIdentity, openContact, startMenuItems } from './buddy.js';
import { canUseNicknames, nameFor, openNicknames } from './lib/chat-nicknames.js';
import { toggleFlyout } from './flyout.js';
import { isOn, own } from './own.js';
import { logOffDialog, turnOffDialog } from './xpflow.js';
import { button, clickOption, el, getChatOwner, iconButton, openDrawer, openProfile, t, toggleDrawer } from './util.js';

const HEAD_ID = 'ym-head';
const IMAGES_ID = 'ym-images';
const TABS_KEY = 'ym-tabs';
const MAX_TABS = 8;
const ICON_URL = new URL('img/logo.svg', import.meta.url).href;

/** SillyTavern's menus: what each is called as a window, and how wide it reads well */
const WINDOWS = {
    'ai-config-button': ['AI Response Settings', 'sm'],
    'sys-settings-button': ['Connections', 'sm'],
    'advanced-formatting-button': ['Response Formatting', 'lg'],
    'WI-SP-button': ['World Info', 'lg'],
    'user-settings-button': ['Preferences', 'lg'],
    'backgrounds-button': ['Backgrounds', 'md'],
    'extensions-settings-button': ['Extensions', 'md'],
    'persona-management-button': ['My Profiles', 'lg'],
    rightNavHolder: ['Contacts', 'md'],
};

/** The Contacts window's title follows the page it's on */
const CONTACT_PAGES = {
    create: 'Add a Contact',
    character_edit: 'Contact Profile',
    group_create: 'Create Conference',
    group_edit: 'Edit Conference',
};

/** Conversations open as tabs: { avatar, group, name } */
let tabs = [];
let options = { settings: () => ({}), setLook: (_look) => {} };
/** SillyTavern's drawers, watched for opening and closing */
let drawers = [];
/** A tab just closed: while its chat is closing, the window mustn't open a tab for it again */
let closingTab = null;
let savedIcon = null;

/** Closes every open menu window. */
export function closeDrawers() {
    for (const content of document.querySelectorAll('#top-settings-holder .drawer-content.openDrawer')) {
        if (content.classList.contains('pinnedOpen')) {
            // windows aren't pinned and the theme hides the pins, so a pinned one gets unpinned
            /** @type {HTMLInputElement} */ (content.querySelector('input[id$="_panel_pin"]'))?.click();
        }
        const drawer = content.closest('.drawer');
        if (drawer?.id) {
            toggleDrawer(drawer.id);
        }
    }
}

export function showAbout() {
    const { callGenericPopup, POPUP_TYPE } = SillyTavern.getContext();
    const page = el('div', 'ym-about');
    const logo = el('span', 'ym-logo ym-logo-large');
    logo.setAttribute('aria-hidden', 'true');
    page.append(
        logo,
        el('h3', '', t('Yahoo Messenger theme')),
        el('p', '', t('A modern fan tribute to the Yahoo Messenger of the 2000s, for SillyTavern. Unofficial: not made by, endorsed by or connected with Yahoo. The icons here are original drawings.')),
    );
    callGenericPopup(page, POPUP_TYPE.TEXT);
}

/** The tab's icon follows the theme; SillyTavern's own comes back when it's off. */
export function setBranding(on) {
    const icon = /** @type {HTMLLinkElement|null} */ (document.querySelector('link[rel~="icon"]'));
    if (!icon) {
        return;
    }
    if (on) {
        savedIcon ??= icon.getAttribute('href');
        icon.setAttribute('href', ICON_URL);
    } else if (savedIcon !== null) {
        icon.setAttribute('href', savedIcon);
        savedIcon = null;
    }
}

function loadTabs() {
    try {
        tabs = JSON.parse(localStorage.getItem(TABS_KEY) || '[]');
    } catch {
        tabs = [];
    }
}

function saveTabs() {
    try {
        localStorage.setItem(TABS_KEY, JSON.stringify(tabs));
    } catch {
        // private windows can refuse storage; the tabs just won't come back
    }
}

function sameTab(a, b) {
    return (a.group || '') === (b.group || '') && (a.avatar || '') === (b.avatar || '');
}

/** The contact behind a tab still exists (it may have been deleted since). */
function tabExists(tab) {
    const context = SillyTavern.getContext();
    return tab.group ? context.groups.some(x => String(x.id) === tab.group) : context.characters.some(x => x.avatar === tab.avatar);
}

function closeTab(tab) {
    const index = tabs.findIndex(x => sameTab(x, tab));
    if (index === -1) {
        return;
    }
    tabs.splice(index, 1);
    saveTabs();
    closingTab = tab;
    setTimeout(() => { closingTab = null; }, 4000);
    const { group, character } = getChatOwner();
    const open = { group: group ? String(group.id) : '', avatar: character?.avatar ?? '' };
    if (sameTab(open, tab)) {
        const next = tabs[index] ?? tabs[index - 1];
        if (next) {
            openContact(next);
        } else {
            clickOption('option_close_chat');
        }
    }
    renderTabs(open);
}

function closeStartMenu() {
    const menu = document.getElementById('ym-startmenu');
    if (menu) {
        menu.hidden = true;
    }
    document.querySelector('.ym-start')?.classList.remove('ym-start-open');
}

function startItem({ label, sub, icon, run }) {
    const item = button('ym-sm-item');
    const text = el('span', '', t(label));
    if (sub) {
        text.classList.add('ym-sm-top');
        text.append(el('span', 'ym-sm-sub', t(sub)));
    }
    item.append(el('i', icon), text);
    item.addEventListener('click', () => {
        closeStartMenu();
        run();
    });
    return item;
}

/** The Start menu: your picture and name, two columns, and the bottom strip. */
function toggleStartMenu(start) {
    let menu = document.getElementById('ym-startmenu');
    if (menu && !menu.hidden) {
        closeStartMenu();
        return;
    }
    if (!menu) {
        menu = el('div');
        menu.id = 'ym-startmenu';
        menu.setAttribute('role', 'menu');
        document.body.append(own(menu));
        document.addEventListener('pointerdown', (event) => {
            const target = /** @type {Node} */ (event.target);
            if (!menu.hidden && !menu.contains(target) && !start.contains(target)) {
                closeStartMenu();
            }
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closeStartMenu();
            }
        });
    }
    const { pinned, all, right } = startMenuItems();
    const { src, name } = myIdentity();
    const head = el('div', 'ym-sm-head');
    const picture = /** @type {HTMLImageElement} */ (el('img'));
    picture.alt = '';
    picture.src = src;
    head.append(picture, el('span', '', name));
    const left = el('div', 'ym-sm-col');
    left.append(...pinned.map(startItem), el('div', 'ym-sm-sep'));
    // the most recent conversations, as Windows listed recent programs
    left.append(...tabs.slice(-5).reverse().map(tab => startItem({ label: tab.name, icon: 'fa-regular fa-comment', run: () => openContact(tab) })));
    const programs = button('ym-sm-item ym-sm-all', t('All Programs'));
    programs.addEventListener('click', () => toggleFlyout(programs, all, 'beside'));
    left.append(el('div', 'ym-sm-spacer'), el('div', 'ym-sm-sep'), programs);
    const rightColumn = el('div', 'ym-sm-col');
    right.forEach((group, index) => {
        if (index) {
            rightColumn.append(el('div', 'ym-sm-sep'));
        }
        rightColumn.append(...group.map(startItem));
    });
    const columns = el('div', 'ym-sm-cols');
    columns.append(left, rightColumn);
    const foot = el('div', 'ym-sm-foot');
    foot.append(
        startItem({ label: 'Log Off', icon: 'fa-solid fa-key', run: logOffDialog }),
        startItem({ label: 'Turn Off Computer', icon: 'fa-solid fa-power-off', run: turnOffDialog }),
    );
    menu.replaceChildren(head, el('div', 'ym-sm-line'), columns, foot);
    menu.hidden = false;
    start.classList.add('ym-start-open');
}

/* ---------- the two windows: minimise, maximise, close ---------- */

const WINDOWS_KEY = 'ym-window-state';
/** buddy: open, minimized or closed; chat: open or minimized; max: the chat fills the desktop */
let windowState = { buddy: 'open', chat: 'open', max: false };
let conversationTitle = '';
/** Which window was touched last, for the taskbar's pressed button */
let focusedWindow = 'chat';

function loadWindowState() {
    try {
        windowState = { ...windowState, ...JSON.parse(localStorage.getItem(WINDOWS_KEY) || '{}') };
    } catch {
        // the windows just start open
    }
}

/** Puts the state on the page as body classes; the buttons and the taskbar follow. */
function applyWindowState() {
    try {
        localStorage.setItem(WINDOWS_KEY, JSON.stringify(windowState));
    } catch {
        // private windows can refuse storage
    }
    const body = document.body.classList;
    body.toggle('ym-buddy-gone', windowState.buddy !== 'open');
    body.toggle('ym-chat-min', windowState.chat === 'minimized');
    body.toggle('ym-chat-max', !!windowState.max);
    renderTaskbar();
}

/** Opens the buddy list again, from the tray, the desktop icon, the taskbar or Start. */
export function showMessenger() {
    windowState.buddy = 'open';
    focusedWindow = 'buddy';
    if (windowState.max) {
        windowState.max = false;
    }
    applyWindowState();
}

function restoreChat() {
    windowState.chat = 'open';
    focusedWindow = 'chat';
    document.querySelector('.ym-task-chat')?.classList.remove('ym-task-flash');
    applyWindowState();
}

/** The real buttons on a title bar. */
function windowButtons(which) {
    const holder = el('div', 'ym-win-btns');
    const make = (kind, label, run) => {
        const item = button(`ym-win-btn ym-win-${kind}`);
        item.title = t(label);
        item.setAttribute('aria-label', t(label));
        item.addEventListener('click', (event) => {
            event.stopPropagation();
            run();
        });
        holder.append(item);
    };
    if (which === 'buddy') {
        make('min', 'Minimize', () => {
            windowState.buddy = 'minimized';
            focusedWindow = 'chat';
            applyWindowState();
        });
        make('close', 'Close', () => {
            windowState.buddy = 'closed';
            focusedWindow = 'chat';
            applyWindowState();
        });
    } else {
        make('min', 'Minimize', () => {
            windowState.chat = 'minimized';
            focusedWindow = 'buddy';
            applyWindowState();
        });
        make('max', 'Maximize', () => {
            windowState.max = !windowState.max;
            applyWindowState();
        });
        make('close', 'Close', () => {
            if (SillyTavern.getContext().getCurrentChatId()) {
                tabs = [];
                saveTabs();
                clickOption('option_close_chat');
            } else {
                windowState.chat = 'minimized';
                applyWindowState();
            }
        });
    }
    return holder;
}

/** Adds the buttons to the buddy list's title bar (the list is built after this window). */
export function addBuddyButtons(titleBar) {
    titleBar.classList.add('ym-title-live');
    titleBar.append(windowButtons('buddy'));
    document.getElementById('ym-buddy')?.addEventListener('pointerdown', () => {
        focusedWindow = 'buddy';
        renderTaskbar();
    });
}

/** The retro look's taskbar: Start, a button per open conversation, and the clock. */
function createTaskbar() {
    const bar = el('div');
    bar.id = 'ym-taskbar';
    const start = button('ym-start');
    start.append(el('span', 'ym-logo'), el('span', '', t('start')));
    start.addEventListener('click', () => toggleStartMenu(start));
    const tasks = el('div', 'ym-tasks');
    const tray = el('div', 'ym-tray');
    // Messenger lives on in the tray when its window is closed, as it always did
    const trayFace = button('ym-tray-face');
    trayFace.title = t('Open Messenger');
    trayFace.setAttribute('aria-label', t('Open Messenger'));
    trayFace.append(el('span', 'ym-face ym-face-available'));
    trayFace.addEventListener('click', showMessenger);
    tray.append(trayFace, el('span', 'ym-clock'));
    const shortcut = button('ym-desk-icon');
    shortcut.append(el('span', 'ym-desk-pic'), el('span', 'ym-desk-name', t('Messenger')));
    shortcut.title = t('Open Messenger');
    shortcut.addEventListener('click', showMessenger);
    document.body.append(own(shortcut));
    bar.append(start, tasks, tray);
    document.body.append(own(bar));
    const tick = () => {
        if (isOn()) {
            tray.lastElementChild.textContent = SillyTavern.getContext().timestampToMoment(Date.now()).format('LT');
        }
    };
    tick();
    setInterval(tick, 20000);
}

/** Two buttons, as the windows are two: Messenger, and the conversation under its current name. */
function renderTaskbar() {
    const tasks = document.querySelector('#ym-taskbar .ym-tasks');
    if (!tasks) {
        return;
    }
    const flashing = tasks.querySelector('.ym-task-flash');
    const task = (cls, label, active, run) => {
        const item = button(`ym-task ${cls}${active ? ' ym-task-active' : ''}`);
        item.title = label;
        item.append(el('span', 'ym-logo'), el('span', 'ym-task-name', label));
        item.addEventListener('click', run);
        return item;
    };
    const items = [];
    if (windowState.buddy !== 'closed') {
        items.push(task('ym-task-buddy', t('Messenger'), windowState.buddy === 'open' && focusedWindow === 'buddy', () => {
            // a press on the window in front minimizes it, as on Windows
            if (windowState.buddy === 'open' && focusedWindow === 'buddy') {
                windowState.buddy = 'minimized';
                focusedWindow = 'chat';
                applyWindowState();
            } else {
                showMessenger();
            }
        }));
    }
    const chat = task('ym-task-chat', conversationTitle, windowState.chat === 'open' && focusedWindow === 'chat', () => {
        if (windowState.chat === 'open' && focusedWindow === 'chat') {
            windowState.chat = 'minimized';
            focusedWindow = 'buddy';
            applyWindowState();
        } else {
            restoreChat();
        }
    });
    chat.classList.toggle('ym-task-flash', !!flashing && windowState.chat === 'minimized');
    items.push(chat);
    tasks.replaceChildren(...items);
}

function renderTabs(current) {
    const strip = document.querySelector(`#${HEAD_ID} .ym-tabs`);
    if (!strip) {
        return;
    }
    strip.replaceChildren(...tabs.map((tab) => {
        const active = sameTab(tab, current);
        const item = button(`ym-tab${active ? ' ym-tab-active' : ''}`);
        item.title = tab.name;
        item.setAttribute('aria-current', String(active));
        item.append(el('span', 'ym-tab-name', tab.name));
        const close = el('span', 'ym-tab-close fa-solid fa-xmark');
        close.setAttribute('role', 'button');
        close.title = t('Close tab');
        close.addEventListener('click', (event) => {
            event.stopPropagation();
            closeTab(tab);
        });
        item.append(close);
        item.addEventListener('click', () => openContact(tab));
        return item;
    }));
}

/** A chat with no character or group behind it: SillyTavern's temporary chat with the assistant. */
function isTemporaryChat() {
    const chat = document.getElementById('chat');
    if (!chat?.querySelector('.mes')) {
        return false;
    }
    return !chat.querySelector('.welcomePanel') || !!chat.querySelector('.mes[is_user="true"]');
}

function imageUrl(folder, file) {
    return new URL(`${folder}/${encodeURIComponent(file)}`, document.baseURI).href;
}

function refreshImages(group, character) {
    const holder = document.getElementById(IMAGES_ID);
    if (!holder) {
        return;
    }
    const context = SillyTavern.getContext();
    const them = /** @type {HTMLElement} */ (holder.querySelector('.ym-di-them'));
    them.replaceChildren();
    them.classList.toggle('ym-di-group', !!group);
    const picture = (src, name) => {
        const img = /** @type {HTMLImageElement} */ (el('img'));
        img.alt = name;
        img.title = name;
        img.decoding = 'async';
        img.src = src;
        return img;
    };
    if (group) {
        for (const member of (group.members ?? []).slice(0, 12)) {
            const name = context.characters.find(x => x.avatar === member)?.name ?? '';
            them.append(picture(context.getThumbnailUrl('avatar', member), name));
        }
    } else if (character) {
        them.append(picture(imageUrl('characters', character.avatar), character.name));
    }
    const me = /** @type {HTMLImageElement} */ (holder.querySelector('.ym-di-me img'));
    const selected = document.querySelector('#user_avatar_block .avatar-container.selected');
    const id = selected?.getAttribute('data-avatar-id') || selected?.getAttribute('imgfile') || context.powerUserSettings?.default_persona;
    if (id) {
        me.src = imageUrl('User Avatars', id);
        me.alt = context.name1 ?? '';
        me.title = context.name1 ?? '';
    }
}

/** Puts the open chat in the window: tabs, contact bar and display images. */
export function refreshWindow() {
    const head = document.getElementById(HEAD_ID);
    if (!head || !isOn()) {
        return;
    }
    const context = SillyTavern.getContext();
    const { group, character } = getChatOwner();
    const temporary = !group && !character && isTemporaryChat();
    const hasChat = !!(group || character || temporary);
    const body = document.body.classList;
    body.toggle('ym-no-chat', !hasChat);
    body.toggle('ym-in-group', !!group);
    body.toggle('ym-solo', !!character);

    const current = { group: group ? String(group.id) : '', avatar: character?.avatar ?? '' };
    if (group || character) {
        const name = group?.name ?? nameFor(character.avatar, character.name);
        const index = tabs.findIndex(x => sameTab(x, current));
        if (closingTab && sameTab(closingTab, current)) {
            // still closing
        } else if (index === -1) {
            tabs.push({ ...current, name });
            if (tabs.length > MAX_TABS) {
                tabs.shift();
            }
        } else {
            tabs[index].name = name;
        }
    }
    tabs = tabs.filter(tabExists);
    saveTabs();
    renderTabs(current);

    const picture = /** @type {HTMLElement} */ (head.querySelector('.ym-who .ym-pic'));
    picture.classList.toggle('ym-pic-group', !!group);
    picture.replaceChildren();
    const addImage = (src) => {
        const img = /** @type {HTMLImageElement} */ (el('img'));
        img.alt = '';
        img.src = src;
        picture.append(img);
    };
    let name = '';
    let detail = '';
    if (group) {
        (group.members ?? []).slice(0, 4).forEach(member => addImage(context.getThumbnailUrl('avatar', member)));
        name = group.name;
        detail = `${(group.members ?? []).length} ${t('in this conference')}`;
    } else if (character) {
        addImage(context.getThumbnailUrl('avatar', character.avatar));
        picture.append(el('span', 'ym-face ym-face-available'));
        name = nameFor(character.avatar, character.name);
        detail = context.getCurrentChatId() ?? '';
    } else if (temporary) {
        addImage('img/five.png');
        name = context.name2 || t('Assistant');
        detail = t('Temporary chat');
    }
    /** @type {HTMLElement} */ (head.querySelector('.ym-who-name')).textContent = name;
    const small = /** @type {HTMLElement} */ (head.querySelector('.ym-who-detail'));
    small.textContent = detail;
    small.title = detail;
    /** @type {HTMLElement} */ (head.querySelector('.ym-title-text')).textContent = hasChat ? name : t('Welcome to Messenger');
    conversationTitle = hasChat ? `${t('Chat with')} ${name}` : t('Welcome to Messenger');
    renderTaskbar();
    refreshImages(group, character);
}

function createHead() {
    const sheld = document.getElementById('sheld');
    if (!sheld || document.getElementById(HEAD_ID)) {
        return;
    }
    const head = el('div');
    head.id = HEAD_ID;

    const title = el('div', 'ym-title ym-title-conv');
    const back = iconButton('ym-back', t('Back to contacts'), 'fa-solid fa-arrow-left');
    back.addEventListener('click', () => document.body.classList.remove('ym-m-chat'));
    const logo = el('span', 'ym-logo');
    logo.setAttribute('aria-hidden', 'true');
    title.classList.add('ym-title-live');
    title.append(back, logo, el('span', 'ym-title-text'), el('nav', 'ym-tabs'), windowButtons('chat'));

    const bar = el('div', 'ym-contact-bar');
    const who = button('ym-who');
    who.title = t('View profile');
    const names = el('span', 'ym-who-names');
    names.append(el('span', 'ym-who-name'), el('span', 'ym-who-detail'));
    who.append(el('span', 'ym-pic'), names);
    who.addEventListener('click', openProfile);

    const actions = el('div', 'ym-actions');
    const action = (label, text, icon, run) => {
        const item = button('ym-action');
        item.title = t(label);
        item.append(el('i', icon), el('span', '', t(text)));
        item.addEventListener('click', () => run(item));
        return item;
    };
    actions.append(
        action('Start a new conversation', 'New', 'fa-regular fa-pen-to-square', () => clickOption('option_start_new_chat')),
        action('Conversation history', 'History', 'fa-solid fa-clock-rotate-left', () => clickOption('option_select_chat')),
        action('View profile', 'Profile', 'fa-regular fa-id-card', openProfile),
        action('More options', 'More', 'fa-solid fa-ellipsis', item => toggleFlyout(item, [
            ...(canUseNicknames() ? [{ label: 'Nicknames in this chat', icon: 'fa-solid fa-signature', run: openNicknames }] : []),
            { label: 'Rename conversation', icon: 'fa-solid fa-i-cursor', run: () => clickOption('option_select_chat') },
            {
                label: options.settings().displayImages ? 'Hide display images' : 'Show display images',
                icon: 'fa-regular fa-image',
                run: () => {
                    const input = /** @type {HTMLInputElement|null} */ (document.getElementById('ym_display_images'));
                    if (input) {
                        input.checked = !input.checked;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                },
            },
            { label: 'Close conversation', icon: 'fa-solid fa-xmark', run: () => clickOption('option_close_chat') },
        ], 'below-end')),
    );
    bar.append(who, actions);
    head.append(title, bar);
    sheld.prepend(own(head));

    const images = el('div');
    images.id = IMAGES_ID;
    const me = el('div', 'ym-di-me');
    me.append(/** @type {HTMLImageElement} */ (el('img')));
    me.addEventListener('click', () => openDrawer('persona-management-button'));
    const them = el('div', 'ym-di-them');
    them.addEventListener('click', openProfile);
    images.append(them, me);
    sheld.append(own(images));
}

/** The title bar every menu window wears, and the dimmed page behind it. */
function createWindowBar() {
    const scrim = el('div');
    scrim.id = 'ym-scrim';
    const bar = el('div', 'ym-title');
    bar.id = 'ym-window-bar';
    const logo = el('span', 'ym-logo');
    logo.setAttribute('aria-hidden', 'true');
    const close = iconButton('ym-window-close', t('Close'), 'fa-solid fa-xmark');
    close.addEventListener('click', closeDrawers);
    bar.append(logo, el('span', 'ym-title-text'), close);
    // SillyTavern closes a menu on any press outside it, and this bar is part of the window
    for (const type of ['mousedown', 'touchstart']) {
        bar.addEventListener(type, event => event.stopPropagation());
    }
    document.body.append(own(scrim), own(bar));
}

/**
 * Mirrors which menu is open as body classes, so the styles don't need page-wide :has() checks,
 * which would re-check the page on every streamed word. Also re-run after the frame is put back.
 */
export function refreshDrawerState() {
    if (!isOn()) {
        return;
    }
    const open = drawers.find(drawer => drawer.querySelector(':scope > .drawer-content.openDrawer'));
    const body = document.body.classList;
    body.toggle('ym-menu-open', !!open);
    const [label, size] = (open && WINDOWS[open.id]) ?? [open?.querySelector('.drawer-icon')?.getAttribute('title') ?? '', 'md'];
    for (const name of ['sm', 'md', 'lg']) {
        body.toggle(`ym-win-${name}`, !!open && size === name);
    }
    if (open) {
        const text = document.querySelector('#ym-window-bar .ym-title-text');
        if (text) {
            const page = open.id === 'rightNavHolder' ? CONTACT_PAGES[document.getElementById('right-nav-panel')?.dataset.menuType] : null;
            text.textContent = t(page ?? label);
        }
    }
}

function trackDrawers() {
    drawers = [...document.querySelectorAll('#top-settings-holder > .drawer')];
    const observer = new MutationObserver(refreshDrawerState);
    for (const drawer of drawers) {
        const known = WINDOWS[drawer.id];
        if (known) {
            drawer.setAttribute('data-ym-known', '');
        }
        const content = drawer.querySelector(':scope > .drawer-content');
        if (content) {
            observer.observe(content, { attributes: true, attributeFilter: ['class'] });
        }
    }
    const contacts = document.getElementById('right-nav-panel');
    if (contacts) {
        observer.observe(contacts, { attributes: true, attributeFilter: ['data-menu-type'] });
    }
    refreshDrawerState();
}

export function initWindow(config) {
    options = config;
    loadTabs();
    createHead();
    createWindowBar();
    loadWindowState();
    createTaskbar();
    applyWindowState();
    document.getElementById('sheld')?.addEventListener('pointerdown', () => {
        focusedWindow = 'chat';
        renderTaskbar();
    });
    trackDrawers();
    refreshWindow();

    const { eventSource, eventTypes } = SillyTavern.getContext();
    eventSource.on(eventTypes.CHAT_CHANGED, () => {
        if (isOn() && SillyTavern.getContext().getCurrentChatId() && windowState.chat === 'minimized') {
            restoreChat();
        }
    });
    eventSource.on(eventTypes.MESSAGE_RECEIVED, () => {
        if (isOn() && windowState.chat === 'minimized') {
            document.querySelector('.ym-task-chat')?.classList.add('ym-task-flash');
        }
    });
    for (const type of [eventTypes.GROUP_UPDATED, eventTypes.CHARACTER_EDITED, eventTypes.CHARACTER_RENAMED, eventTypes.CHARACTER_DELETED, eventTypes.PERSONA_CHANGED]) {
        if (type) {
            eventSource.on(type, refreshWindow);
        }
    }
    // a temporary chat has no character and SillyTavern opens it without an event, so watch the messages
    let pending = 0;
    new MutationObserver(() => {
        if (!isOn() || pending) {
            return;
        }
        pending = requestAnimationFrame(() => {
            pending = 0;
            refreshWindow();
        });
    }).observe(document.getElementById('chat'), { childList: true });
}
