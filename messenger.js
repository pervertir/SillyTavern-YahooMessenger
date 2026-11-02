// What makes it a messenger: the format bar with emoticons and Buzz, the "is typing a message" status
// line, and the sounds.

import { isOn, own } from './own.js';
import { button, el, getChatOwner, iconButton, t } from './util.js';

const BUZZ_TEXT = 'BUZZ!!!';
const BUZZ_MESSAGE = /^\s*\**BUZZ!+\**\s*$/i;
const EMOTICONS = ['😀', '😄', '😉', '😍', '😘', '😎', '🤓', '😂', '😅', '🙂', '🙃', '😐', '🤔', '🙄', '😴', '😭', '😢', '😡', '😱', '🤯', '🥳', '🤗', '🤫', '😇', '👍', '👎', '👋', '🙏', '👏', '💪', '❤️', '💔', '🌹', '☕', '🍕', '🎉', '⭐', '🌙', '🔥', '⚡'];

let options = { settings: () => ({}) };
/** @type {AudioContext|null} */
let audio = null;

function textarea() {
    return /** @type {HTMLTextAreaElement} */ (document.getElementById('send_textarea'));
}

/** Writes into SillyTavern's message box and lets it know (it resizes and saves the draft on input). */
function changed(box, start, end) {
    box.focus();
    box.setSelectionRange(start, end);
    box.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Wraps the selection in Markdown, or puts the cursor between the marks. */
function wrap(before, after = before) {
    const box = textarea();
    const { selectionStart: a, selectionEnd: b, value } = box;
    box.value = value.slice(0, a) + before + value.slice(a, b) + after + value.slice(b);
    changed(box, a + before.length, b + before.length);
}

/** Starts the selected lines (or the current one) with a mark. */
function prefixLines(mark) {
    const box = textarea();
    const { selectionStart: a, selectionEnd: b, value } = box;
    const start = value.lastIndexOf('\n', a - 1) + 1;
    const lines = value.slice(start, b).split('\n').map(line => mark + line).join('\n');
    box.value = value.slice(0, start) + lines + value.slice(b);
    changed(box, start + lines.length, start + lines.length);
}

function insert(text) {
    const box = textarea();
    const { selectionStart: a, selectionEnd: b, value } = box;
    box.value = value.slice(0, a) + text + value.slice(b);
    changed(box, a + text.length, a + text.length);
}

/* ---------- sounds: small Web Audio tones, nothing recorded ---------- */

function tone(frequency, at, length, type = 'sine', volume = 0.09) {
    audio ??= new AudioContext();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, audio.currentTime + at);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + at + length);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(audio.currentTime + at);
    oscillator.stop(audio.currentTime + at + length);
}

function playMessage() {
    if (options.settings().sounds) {
        tone(880, 0, 0.14);
        tone(1320, 0.11, 0.22);
    }
}

function playBuzz() {
    if (options.settings().sounds) {
        for (let i = 0; i < 6; i++) {
            tone(i % 2 ? 150 : 110, i * 0.06, 0.07, 'square', 0.05);
        }
    }
}

/* ---------- Buzz ---------- */

function shake() {
    const sheld = document.getElementById('sheld');
    sheld?.classList.remove('ym-buzzing');
    // restarts the animation when two buzzes land close together
    void sheld?.offsetWidth;
    sheld?.classList.add('ym-buzzing');
    setTimeout(() => sheld?.classList.remove('ym-buzzing'), 700);
    playBuzz();
}

/** Shakes the window and sends BUZZ!!! as a message, as long as a reply could come back. */
export function buzz() {
    const context = SillyTavern.getContext();
    shake();
    if (!getChatOwner().group && !getChatOwner().character) {
        return;
    }
    if (context.onlineStatus === 'no_connection') {
        toastr.info(t('Not connected, so that Buzz stayed here.'));
        return;
    }
    if (document.body.dataset.generating === 'true') {
        return;
    }
    const box = textarea();
    const draft = box.value;
    box.value = BUZZ_TEXT;
    box.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('send_but')?.click();
    if (draft) {
        box.value = draft;
        box.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

function markBuzz(mes) {
    const message = SillyTavern.getContext().chat[Number(mes?.getAttribute('mesid'))];
    if (message) {
        mes.classList.toggle('ym-buzz-mes', BUZZ_MESSAGE.test(message.mes ?? ''));
    }
}

/** Buzzes in the chat stand out; marked per message, never while a reply streams. */
export function refreshBuzzMarks() {
    if (isOn()) {
        document.querySelectorAll('#chat > .mes[mesid]').forEach(markBuzz);
    }
}

/* ---------- format bar ---------- */

/** @type {HTMLElement|null} */
let emoticons = null;

function closeEmoticons() {
    if (emoticons) {
        emoticons.hidden = true;
    }
}

function toggleEmoticons(anchor) {
    if (!emoticons) {
        emoticons = el('div');
        emoticons.id = 'ym-emoticons';
        emoticons.setAttribute('role', 'menu');
        emoticons.hidden = true;
        for (const face of EMOTICONS) {
            const item = button('ym-emoticon', face);
            item.addEventListener('click', () => {
                insert(face);
                closeEmoticons();
            });
            emoticons.append(item);
        }
        document.body.append(own(emoticons));
        document.addEventListener('pointerdown', (event) => {
            const target = /** @type {Node} */ (event.target);
            if (!emoticons.hidden && !emoticons.contains(target) && !anchor.contains(target)) {
                closeEmoticons();
            }
        });
    }
    emoticons.hidden = !emoticons.hidden;
    const box = anchor.getBoundingClientRect();
    emoticons.style.setProperty('--ym-pop-left', `${Math.round(Math.max(8, box.left))}px`);
    emoticons.style.setProperty('--ym-pop-bottom', `${Math.round(window.innerHeight - box.top + 6)}px`);
}

function createFormatBar() {
    const form = document.getElementById('form_sheld');
    if (!form || document.getElementById('ym-format')) {
        return;
    }
    const bar = el('div');
    bar.id = 'ym-format';
    const tool = (label, icon, run) => {
        const item = iconButton('ym-tool', t(label), icon);
        item.addEventListener('click', () => run(item));
        return item;
    };
    const faces = tool('Emoticons', 'fa-regular fa-face-smile', toggleEmoticons);
    faces.classList.add('ym-tool-faces');
    const buzzButton = button('ym-buzz', t('BUZZ!'));
    buzzButton.title = t('Shake the window and get their attention');
    buzzButton.prepend(el('i', 'fa-solid fa-bolt'));
    buzzButton.addEventListener('click', buzz);
    bar.append(
        tool('Bold', 'fa-solid fa-bold', () => wrap('**')),
        tool('Italic (actions)', 'fa-solid fa-italic', () => wrap('*')),
        tool('Strikethrough', 'fa-solid fa-strikethrough', () => wrap('~~')),
        tool('Code', 'fa-solid fa-code', () => wrap('`')),
        tool('Quote', 'fa-solid fa-quote-left', () => prefixLines('> ')),
        el('span', 'ym-format-gap'),
        faces,
        buzzButton,
    );
    form.prepend(own(bar));
}

/* ---------- status line ---------- */

function createStatusLine() {
    const form = document.getElementById('form_sheld');
    if (!form || document.getElementById('ym-status')) {
        return;
    }
    const line = el('div');
    line.id = 'ym-status';
    line.setAttribute('role', 'status');
    form.before(own(line));
}

function setStatus(text, typing = false) {
    const line = document.getElementById('ym-status');
    if (!line) {
        return;
    }
    line.textContent = text;
    line.classList.toggle('ym-typing', typing);
}

/** With nothing happening, the line says when the last message came. */
function restStatus() {
    if (!isOn()) {
        return;
    }
    const { chat, timestampToMoment, name2 } = SillyTavern.getContext();
    const last = [...(chat ?? [])].reverse().find(message => !message.is_user && !message.is_system && message.send_date);
    const time = last ? timestampToMoment(last.send_date) : null;
    setStatus(time?.isValid?.() ? `${t('Last message from')} ${last.name || name2}: ${time.format('LT, MMM D')}` : '');
}

function onGenerationStarted(type, _options, dryRun) {
    if (!isOn() || dryRun || type === 'quiet') {
        return;
    }
    const { group, character } = getChatOwner();
    const name = group ? group.name : (character?.name ?? SillyTavern.getContext().name2);
    if (name) {
        setStatus(`${name} ${t('is typing a message…')}`, true);
    }
}

export function initMessenger(config) {
    options = config;
    createFormatBar();
    createStatusLine();
    restStatus();
    refreshBuzzMarks();

    const { eventSource, eventTypes } = SillyTavern.getContext();
    eventSource.on(eventTypes.GENERATION_STARTED, onGenerationStarted);
    for (const type of [eventTypes.GENERATION_ENDED, eventTypes.GENERATION_STOPPED, eventTypes.CHAT_CHANGED, eventTypes.MESSAGE_DELETED]) {
        eventSource.on(type, restStatus);
    }
    eventSource.on(eventTypes.CHAT_CHANGED, () => setTimeout(refreshBuzzMarks, 0));
    eventSource.on(eventTypes.MORE_MESSAGES_LOADED, refreshBuzzMarks);
    const rendered = (mesId) => {
        if (isOn()) {
            markBuzz(document.querySelector(`#chat > .mes[mesid="${Number(mesId)}"]`));
        }
    };
    eventSource.on(eventTypes.USER_MESSAGE_RENDERED, rendered);
    eventSource.on(eventTypes.MESSAGE_EDITED, rendered);
    eventSource.on(eventTypes.CHARACTER_MESSAGE_RENDERED, (mesId, type) => {
        rendered(mesId);
        if (!isOn() || type === 'first_message') {
            return;
        }
        const message = SillyTavern.getContext().chat[Number(mesId)];
        if (BUZZ_MESSAGE.test(message?.mes ?? '')) {
            shake();
        } else {
            playMessage();
        }
    });
}
