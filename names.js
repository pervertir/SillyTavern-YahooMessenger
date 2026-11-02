// Nicknames in every list: the theme's own rows ask for displayText(), and SillyTavern's lists are painted over
// their text nodes, remembering the real text, so nothing is saved and turning the theme off puts it all back.
// The character editor's form is left alone: it edits the real name.

import { USER, applyNicknames, nameFor } from './lib/chat-nicknames.js';
import { getChatOwner } from './util.js';

/** SillyTavern's lists, watched because they redraw as pages and filters change */
const LISTS = '#rm_print_characters_block, #rm_group_members, #rm_group_add_members, #user_avatar_block, #select_chat_div';
const NAME_PARTS = '.ch_name, .persona_name, .select_chat_block_mes, .characterName, .chatMessage';

const realText = new WeakMap();
let pending = 0;

/** Every name with a nickname right now: the open chat's people by their closest one, others by their everywhere one. */
function allRenames() {
    const context = SillyTavern.getContext();
    const { group, character } = getChatOwner();
    const inChat = new Set(group ? group.members ?? [] : character ? [character.avatar] : []);
    const list = context.characters.map(x => ({ name: x.name, nickname: nameFor(x.avatar, x.name, inChat.has(x.avatar) ? '' : 'another chat') }));
    list.push({ name: context.name1, nickname: nameFor(USER, context.name1) });
    return list.filter(x => x.name && x.nickname !== x.name).sort((a, b) => b.name.length - a.name.length);
}

/** A list of nicknames to use for a whole pass of rows: building it once keeps big libraries quick. */
export function currentRenames() {
    return allRenames();
}

/** Text with nicknames in place of names. */
export function displayText(text, list = allRenames()) {
    return list.length ? applyNicknames(text, list) : String(text ?? '');
}

function paintNode(node, list) {
    let known = realText.get(node);
    // drawn anew since we were last here
    if (!known || known.shown !== node.data) {
        if (!list.length) {
            return;
        }
        known = { real: node.data };
    }
    const shown = displayText(known.real, list);
    if (node.data !== shown) {
        node.data = shown;
    }
    known.shown = shown;
    realText.set(node, known);
}

/** Paints SillyTavern's lists now; with the theme off the list is empty, which puts the real text back. */
export function paintNames() {
    const list = allRenames();
    for (const part of document.querySelectorAll(`:is(${LISTS}, #chat .welcomePanel) :is(${NAME_PARTS})`)) {
        const walker = document.createTreeWalker(part, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            paintNode(node, list);
        }
    }
}

function schedulePaint() {
    if (!pending) {
        pending = requestAnimationFrame(() => {
            pending = 0;
            paintNames();
        });
    }
}

export function initNames() {
    const observer = new MutationObserver(schedulePaint);
    for (const list of document.querySelectorAll(LISTS)) {
        observer.observe(list, { childList: true, subtree: true });
    }
    const { eventSource, eventTypes } = SillyTavern.getContext();
    for (const type of [eventTypes.CHAT_CHANGED, eventTypes.CHARACTER_PAGE_LOADED, eventTypes.PERSONA_CHANGED, eventTypes.GROUP_UPDATED]) {
        if (type) {
            eventSource.on(type, schedulePaint);
        }
    }
    schedulePaint();
}
