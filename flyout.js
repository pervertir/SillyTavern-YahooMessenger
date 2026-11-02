import { createFlyout } from './lib/flyout-menu.js';
import { own } from './own.js';

export const { closeFlyout, toggleFlyout } = createFlyout({
    prefix: 'ym',
    own,
    anchorClass: 'ym-menu-anchor',
    flip: true,
});
