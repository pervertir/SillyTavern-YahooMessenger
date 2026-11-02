// The buddy list window: the menu bar, your picture and status, search, and every contact in
// collapsible groups (Favorites, Friends, Conferences). Characters are friends, groups conferences.

import { toggleFlyout } from './flyout.js';
import { formatListTime } from './times.js';
import { buzz } from './messenger.js';
import { isOn, own } from './own.js';
import { button, clickOption, el, iconButton, openDrawer, t, toPreview, toggleDrawer } from './util.js';
import { closeDrawers, showAbout } from './window.js';

const LIST_ID = 'ym-buddy';
const COLLAPSED_KEY = 'ym-collapsed-groups';
/** Rows drawn per group until "Show more": a big library must stay quick */
const PAGE = 150;

const STATUSES = [
    ['available', 'Available', 'ym-face-available'],
    ['busy', 'Busy', 'ym-face-busy'],
    ['away', 'Be right back', 'ym-face-away'],
    ['invisible', 'Invisible', 'ym-face-invisible'],
];

let options = { settings: () => ({}), save: () => {}, setAppearance: (_a) => {}, customize: () => {}, opened: () => {} };
/** Last chat of each contact, from SillyTavern's recent chats: avatar or group id → { preview, time, last } */
let recent = new Map();
let filterText = '';
let requestId = 0;
let refreshTimer = 0;
/** Groups showing more than a page */
const expanded = new Set();

function getCollapsed() {
    try {
        return JSON.parse(localStorage.getItem(COLLAPSED_KEY) || '[]');
    } catch {
        return [];
    }
}

function setCollapsed(list) {
    try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify(list));
    } catch {
        // private windows can refuse storage; the group just won't remember
    }
}

/** Opens a character's latest chat, or a group's. */
export async function openContact({ avatar, group }) {
    const context = SillyTavern.getContext();
    if (group) {
        if (String(context.groupId) !== String(group)) {
            // SillyTavern opens a group from a click on a .group_select card; a stand-in card
            // reaches the same handlers when the real one is on another page of its list
            const card = el('div', 'group_select ym-hidden-card');
            card.setAttribute('data-grid', group);
            document.body.append(own(card));
            card.click();
            card.remove();
            await new Promise((resolve) => {
                context.eventSource.once(context.eventTypes.CHAT_CHANGED, resolve);
                setTimeout(resolve, 5000);
            });
        }
    } else {
        const id = context.characters.findIndex(x => x.avatar === avatar);
        if (id !== -1 && (String(context.characterId) !== String(id) || context.groupId)) {
            await context.selectCharacterById(id);
        }
    }
    options.opened();
}

function isCurrent({ avatar, group }) {
    const context = SillyTavern.getContext();
    if (group) {
        return String(context.groupId) === String(group);
    }
    return !context.groupId && context.characters[context.characterId]?.avatar === avatar;
}

/** The favorite star, saved the way SillyTavern's own bulk edit saves it. */
async function toggleFavorite(avatar) {
    const context = SillyTavern.getContext();
    const character = context.characters.find(x => x.avatar === avatar);
    if (!character) {
        return;
    }
    if (isCurrent({ avatar })) {
        /** @type {HTMLElement|null} */ (document.getElementById('favorite_button'))?.click();
    } else {
        const fav = !(character.fav === true || character.fav === 'true');
        const response = await fetch('/api/characters/merge-attributes', {
            method: 'POST',
            headers: context.getRequestHeaders(),
            body: JSON.stringify({ avatar, fav, data: { extensions: { fav } } }),
        });
        if (!response.ok) {
            toastr.error(t('Could not save that.'));
            return;
        }
        await context.getCharacters();
    }
    scheduleRefresh(200);
}

function isFavorite(character) {
    return character.fav === true || character.fav === 'true';
}

function openRowMenu(anchor, place) {
    const items = [{ label: 'Send message', icon: 'fa-regular fa-comment', run: () => openContact(place) }];
    items.push({
        label: 'Conversation history', icon: 'fa-solid fa-clock-rotate-left', run: async () => {
            await openContact(place);
            clickOption('option_select_chat');
        },
    });
    items.push({
        label: place.group ? 'Edit conference' : 'View profile', icon: 'fa-regular fa-id-card', run: async () => {
            await openContact(place);
            openDrawer('rightNavHolder');
        },
    });
    if (!place.group) {
        const character = SillyTavern.getContext().characters.find(x => x.avatar === place.avatar);
        items.push(character && isFavorite(character)
            ? { label: 'Remove from Favorites', icon: 'fa-solid fa-star', run: () => toggleFavorite(place.avatar) }
            : { label: 'Add to Favorites', icon: 'fa-regular fa-star', run: () => toggleFavorite(place.avatar) });
    }
    toggleFlyout(anchor, items, 'below-end');
}

function aboutLine(text) {
    return toPreview(text);
}

/** One contact's row. */
function buildRow({ key, name, thumb, members, avatar, group, detail, time }) {
    const row = el('div', 'ym-row');
    row.setAttribute('role', 'button');
    row.tabIndex = 0;
    row.dataset.key = key;
    if (avatar) {
        row.dataset.avatar = avatar;
    }
    if (group) {
        row.dataset.group = group;
    }
    row.title = name;

    const picture = el('span', `ym-pic${group ? ' ym-pic-group' : ''}`);
    for (const src of thumb ? [thumb] : members) {
        const img = /** @type {HTMLImageElement} */ (el('img'));
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.src = src;
        picture.append(img);
    }
    if (!group) {
        picture.append(el('span', 'ym-face ym-face-available'));
    }

    const text = el('span', 'ym-row-text');
    const top = el('span', 'ym-row-top');
    top.append(el('span', 'ym-row-name', name));
    if (time) {
        top.append(el('span', 'ym-row-time', time));
    }
    text.append(top);
    if (detail) {
        text.append(el('span', 'ym-row-detail', detail));
    }
    row.append(picture, text, iconButton('ym-row-more', t('More options'), 'fa-solid fa-ellipsis'));
    return row;
}

function buildGroup(id, label, rows, total, online) {
    const collapsed = getCollapsed().includes(id) && !filterText;
    const section = el('section', 'ym-group');
    section.dataset.group = id;
    section.classList.toggle('ym-group-collapsed', collapsed);

    const head = button('ym-group-head');
    head.setAttribute('aria-expanded', String(!collapsed));
    head.append(el('i', 'fa-solid fa-caret-down'), el('span', 'ym-group-name', label), el('span', 'ym-group-count', `(${online}/${total})`));
    const body = el('div', 'ym-group-rows');
    const shown = expanded.has(id) ? rows : rows.slice(0, PAGE);
    body.append(...shown.map(buildRow));
    if (shown.length < rows.length) {
        const more = button('ym-show-more', t('Show more'));
        more.dataset.more = id;
        body.append(more);
    }
    section.append(head, body);
    return section;
}

function render() {
    const body = document.querySelector(`#${LIST_ID} .ym-list`);
    if (!body) {
        return;
    }
    const context = SillyTavern.getContext();
    const lines = options.settings().listLines;
    const needle = filterText.trim().toLowerCase();
    const matches = (name, detail) => !needle || name.toLowerCase().includes(needle) || (detail ?? '').toLowerCase().includes(needle);
    const byRecent = (a, b) => (b.last - a.last) || a.name.localeCompare(b.name);

    const friends = [];
    const favorites = [];
    for (const character of context.characters) {
        const seen = recent.get(character.avatar);
        const detail = lines === 'none' ? '' : lines === 'about' ? aboutLine(character.creatorcomment || character.data?.creator_notes) : (seen?.preview ?? '');
        if (!matches(character.name, seen?.preview)) {
            continue;
        }
        const row = {
            key: `c_${character.avatar}`,
            name: character.name,
            avatar: character.avatar,
            thumb: context.getThumbnailUrl('avatar', character.avatar),
            detail,
            time: seen?.time ?? '',
            last: seen?.last ?? 0,
        };
        (isFavorite(character) ? favorites : friends).push(row);
    }
    const conferences = [];
    for (const group of context.groups) {
        const seen = recent.get(String(group.id));
        const names = (group.members ?? []).map(m => context.characters.find(x => x.avatar === m)?.name).filter(Boolean);
        if (!matches(group.name, names.join(' '))) {
            continue;
        }
        conferences.push({
            key: `g_${group.id}`,
            name: group.name,
            group: String(group.id),
            members: (group.members ?? []).slice(0, 4).map(m => context.getThumbnailUrl('avatar', m)),
            detail: lines === 'none' ? '' : lines === 'about' ? names.join(', ') : (seen?.preview || names.join(', ')),
            time: seen?.time ?? '',
            last: seen?.last ?? 0,
        });
    }
    for (const list of [favorites, friends, conferences]) {
        list.sort(byRecent);
    }

    const sections = [];
    if (favorites.length) {
        sections.push(buildGroup('favorites', t('Favorites'), favorites, favorites.length, favorites.length));
    }
    sections.push(buildGroup('friends', t('Friends'), friends, friends.length, friends.length));
    if (conferences.length) {
        sections.push(buildGroup('conferences', t('Conferences'), conferences, conferences.length, conferences.length));
    }
    body.replaceChildren(...sections);
    if (needle && !favorites.length && !friends.length && !conferences.length) {
        body.replaceChildren(el('div', 'ym-list-empty', t('Nobody by that name')));
    } else if (!context.characters.length && !context.groups.length) {
        const add = button('menu_button ym-primary', t('Add a contact'));
        add.addEventListener('click', () => openCharacters('rm_button_create'));
        const empty = el('div', 'ym-list-empty', t('No contacts yet.'));
        empty.append(add);
        body.replaceChildren(empty);
    }
    markCurrent();
}

/** Moves the highlight to the open chat without building the list again. */
export function markCurrent() {
    for (const row of document.querySelectorAll(`#${LIST_ID} .ym-row`)) {
        const current = isCurrent({ avatar: row.dataset.avatar, group: row.dataset.group });
        row.classList.toggle('ym-row-active', current);
        if (current) {
            row.setAttribute('aria-current', 'true');
        } else {
            row.removeAttribute('aria-current');
        }
    }
}

async function refreshList() {
    const context = SillyTavern.getContext();
    const id = ++requestId;
    let data = [];
    try {
        const response = await fetch('/api/chats/recent', {
            method: 'POST',
            headers: context.getRequestHeaders(),
            body: JSON.stringify({ max: 200 }),
            cache: 'no-cache',
        });
        if (response.ok) {
            data = await response.json();
        }
    } catch (error) {
        console.warn('[Yahoo Messenger] Could not load recent chats', error);
    }
    // a newer refresh started while this one was waiting
    if (id !== requestId || !Array.isArray(data)) {
        return;
    }
    recent = new Map();
    for (const chat of data) {
        const key = chat.group ? String(chat.group) : chat.avatar;
        const last = context.timestampToMoment(chat.last_mes)?.valueOf() || 0;
        if (key && !(recent.get(key)?.last > last)) {
            recent.set(key, { preview: toPreview(chat.mes), time: formatListTime(chat.last_mes), last });
        }
    }
    render();
}

/** Refreshes after a pause, so a burst of events costs one request. */
export function scheduleRefresh(delay = 600) {
    clearTimeout(refreshTimer);
    if (!isOn()) {
        return;
    }
    refreshTimer = setTimeout(refreshList, delay);
}

function openCharacters(buttonId) {
    openDrawer('rightNavHolder');
    /** @type {HTMLElement|null} */ (document.getElementById(buttonId))?.click();
}

/** A temporary chat starts from SillyTavern's welcome screen, so any open chat closes first. */
async function startTemporaryChat() {
    const context = SillyTavern.getContext();
    if (context.getCurrentChatId()) {
        clickOption('option_close_chat');
        await new Promise((resolve) => {
            context.eventSource.once(context.eventTypes.CHAT_CHANGED, resolve);
            setTimeout(resolve, 3000);
        });
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    /** @type {HTMLElement|null} */ (document.querySelector('#chat .openTemporaryChat'))?.click();
    options.opened();
}

/** The menu bar's menus, each entry one of SillyTavern's functions. */
function menus() {
    const dark = document.body.classList.contains('ym-dark');
    const panel = (label, icon, id) => ({ label, icon, run: () => openDrawer(id) });
    return {
        Messenger: () => {
            const items = [
                panel('Connections', 'fa-solid fa-plug', 'sys-settings-button'),
                panel('AI Response Settings', 'fa-solid fa-sliders', 'ai-config-button'),
                panel('Response Formatting', 'fa-solid fa-font', 'advanced-formatting-button'),
                panel('Preferences', 'fa-solid fa-gear', 'user-settings-button'),
                panel('Backgrounds', 'fa-regular fa-image', 'backgrounds-button'),
                panel('Extensions', 'fa-solid fa-cubes', 'extensions-settings-button'),
                { label: 'Customize theme', icon: 'fa-solid fa-palette', run: () => options.customize() },
                dark
                    ? { label: 'Switch to light', icon: 'fa-regular fa-sun', run: () => options.setAppearance('light') }
                    : { label: 'Switch to dark', icon: 'fa-regular fa-moon', run: () => options.setAppearance('dark') },
            ];
            // buttons other extensions added to the top bar; the click goes to the icon, where some of them listen
            for (const drawer of document.querySelectorAll('#top-settings-holder > .drawer:not([data-ym-known])')) {
                const icon = /** @type {HTMLElement} */ (drawer.querySelector('.drawer-icon'));
                if (icon) {
                    items.push({ label: icon.title || drawer.id, icon: [...icon.classList].filter(name => /^fa-(?!fw$)/.test(name)).join(' '), run: () => icon.click() });
                }
            }
            return items;
        },
        Contacts: () => [
            { label: 'Contact list', icon: 'fa-regular fa-address-book', run: () => openCharacters('rm_button_characters') },
            { label: 'Add a contact', icon: 'fa-solid fa-user-plus', run: () => openCharacters('rm_button_create') },
            { label: 'Import a contact', icon: 'fa-solid fa-file-import', run: () => openCharacters('character_import_button') },
            { label: 'New conference', icon: 'fa-solid fa-user-group', run: () => openCharacters('rm_button_group_chats') },
            panel('My profiles', 'fa-regular fa-id-badge', 'persona-management-button'),
            panel('World Info', 'fa-solid fa-book-atlas', 'WI-SP-button'),
        ],
        Actions: () => [
            { label: 'New conversation', icon: 'fa-regular fa-pen-to-square', run: () => clickOption('option_start_new_chat') },
            { label: 'Conversation history', icon: 'fa-solid fa-clock-rotate-left', run: () => clickOption('option_select_chat') },
            { label: 'Temporary chat', icon: 'fa-regular fa-comment-dots', run: startTemporaryChat },
            { label: 'Buzz!', icon: 'fa-solid fa-bolt', run: buzz },
            { label: 'Close conversation', icon: 'fa-solid fa-xmark', run: () => clickOption('option_close_chat') },
        ],
        Help: () => [
            { label: 'SillyTavern documentation', icon: 'fa-regular fa-circle-question', run: () => window.open('https://docs.sillytavern.app/', '_blank', 'noopener') },
            { label: 'About this theme', icon: 'fa-solid fa-circle-info', run: showAbout },
        ],
    };
}

function statusInfo(id) {
    return STATUSES.find(x => x[0] === id) ?? STATUSES[0];
}

/** Puts your picture, name and status in the window. */
export function refreshMe(avatarId) {
    const me = document.getElementById('ym-me');
    if (!me) {
        return;
    }
    const context = SillyTavern.getContext();
    /** @type {HTMLElement} */ (me.querySelector('.ym-me-name')).textContent = context.name1 ?? '';
    const selected = document.querySelector('#user_avatar_block .avatar-container.selected');
    const id = avatarId || selected?.getAttribute('data-avatar-id') || selected?.getAttribute('imgfile') || context.powerUserSettings?.default_persona;
    const img = /** @type {HTMLImageElement} */ (me.querySelector('.ym-pic img'));
    if (id) {
        img.src = context.getThumbnailUrl('persona', id);
    }
    const settings = options.settings();
    const [, label, face] = statusInfo(settings.status);
    /** @type {HTMLElement} */ (me.querySelector('.ym-face')).className = `ym-face ${face}`;
    /** @type {HTMLElement} */ (me.querySelector('.ym-me-status-label')).textContent = t(label);
    const input = /** @type {HTMLInputElement} */ (me.querySelector('.ym-me-message'));
    if (document.activeElement !== input) {
        input.value = settings.statusText ?? '';
    }
}

function createMe() {
    const me = el('div');
    me.id = 'ym-me';
    const picture = button('ym-pic ym-me-pic');
    picture.title = t('My profiles');
    const img = /** @type {HTMLImageElement} */ (el('img'));
    img.alt = '';
    picture.append(img, el('span', 'ym-face ym-face-available'));
    picture.addEventListener('click', () => openDrawer('persona-management-button'));

    const info = el('div', 'ym-me-info');
    const status = button('ym-me-status');
    status.title = t('Change my status');
    status.append(el('span', 'ym-me-status-label'), el('i', 'fa-solid fa-caret-down'));
    status.addEventListener('click', () => toggleFlyout(status, STATUSES.map(([id, label, face]) => ({
        label,
        icon: `ym-face ${face}`,
        run: () => {
            options.settings().status = id;
            options.save();
            refreshMe();
        },
    })), 'below-start'));
    const line = el('div', 'ym-me-line');
    line.append(el('span', 'ym-me-name'), status);
    const message = /** @type {HTMLInputElement} */ (el('input', 'ym-me-message'));
    message.type = 'text';
    message.maxLength = 80;
    message.placeholder = t('What are you up to?');
    message.setAttribute('aria-label', t('Status message'));
    message.addEventListener('input', () => {
        options.settings().statusText = message.value;
        options.save();
    });
    info.append(line, message);
    me.append(picture, info);
    return me;
}

function createBuddyList() {
    const list = el('aside');
    list.id = LIST_ID;
    list.setAttribute('aria-label', t('Contacts'));

    const title = el('div', 'ym-title ym-title-buddy');
    const logo = el('span', 'ym-logo');
    logo.setAttribute('aria-hidden', 'true');
    title.append(logo, el('span', 'ym-title-text', 'Messenger'));

    const bar = el('nav', 'ym-menubar');
    const all = menus();
    for (const name of Object.keys(all)) {
        const item = button('ym-menubar-item', t(name));
        // the entries depend on the moment (light or dark, other extensions), so they're built on opening
        item.addEventListener('click', () => toggleFlyout(item, menus()[name](), 'below-start'));
        bar.append(item);
    }

    const search = el('label', 'ym-search');
    const input = /** @type {HTMLInputElement} */ (el('input'));
    input.type = 'search';
    input.placeholder = t('Find a contact or message');
    input.setAttribute('aria-label', t('Find a contact or message'));
    input.addEventListener('input', () => {
        filterText = input.value;
        render();
    });
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            input.value = '';
            filterText = '';
            render();
        }
    });
    search.append(el('i', 'fa-solid fa-magnifying-glass'), input);

    const body = el('div', 'ym-list');
    body.addEventListener('click', (event) => {
        const target = /** @type {HTMLElement} */ (event.target);
        const head = target.closest('.ym-group-head');
        if (head) {
            const group = /** @type {HTMLElement} */ (head.closest('.ym-group'));
            const collapsed = group.classList.toggle('ym-group-collapsed');
            head.setAttribute('aria-expanded', String(!collapsed));
            const ids = new Set(getCollapsed());
            collapsed ? ids.add(group.dataset.group) : ids.delete(group.dataset.group);
            setCollapsed([...ids]);
            return;
        }
        const more = /** @type {HTMLElement} */ (target.closest('.ym-show-more'));
        if (more) {
            expanded.add(more.dataset.more);
            render();
            return;
        }
        const row = /** @type {HTMLElement} */ (target.closest('.ym-row'));
        if (!row) {
            return;
        }
        const place = { avatar: row.dataset.avatar, group: row.dataset.group };
        const menu = /** @type {HTMLElement} */ (target.closest('.ym-row-more'));
        if (menu) {
            openRowMenu(menu, place);
        } else {
            closeDrawers();
            openContact(place);
        }
    });
    body.addEventListener('contextmenu', (event) => {
        const row = /** @type {HTMLElement} */ (/** @type {HTMLElement} */ (event.target).closest?.('.ym-row'));
        if (row) {
            event.preventDefault();
            openRowMenu(/** @type {HTMLElement} */ (row.querySelector('.ym-row-more')), { avatar: row.dataset.avatar, group: row.dataset.group });
        }
    });
    body.addEventListener('keydown', (event) => {
        const row = /** @type {HTMLElement} */ (event.target);
        if (row.classList?.contains('ym-row') && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            row.click();
        }
    });

    const foot = el('div', 'ym-buddy-foot');
    const tool = (label, icon, run) => {
        const item = iconButton('ym-tool', t(label), icon);
        item.addEventListener('click', run);
        return item;
    };
    foot.append(
        tool('Add a contact', 'fa-solid fa-user-plus', () => openCharacters('rm_button_create')),
        tool('New conference', 'fa-solid fa-user-group', () => openCharacters('rm_button_group_chats')),
        tool('Contact list', 'fa-regular fa-address-book', () => openCharacters('rm_button_characters')),
        tool('World Info', 'fa-solid fa-book-atlas', () => toggleDrawer('WI-SP-button')),
        tool('Connections', 'fa-solid fa-plug', () => toggleDrawer('sys-settings-button')),
        tool('Preferences', 'fa-solid fa-gear', () => toggleDrawer('user-settings-button')),
    );

    list.append(title, bar, createMe(), search, body, foot);
    document.body.append(own(list));
}

/**
 * @param {typeof options} config
 * @returns {Promise<void>} Resolves once the list has its first contacts.
 */
export function initBuddyList(config) {
    options = config;
    createBuddyList();
    refreshMe();

    const { eventSource, eventTypes } = SillyTavern.getContext();
    eventSource.on(eventTypes.CHAT_CHANGED, () => {
        markCurrent();
        scheduleRefresh(300);
    });
    for (const type of [eventTypes.MESSAGE_SENT, eventTypes.MESSAGE_RECEIVED, eventTypes.MESSAGE_DELETED, eventTypes.MESSAGE_EDITED,
        eventTypes.CHAT_DELETED, eventTypes.GROUP_CHAT_DELETED, eventTypes.CHAT_CREATED, eventTypes.GROUP_CHAT_CREATED,
        eventTypes.CHARACTER_DELETED, eventTypes.CHARACTER_RENAMED, eventTypes.CHARACTER_EDITED, eventTypes.CHARACTER_DUPLICATED,
        eventTypes.CHARACTER_PAGE_LOADED, eventTypes.GROUP_UPDATED]) {
        if (type) {
            eventSource.on(type, () => scheduleRefresh());
        }
    }
    eventSource.on(eventTypes.PERSONA_CHANGED, id => isOn() && refreshMe(id));
    eventSource.on(eventTypes.PERSONA_RENAMED, () => isOn() && refreshMe());
    eventSource.on(eventTypes.SETTINGS_UPDATED, () => isOn() && refreshMe());
    return refreshList();
}
