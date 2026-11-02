// Everything the theme puts into SillyTavern's page is marked as its own (data-ym-own), so it
// can all be taken out while the theme is off and put back, as it was, when it's on again.
// Nothing is built at all until the theme is first turned on.

/** Taken-out parts and where they were */
let parked = [];
/** SillyTavern's own elements with the theme's classes, attributes or sizes, and what those were */
let marks = [];

const OWN_ATTR = 'data-ym-own';
const SETTINGS_PANEL = '.ym-settings';

/** Whether the theme is on: watchers and listeners do nothing while it's off. */
export function isOn() {
    return document.body.classList.contains('yahoo-messenger');
}

/** Marks a node the theme added to the page. */
export function own(node) {
    node.dataset.ymOwn = '';
    return node;
}

/** Takes every part the theme added out of the page (the theme was switched off). */
export function parkOwned() {
    for (const node of document.querySelectorAll('[data-ym-own]')) {
        // parts inside another part go with it
        if (!node.isConnected || node.parentElement?.closest('[data-ym-own]')) {
            continue;
        }
        parked.push({ node, parent: node.parentNode, next: node.nextSibling });
        node.remove();
    }
    // the marks left on SillyTavern's own elements (the body's own classes are the theme's
    // settings, kept by index.js, and its settings panel stays as it is)
    for (const element of document.body.querySelectorAll('[class*="ym-"], [data-ym-known], [data-ym-time], [style*="--ym-"]')) {
        if (element.closest(SETTINGS_PANEL)) {
            continue;
        }
        const classes = [...element.classList].filter(name => name.startsWith('ym-'));
        const attributes = [...element.attributes].filter(a => a.name.startsWith('data-ym-') && a.name !== OWN_ATTR).map(a => [a.name, a.value]);
        const styles = [...element.style].filter(name => name.startsWith('--ym-')).map(name => [name, element.style.getPropertyValue(name)]);
        if (!classes.length && !attributes.length && !styles.length) {
            continue;
        }
        marks.push({ element, classes, attributes, styles });
        element.classList.remove(...classes);
        attributes.forEach(([name]) => element.removeAttribute(name));
        styles.forEach(([name]) => element.style.removeProperty(name));
    }
}

/** Puts them back where they were (the theme was switched on again). */
export function restoreOwned() {
    // in reverse, so each one's next sibling is already back in place
    for (const { node, parent, next } of parked.reverse()) {
        if (!parent?.isConnected || node.isConnected) {
            continue;
        }
        parent.insertBefore(node, next?.parentNode === parent ? next : null);
    }
    parked = [];
    for (const { element, classes, attributes, styles } of marks) {
        if (!element.isConnected) {
            continue;
        }
        element.classList.add(...classes);
        attributes.forEach(([name, value]) => element.setAttribute(name, value));
        styles.forEach(([name, value]) => element.style.setProperty(name, value));
    }
    marks = [];
}
