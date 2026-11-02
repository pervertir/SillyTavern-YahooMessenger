// Nicknames for what the theme works out for itself, such as searching the buddy list. The shared chat-nicknames.js
// paints the page's text, titles and tooltips, so nothing is saved and turning the theme off puts it all back.

import { USER, applyNicknames, nameFor } from './lib/chat-nicknames.js';
import { getChatOwner } from './util.js';

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
