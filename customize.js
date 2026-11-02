// Customize: every part of the theme can be changed from one page, live. The page itself is
// lib/customize-page.js; here are this theme's parts of it.

import { createCustomize } from './lib/customize-page.js';

const FONTS = [
    ['', 'Inter and Verdana (default)'],
    ['system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', 'System'],
    ['Arial, Helvetica, sans-serif', 'Arial'],
    ['Verdana, Geneva, sans-serif', 'Verdana'],
    ['Georgia, "Times New Roman", serif', 'Georgia'],
    ['"Courier New", Menlo, Consolas, monospace', 'Monospace'],
];

const SECTIONS = [
    {
        id: 'colors', title: 'Colors', items: [
            { token: '--ym-brand', label: 'Accent', type: 'color' },
            { token: '--ym-brand-hover', label: 'Accent (hover)', type: 'color' },
            { token: '--ym-brand-fg', label: 'Accent text and icons', type: 'color' },
            { token: '--ym-brand-soft', label: 'Selected background', type: 'color' },
            { token: '--ym-on-brand', label: 'Text on accent', type: 'color' },
            { token: '--ym-gold', label: 'Gold (Send and Buzz)', type: 'color' },
            { token: '--ym-on-gold', label: 'Text on gold', type: 'color' },
            { token: '--ym-title-from', label: 'Title bars (from)', type: 'color' },
            { token: '--ym-title-to', label: 'Title bars (to)', type: 'color' },
            { token: '--ym-desk-from', label: 'Desktop (from)', type: 'color' },
            { token: '--ym-desk-to', label: 'Desktop (to)', type: 'color' },
            { token: '--ym-list', label: 'Buddy list', type: 'color' },
            { token: '--ym-canvas', label: 'Conversation', type: 'color' },
            { token: '--ym-card', label: 'Cards', type: 'color' },
            { token: '--ym-raised', label: 'Menus and dialogs', type: 'color' },
            { token: '--ym-hover', label: 'Hovered rows', type: 'color' },
            { token: '--ym-input', label: 'Text boxes', type: 'color' },
            { token: '--ym-fg', label: 'Text', type: 'color' },
            { token: '--ym-fg-2', label: 'Secondary text', type: 'color' },
            { token: '--ym-fg-3', label: 'Muted text', type: 'color' },
            { token: '--ym-stroke', label: 'Borders', type: 'color' },
            { token: '--ym-stroke-2', label: 'Dividers', type: 'color' },
            { token: '--ym-danger', label: 'Alerts and errors', type: 'color' },
            { token: '--ym-warning', label: 'Warnings', type: 'color' },
            { token: '--ym-success', label: 'Success', type: 'color' },
        ],
    },
    {
        id: 'text', title: 'Text', items: [
            { token: '--ym-font', label: 'Font', type: 'font' },
            { token: '--ym-text', label: 'Body text', type: 'size', min: 11, max: 20 },
            { token: '--ym-text-sm', label: 'Small text', type: 'size', min: 9, max: 18 },
            { token: '--ym-text-xs', label: 'Tiny text', type: 'size', min: 8, max: 14 },
            { token: '--ym-text-md', label: 'Headings', type: 'size', min: 12, max: 24 },
            { token: '--ym-text-lg', label: 'Page titles', type: 'size', min: 14, max: 32 },
        ],
    },
    {
        id: 'shape', title: 'Shape', items: [
            {
                flag: 'avatarShape', label: 'Pictures', type: 'select', default: 'square',
                options: [['round', 'Circle'], ['squircle', 'Rounded square'], ['square', 'Soft square']],
            },
            { token: '--ym-radius-sm', label: 'Small corners', type: 'size', min: 0, max: 12 },
            { token: '--ym-radius', label: 'Buttons and fields', type: 'size', min: 0, max: 16 },
            { token: '--ym-radius-md', label: 'Cards', type: 'size', min: 0, max: 20 },
            { token: '--ym-radius-lg', label: 'Windows and dialogs', type: 'size', min: 0, max: 24 },
            { token: '--ym-bubble-radius', label: 'Message bubbles', type: 'size', min: 0, max: 24 },
        ],
    },
    {
        id: 'spacing', title: 'Spacing', items: [
            {
                flag: 'density', label: 'Density', type: 'select', default: 'default',
                options: [['compact', 'Compact'], ['default', 'Default'], ['roomy', 'Roomy']],
            },
            { token: '--ym-gap', label: 'Space around the windows', type: 'size', min: 0, max: 32 },
            { token: '--ym-list-w', label: 'Buddy list width', type: 'size', min: 220, max: 480 },
            { token: '--ym-images-w', label: 'Display images width', type: 'size', min: 120, max: 360 },
            { token: '--ym-chat-pad', label: 'Transcript side margins', type: 'size', min: 0, max: 80 },
            { token: '--ym-mes-gap', label: 'Space between messages', type: 'size', min: 0, max: 24 },
            { token: '--ym-bubble-pad-y', label: 'Bubble padding (top and bottom)', type: 'size', min: 2, max: 24 },
            { token: '--ym-bubble-pad-x', label: 'Bubble padding (sides)', type: 'size', min: 4, max: 32 },
        ],
    },
    {
        id: 'layout', title: 'Layout', items: [
            { flag: 'hide-menubar', label: 'Hide the menu bar', type: 'check' },
            { flag: 'hide-me', label: 'Hide your picture and status', type: 'check' },
            { flag: 'hide-search', label: 'Hide search', type: 'check' },
            { flag: 'hide-tools', label: 'Hide the buttons under the buddy list', type: 'check' },
            { flag: 'hide-previews', label: 'Hide the line under each contact', type: 'check' },
            { flag: 'hide-actions', label: 'Hide the conversation buttons', type: 'check' },
            { flag: 'hide-format', label: 'Hide the format bar', type: 'check' },
            { flag: 'hide-buzz', label: 'Hide Buzz', type: 'check' },
            { flag: 'hide-status', label: 'Hide the status line', type: 'check' },
            { flag: 'hide-wand', label: 'Hide the wand button in the message box (extensions menu)', type: 'check' },
            { flag: 'hide-plus', label: 'Hide the ☰ button in the message box (chat options)', type: 'check' },
        ],
    },
    {
        id: 'messages', title: 'Messages', items: [
            { token: '--ym-name-them', label: 'Their names', type: 'color' },
            { token: '--ym-name-me', label: 'Your name', type: 'color' },
            { token: '--ym-bubble-in', label: 'Their bubbles', type: 'color' },
            { token: '--ym-bubble-out', label: 'Your bubbles', type: 'color' },
            { token: '--ym-mes-em', label: 'Actions (italics)', type: 'color' },
            { token: '--ym-mes-quote', label: 'Quotes', type: 'color' },
            { token: '--ym-mes-text', label: 'Message text', type: 'size', min: 11, max: 24 },
            { token: '--ym-mes-line', label: 'Line height', type: 'size', min: 14, max: 36 },
            { token: '--ym-mes-avatar', label: 'Picture size', type: 'size', min: 20, max: 64 },
            { token: '--ym-bubble-max', label: 'Text width', type: 'size', unit: '%', min: 40, max: 100 },
            { flag: 'hide-avatars', label: 'Hide pictures beside messages', type: 'check' },
            { flag: 'hide-names', label: 'Hide names', type: 'check' },
            { flag: 'hide-timestamps', label: 'Hide times', type: 'check' },
            { flag: 'hide-swipes', label: 'Hide the reply pager (swipes)', type: 'check' },
        ],
    },
    {
        id: 'background', title: 'Chat Background', items: [
            {
                flag: 'bgMode', label: 'Background', type: 'select', default: 'none',
                options: [['none', 'Theme default'], ['color', 'Color'], ['gradient', 'Gradient'], ['image', 'Picture']],
            },
            { flag: 'bgColor', label: 'Color', type: 'color', default: '#ffffff', when: 'color' },
            { flag: 'bgFrom', label: 'From', type: 'color', default: '#efe6ff', when: 'gradient' },
            { flag: 'bgTo', label: 'To', type: 'color', default: '#ffffff', when: 'gradient' },
            { flag: 'bgAngle', label: 'Angle', type: 'size', unit: 'deg', min: 0, max: 360, step: 5, default: '180', when: 'gradient' },
            { flag: 'bgImage', label: 'Picture (web address)', type: 'url', default: '', when: 'image' },
            { flag: 'bgDim', label: 'Fade the picture', type: 'size', unit: '%', min: 0, max: 100, default: '0', when: 'image' },
        ],
    },
    {
        id: 'motion', title: 'Motion', items: [
            {
                flag: 'motion', label: 'Animations', type: 'select', default: 'full',
                options: [['full', 'Full'], ['reduced', 'Reduced'], ['off', 'Off']],
            },
            { token: '--ym-fast', label: 'Quick transitions', type: 'size', unit: 'ms', min: 0, max: 500, step: 10 },
            { token: '--ym-normal', label: 'Transitions', type: 'size', unit: 'ms', min: 0, max: 800, step: 10 },
        ],
    },
    {
        id: 'advanced', title: 'Advanced', items: [
            { css: true, label: 'Custom CSS', type: 'css' },
        ],
    },
];

const AVATAR_RADIUS = { squircle: '30%', round: '50%' };
const DENSITY = {
    compact: { '--ym-mes-gap': '2px', '--ym-bubble-pad-y': '5px', '--ym-bubble-pad-x': '12px' },
    roomy: { '--ym-mes-gap': '12px', '--ym-bubble-pad-y': '11px', '--ym-bubble-pad-x': '20px' },
};

/** A small buddy list and conversation drawn with the same tokens, so every change shows up at once. */
function buildPreview(el) {
    const preview = el('div', 'ym-cz-preview');
    preview.setAttribute('aria-hidden', 'true');
    preview.innerHTML = `
        <div class="ym-pv-win ym-pv-buddy">
            <div class="ym-pv-title">Messenger</div>
            <div class="ym-pv-group">Friends (2/2)</div>
            <div class="ym-pv-row ym-pv-sel"><span class="ym-pv-av">AM</span><span><b>Alex Morgan</b><small>See you at the review</small></span></div>
            <div class="ym-pv-row"><span class="ym-pv-av ym-pv-av2">PS</span><span><b>Priya Shah</b><small>Thanks!</small></span></div>
        </div>
        <div class="ym-pv-win ym-pv-chat">
            <div class="ym-pv-title">Alex Morgan</div>
            <div class="ym-pv-messages">
                <div class="ym-pv-mes"><span class="ym-pv-av ym-pv-mes-av">AM</span><div class="ym-pv-bubble"><div class="ym-pv-meta"><span class="ym-pv-name">Alex Morgan</span> <span class="ym-pv-time">10:42 AM</span></div><span class="ym-pv-text"><i>waves</i> Morning! <q>Ready for the review?</q></span></div></div>
                <div class="ym-pv-mes ym-pv-mine"><span class="ym-pv-av ym-pv-mes-av ym-pv-av2">TR</span><div class="ym-pv-bubble"><div class="ym-pv-meta"><span class="ym-pv-name">You</span> <span class="ym-pv-time">10:43 AM</span></div><span class="ym-pv-text">Yes, joining in five minutes.</span></div></div>
            </div>
            <div class="ym-pv-compose">Type a message <span class="ym-pv-send">Send</span></div>
        </div>`;
    return preview;
}

export const { applyCustomize, emptyCustomize, normalizeCustomize, openCustomize } = createCustomize({
    themeId: 'yahoomessenger',
    prefix: 'ym',
    bodyClass: 'yahoo-messenger',
    exportName: 'messenger-theme.json',
    fonts: FONTS,
    sections: SECTIONS,
    buildPreview,
    avatarRadius: AVATAR_RADIUS,
    density: DENSITY,
});
