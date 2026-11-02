// The retro desktop's story: the Windows logon, Messenger's sign-in window, Log Off, Turn Off and the pipes
// screensaver. The logon asks for the same name and password as SillyTavern's own login and checks them with
// the server; nothing typed is kept. It's for the nostalgia, not protection: the server's login is the real lock.

import { isOn, own } from './own.js';
import { runPipes } from './pipes.js';
import { button, el, isPhone, t } from './util.js';

/** Where this tab has got to: unset (logon), 'desktop' (Messenger not signed in) or 'messenger' */
const SESSION_KEY = 'ym-xp-session';
const MAX_TRIES = 3;
const SCREENSAVER_CHECK = 15000;

let options = { settings: () => ({}), save: () => {}, setLook: (_look) => {} };
let wrongTries = 0;
let lastActivity = Date.now();
let stopPipes = null;

function getSession() {
    try {
        return sessionStorage.getItem(SESSION_KEY);
    } catch {
        return 'messenger';
    }
}

function setSession(value) {
    try {
        if (value) {
            sessionStorage.setItem(SESSION_KEY, value);
        } else {
            sessionStorage.removeItem(SESSION_KEY);
        }
    } catch {
        // private windows can refuse storage; the tab just logs on again next time
    }
}

/** The story only plays on the retro desktop, and not on phones. */
function storyOn() {
    return document.body.classList.contains('ym-xp') && !isPhone() && !!options.settings().xpLogon;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function persona() {
    const img = /** @type {HTMLImageElement|null} */ (document.querySelector('#ym-me .ym-pic img'));
    return { name: SillyTavern.getContext().name1 ?? '', src: img?.src ?? '' };
}

function tone(pairs) {
    if (!options.settings().sounds) {
        return;
    }
    try {
        const audio = new AudioContext();
        for (const [frequency, at, length] of pairs) {
            const oscillator = audio.createOscillator();
            const gain = audio.createGain();
            oscillator.type = 'triangle';
            oscillator.frequency.value = frequency;
            gain.gain.setValueAtTime(0.07, audio.currentTime + at);
            gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + at + length);
            oscillator.connect(gain).connect(audio.destination);
            oscillator.start(audio.currentTime + at);
            oscillator.stop(audio.currentTime + at + length);
        }
    } catch {
        // no sound then
    }
}

/* ---------- checking the login with the server ---------- */

function basicHeader(user, password) {
    const bytes = new TextEncoder().encode(`${user}:${password}`);
    return `Basic ${btoa(String.fromCharCode(...bytes))}`;
}

/** How this SillyTavern logs in: 'basic' (name and password), 'account' (a handle's password) or 'none'. */
async function loginKind() {
    try {
        // no credentials at all, so it can't count as a failed attempt against SillyTavern's limit
        const probe = await fetch('version?logon', { credentials: 'omit', cache: 'no-store' });
        if (probe.status === 401) {
            return { kind: 'basic' };
        }
        const { getRequestHeaders } = SillyTavern.getContext();
        const me = await fetch('api/users/me', { headers: getRequestHeaders() });
        const handle = me.ok ? (await me.json()).handle : '';
        const list = await fetch('api/users/list', { method: 'POST', headers: getRequestHeaders() });
        const users = list.status === 200 ? await list.json() : null;
        const user = Array.isArray(users) ? users.find(x => x.handle === handle) : null;
        return (users === null || user?.password) && handle ? { kind: 'account', handle } : { kind: 'none' };
    } catch {
        return { kind: 'none' };
    }
}

/** @returns {Promise<'ok'|'wrong'|'wait'>} */
async function checkLogin(login, user, password) {
    if (login.kind === 'basic') {
        const response = await fetch('version?logon', { credentials: 'omit', cache: 'no-store', headers: { Authorization: basicHeader(user, password) } });
        return response.status === 429 ? 'wait' : response.ok ? 'ok' : 'wrong';
    }
    if (login.kind === 'account') {
        const response = await fetch('api/users/login', {
            method: 'POST',
            headers: SillyTavern.getContext().getRequestHeaders(),
            body: JSON.stringify({ handle: login.handle, password }),
        });
        return response.status === 429 ? 'wait' : response.ok ? 'ok' : 'wrong';
    }
    return 'ok';
}

/* ---------- full-screen messages ---------- */

function fullScreen(id) {
    document.getElementById(id)?.remove();
    const screen = el('div', 'ym-fullscreen');
    screen.id = id;
    document.body.append(own(screen));
    return screen;
}

/** The blue "Welcome" and "Saving your settings" screen. */
async function blueScreen(text, ms) {
    const screen = fullScreen('ym-blue');
    screen.append(el('div', 'ym-lo-top'));
    const middle = el('div', 'ym-lo-mid ym-lo-mid-text');
    middle.append(el('span', '', text));
    screen.append(middle, el('div', 'ym-lo-bottom'));
    await delay(ms);
    return screen;
}

/* ---------- the logon screen ---------- */

async function showLogon() {
    document.body.classList.add('ym-signed-out');
    document.getElementById('ym-signin')?.remove();
    const login = await loginKind();
    const { name, src } = persona();
    const screen = fullScreen('ym-logon');

    const left = el('div', 'ym-lo-left');
    const brand = el('div', 'ym-lo-brand');
    const flag = el('span', 'ym-lo-flag');
    const word = el('span', 'ym-lo-word');
    word.append(document.createTextNode('Windows'), el('sup', '', 'xp'));
    brand.append(flag, word);
    left.append(brand, el('div', 'ym-lo-hint', t('To begin, click your user name')));

    const right = el('div', 'ym-lo-right');
    const tile = button('ym-lo-tile');
    const picture = /** @type {HTMLImageElement} */ (el('img'));
    picture.alt = '';
    picture.src = src;
    const label = el('span', 'ym-lo-name', name);
    tile.append(picture, label);
    right.append(tile);

    const form = /** @type {HTMLFormElement} */ (el('form', 'ym-lo-form'));
    form.hidden = true;
    const userBox = /** @type {HTMLInputElement} */ (el('input'));
    userBox.type = 'text';
    userBox.autocomplete = 'off';
    userBox.setAttribute('aria-label', t('User name'));
    userBox.placeholder = t('User name');
    const passBox = /** @type {HTMLInputElement} */ (el('input'));
    passBox.type = 'password';
    passBox.autocomplete = 'off';
    passBox.setAttribute('aria-label', t('Password'));
    const go = button('ym-lo-go');
    go.type = 'submit';
    go.title = t('Log on');
    go.setAttribute('aria-label', t('Log on'));
    const message = el('div', 'ym-lo-message');
    message.setAttribute('role', 'alert');
    const passRow = el('div', 'ym-lo-row');
    passRow.append(passBox, go);
    form.append(...(login.kind === 'basic' ? [el('label', 'ym-lo-label', t('Type your SillyTavern user name and password')), userBox] : [el('label', 'ym-lo-label', t('Type your password'))]), passRow, message);
    right.append(form);

    const enter = async () => {
        wrongTries = 0;
        screen.remove();
        await blueScreen(t('welcome'), 1100);
        document.getElementById('ym-blue')?.remove();
        setSession('desktop');
        tone([[523, 0, 0.5], [659, 0.18, 0.5], [784, 0.36, 0.5], [1047, 0.56, 0.9]]);
        showSignIn();
    };
    tile.addEventListener('click', () => {
        if (login.kind === 'none') {
            enter();
            return;
        }
        form.hidden = false;
        (login.kind === 'basic' ? userBox : passBox).focus();
    });
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (wrongTries >= MAX_TRIES) {
            message.textContent = t('Too many tries. Wait a minute, then try again.');
            return;
        }
        const result = await checkLogin(login, userBox.value, passBox.value).catch(() => 'wrong');
        passBox.value = '';
        if (result === 'ok') {
            userBox.value = '';
            enter();
            return;
        }
        if (result === 'wrong') {
            wrongTries++;
            if (wrongTries >= MAX_TRIES) {
                // SillyTavern locks everyone out after a few wrong tries, so stop short of that
                setTimeout(() => { wrongTries = 0; }, 60000);
            }
        }
        message.textContent = result === 'wait' ? t('Too many tries. Wait a minute, then try again.') : t('Did you forget your password? That one isn\'t right.');
        passBox.focus();
    });

    const top = el('div', 'ym-lo-top');
    const middle = el('div', 'ym-lo-mid');
    middle.append(left, el('div', 'ym-lo-divider'), right);
    const bottom = el('div', 'ym-lo-bottom');
    const off = button('ym-lo-off');
    off.append(el('span', 'ym-lo-off-icon'), el('span', '', t('Turn off computer')));
    off.addEventListener('click', turnOffDialog);
    bottom.append(off, el('div', 'ym-lo-note', t('After you log on, your conversations are right where you left them.')));
    screen.append(top, middle, bottom);
}

/* ---------- Messenger's sign-in window ---------- */

function finishSignIn(invisible) {
    const settings = options.settings();
    if (invisible) {
        settings.status = 'invisible';
        options.save();
    }
    setSession('messenger');
    document.getElementById('ym-signin')?.remove();
    document.body.classList.remove('ym-signed-out');
    tone([[784, 0, 0.14], [1047, 0.12, 0.25]]);
    window.dispatchEvent(new Event('resize'));
}

export function showSignIn() {
    document.body.classList.add('ym-signed-out');
    document.getElementById('ym-signin')?.remove();
    const settings = options.settings();
    const { name } = persona();
    if (settings.signInAuto) {
        finishSignIn(false);
        return;
    }
    const box = el('div');
    box.id = 'ym-signin';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Messenger');
    const title = el('div', 'ym-title');
    title.append(el('span', 'ym-logo'), el('span', 'ym-title-text', t('Messenger')));
    const bar = el('div', 'ym-menubar');
    bar.append(el('span', 'ym-menubar-item', t('Messenger')), el('span', 'ym-menubar-item', t('Help')));
    const body = el('div', 'ym-si-body');
    const big = el('div', 'ym-si-logo');
    big.setAttribute('aria-hidden', 'true');
    const idLabel = el('label', 'ym-si-label', t('Messenger ID:'));
    const id = el('div', 'ym-si-id', name);
    const check = (text, checked) => {
        const label = el('label', 'ym-si-check');
        const input = /** @type {HTMLInputElement} */ (el('input'));
        input.type = 'checkbox';
        input.checked = checked;
        label.append(input, el('span', '', text));
        return { label, input };
    };
    const auto = check(t('Sign in automatically'), false);
    const invisible = check(t('Sign in as invisible to everyone'), settings.status === 'invisible');
    const signIn = button('menu_button ym-si-button', t('Sign In'));
    const status = el('div', 'ym-si-status');
    status.setAttribute('role', 'status');
    signIn.addEventListener('click', async () => {
        signIn.disabled = true;
        status.textContent = t('Signing in…');
        status.classList.add('ym-si-busy');
        if (auto.input.checked) {
            settings.signInAuto = true;
            options.save();
        }
        await delay(900);
        finishSignIn(invisible.input.checked);
    });
    body.append(big, idLabel, id, auto.label, invisible.label, signIn, status);
    box.append(title, bar, body);
    document.body.append(own(box));
    signIn.focus();
}

/** Messenger's own Sign Out, back to its window with the desktop still there. */
export function signOut() {
    setSession('desktop');
    options.settings().signInAuto = false;
    options.save();
    showSignIn();
}

/* ---------- Log Off and Turn Off ---------- */

function powerDialog(heading, choices) {
    closePowerDialog();
    const shade = el('div');
    shade.id = 'ym-power';
    const box = el('div', 'ym-pw-box');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', heading);
    const head = el('div', 'ym-pw-head');
    head.append(el('span', '', heading), el('span', 'ym-pw-flag'));
    const middle = el('div', 'ym-pw-mid');
    for (const { label, kind, run } of choices) {
        const choice = button(`ym-pw-choice ym-pw-${kind}`);
        choice.append(el('span', 'ym-pw-icon'), el('span', '', label));
        choice.addEventListener('click', () => {
            closePowerDialog();
            run();
        });
        middle.append(choice);
    }
    const foot = el('div', 'ym-pw-foot');
    const cancel = button('ym-pw-cancel', t('Cancel'));
    cancel.addEventListener('click', closePowerDialog);
    foot.append(cancel);
    box.append(head, middle, foot);
    shade.append(box);
    document.body.append(own(shade));
    cancel.focus();
}

function closePowerDialog() {
    document.getElementById('ym-power')?.remove();
}

async function logOff() {
    document.body.classList.add('ym-signed-out');
    document.getElementById('ym-signin')?.remove();
    setSession('');
    options.settings().signInAuto = false;
    options.save();
    await blueScreen(t('Logging off…'), 1100);
    tone([[784, 0, 0.3], [523, 0.2, 0.5]]);
    await showLogon();
    document.getElementById('ym-blue')?.remove();
}

export function logOffDialog() {
    powerDialog(t('Log Off Windows'), [
        { label: t('Switch User'), kind: 'switch', run: logOff },
        { label: t('Log Off'), kind: 'logoff', run: logOff },
    ]);
}

async function turnOff() {
    await blueScreen(t('Windows is shutting down…'), 1300);
    tone([[784, 0, 0.35], [659, 0.25, 0.35], [523, 0.5, 0.7]]);
    setSession('');
    window.close();
    // browsers only let a page close a tab that a script opened; otherwise, the famous last screen
    await delay(500);
    const screen = fullScreen('ym-safe');
    screen.append(el('div', 'ym-safe-text', t('It is now safe to turn off your computer.')));
    const hint = el('div', 'ym-safe-hint', t('Click to start again, or close this tab.'));
    screen.append(hint);
    screen.addEventListener('click', () => window.location.reload());
    document.getElementById('ym-blue')?.remove();
}

async function restart() {
    await blueScreen(t('Windows is shutting down…'), 1000);
    setSession('');
    window.location.reload();
}

export function turnOffDialog() {
    powerDialog(t('Turn off computer'), [
        { label: t('Stand By'), kind: 'standby', run: startPipes },
        { label: t('Turn Off'), kind: 'off', run: turnOff },
        { label: t('Restart'), kind: 'restart', run: restart },
    ]);
}

/* ---------- the pipes ---------- */

const WAKE_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'];

/** Runs the pipes (pipes.js) until anything moves. */
export async function startPipes() {
    if (stopPipes) {
        return;
    }
    // ignores the small mouse twitch that comes with pressing the button
    const started = Date.now();
    let stop = null;
    let woken = false;
    const end = () => {
        for (const type of WAKE_EVENTS) {
            window.removeEventListener(type, wake, true);
        }
        stop?.();
        stopPipes = null;
        lastActivity = Date.now();
    };
    function wake(event) {
        if (Date.now() - started < 600 || (event.type === 'pointermove' && Math.hypot(event.movementX, event.movementY) < 4)) {
            return;
        }
        woken = true;
        end();
    }
    stopPipes = end;
    for (const type of WAKE_EVENTS) {
        window.addEventListener(type, wake, true);
    }
    try {
        stop = await runPipes();
        if (woken) {
            stop();
        }
    } catch (error) {
        console.error('[Yahoo Messenger] Could not start the pipes', error);
        toastr.warning(t('The pipes need WebGL, which this browser has turned off.'));
        end();
    }
}

/** After a while with nothing touched, the screensaver starts by itself. */
function watchIdle() {
    for (const type of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) {
        window.addEventListener(type, () => { lastActivity = Date.now(); }, { capture: true, passive: true });
    }
    setInterval(() => {
        const minutes = Number(options.settings().screensaverMinutes);
        if (!isOn() || !document.body.classList.contains('ym-xp') || !minutes || stopPipes || document.hidden || isPhone()) {
            return;
        }
        if (document.body.dataset.generating !== 'true' && Date.now() - lastActivity > minutes * 60000) {
            startPipes();
        }
    }, SCREENSAVER_CHECK);
}

/**
 * Starts the story where this tab left off. A tab that's been through it comes straight back after a reload.
 * @param {typeof options} config
 */
export async function initXpFlow(config) {
    options = config;
    watchIdle();
    await resumeStory();
}

/** Puts the screen where the story says it should be, or takes the story away when it doesn't apply. */
export async function resumeStory() {
    if (!storyOn()) {
        for (const id of ['ym-logon', 'ym-signin', 'ym-blue', 'ym-safe']) {
            document.getElementById(id)?.remove();
        }
        document.body.classList.remove('ym-signed-out');
        return;
    }
    const session = getSession();
    if (session === 'messenger') {
        document.body.classList.remove('ym-signed-out');
    } else if (session === 'desktop') {
        showSignIn();
    } else if (!document.getElementById('ym-logon') && !document.getElementById('ym-blue')) {
        await showLogon();
    }
}
