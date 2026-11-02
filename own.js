// Everything the theme puts into SillyTavern's page is its own and comes out while it's off (lib/theme-own.js).

import { createOwned } from './lib/theme-own.js';

export const { isOn, own, parkOwned, restoreOwned } = createOwned({
    prefix: 'ym',
    bodyClass: 'yahoo-messenger',
    attributes: ['known', 'time'],
});
