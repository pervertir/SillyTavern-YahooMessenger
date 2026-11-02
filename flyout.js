// The pop-up menus (the menu bar, the … menus, a contact's menu): one shared menu, opened beside or
// below the button that asked for it.

import { own } from './own.js';
import { button, el, t } from './util.js';

/** @type {HTMLElement|null} */
let flyout = null;
/** @type {HTMLElement|null} */
let flyoutAnchor = null;

export function closeFlyout() {
    if (flyout) {
        flyout.hidden = true;
    }
    flyoutAnchor?.classList.remove('ym-menu-anchor');
    flyoutAnchor = null;
}

/** The menu, made the first time one opens. */
function getFlyout() {
    if (flyout) {
        return flyout;
    }
    flyout = el('div');
    flyout.id = 'ym-flyout';
    flyout.setAttribute('role', 'menu');
    flyout.hidden = true;
    document.body.append(own(flyout));
    document.addEventListener('pointerdown', (event) => {
        const target = /** @type {Node} */ (event.target);
        if (!flyout.hidden && !flyout.contains(target) && !flyoutAnchor?.contains(target)) {
            closeFlyout();
        }
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !flyout.hidden) {
            closeFlyout();
        }
    });
    return flyout;
}

/**
 * Opens a menu next to a button, or closes it when it's already open there.
 * @param {HTMLElement} anchor
 * @param {{label: string, icon: string, run: () => void}[]} items
 * @param {'beside'|'below-end'|'below-start'} placement
 */
export function toggleFlyout(anchor, items, placement) {
    getFlyout();
    if (!flyout.hidden && flyoutAnchor === anchor) {
        closeFlyout();
        return;
    }
    closeFlyout();
    flyout.replaceChildren(...items.map(({ label, icon, run }) => {
        const item = button('ym-more-item');
        item.setAttribute('role', 'menuitem');
        item.append(el('i', icon), el('span', '', t(label)));
        item.addEventListener('click', () => {
            closeFlyout();
            run();
        });
        return item;
    }));
    flyout.dataset.placement = placement;
    flyout.hidden = false;
    flyoutAnchor = anchor;
    anchor.classList.add('ym-menu-anchor');
    const box = anchor.getBoundingClientRect();
    flyout.style.setProperty('--ym-flyout-top', `${Math.round(placement === 'beside' ? box.top : box.bottom + 4)}px`);
    flyout.style.setProperty('--ym-flyout-left', `${Math.round(box.right + 4)}px`);
    flyout.style.setProperty('--ym-flyout-start', `${Math.round(box.left)}px`);
    flyout.style.setProperty('--ym-flyout-right', `${Math.round(window.innerWidth - box.right)}px`);
    // a menu that wouldn't fit opens upwards, ending at the window's bottom edge
    const height = flyout.offsetHeight;
    if (box.bottom + 4 + height > window.innerHeight) {
        flyout.style.setProperty('--ym-flyout-top', `${Math.max(8, window.innerHeight - height - 8)}px`);
    }
    /** @type {HTMLElement} */ (flyout.querySelector('.ym-more-item'))?.focus();
}
