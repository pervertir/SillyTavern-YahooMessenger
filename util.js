// Small helpers shared by the theme's modules.

export const PHONE_QUERY = '(max-width: 1000px)';

export function t(text) {
    return SillyTavern.getContext().translate(text);
}

export function isPhone() {
    return window.matchMedia(PHONE_QUERY).matches;
}

/**
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 * @returns {HTMLElement}
 */
export function el(tag, className, text) {
    const element = document.createElement(tag);
    if (className) {
        element.className = className;
    }
    if (text !== undefined) {
        element.textContent = text;
    }
    return element;
}

/** A plain `<button type="button">`. */
export function button(className, text) {
    const element = /** @type {HTMLButtonElement} */ (el('button', className, text));
    element.type = 'button';
    return element;
}

/**
 * A button labelled only by its tooltip.
 * @param {string} className
 * @param {string} title
 * @param {string} icon A Font Awesome class list
 */
export function iconButton(className, title, icon) {
    const element = button(className);
    element.title = title;
    element.setAttribute('aria-label', title);
    element.append(el('i', icon));
    return element;
}

/** The last thing clicked in the theme's own windows */
let lastClicked = null;
document.addEventListener('pointerdown', (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    if (target.closest?.('#ym-buddy, #ym-head')) {
        lastClicked = target.closest('button') ?? target;
    }
}, true);

/**
 * Character Library opens its own small menu from SillyTavern's Characters button, placed under that
 * button. The theme's windows keep that button out of sight in the screen's corner, so the menu is moved
 * next to the button that was really pressed, and kept on screen.
 */
function placeLauncher() {
    const menu = /** @type {HTMLElement|null} */ (document.querySelector('#charlib-launcher-dropdown.visible'));
    if (!menu) {
        return;
    }
    const box = lastClicked?.isConnected ? lastClicked.getBoundingClientRect() : null;
    const width = menu.offsetWidth;
    const height = menu.offsetHeight;
    const left = box?.width ? box.left : (window.innerWidth - width) / 2;
    const top = box?.height ? box.bottom + 4 : (window.innerHeight - height) / 2;
    menu.style.right = 'auto';
    menu.style.left = `${Math.round(Math.max(8, Math.min(left, window.innerWidth - width - 8)))}px`;
    // no room below (the buddy list's bottom buttons): it opens upwards
    menu.style.top = `${Math.round(top + height > window.innerHeight - 8 && box?.height ? Math.max(8, box.top - height - 4) : top)}px`;
}

/** Clicks a SillyTavern drawer's toggle, the way its own top bar does. */
export function toggleDrawer(drawerId) {
    document.querySelector(`#${drawerId} > .drawer-toggle`)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    placeLauncher();
}

/** Opens a drawer unless it already is. */
export function openDrawer(drawerId) {
    if (!document.querySelector(`#${drawerId} > .drawer-content`)?.classList.contains('openDrawer')) {
        toggleDrawer(drawerId);
    }
}

/** Clicks an entry of SillyTavern's chat options menu (the ☰ by the message box). */
export function clickOption(id) {
    const options = [...document.querySelectorAll(`#options #${id}`)];
    /** @type {HTMLElement|undefined} */ (options.find(x => !x.classList.contains('displayNone')) ?? options[0])?.click();
}

/** The open chat's group, or its character when it isn't a group chat. */
export function getChatOwner() {
    const context = SillyTavern.getContext();
    const group = context.groupId ? context.groups.find(x => String(x.id) === String(context.groupId)) : null;
    const character = !group && context.characterId !== undefined ? context.characters[context.characterId] : null;
    return { group, character };
}

/** Plain one-line preview of a message, without markup. */
export function toPreview(text) {
    const div = document.createElement('div');
    div.innerHTML = SillyTavern.libs.DOMPurify.sanitize(String(text ?? ''), { ALLOWED_TAGS: [] });
    return (div.textContent || '').replace(/[*_~`#>|]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 140);
}
