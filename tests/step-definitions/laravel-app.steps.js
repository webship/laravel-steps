'use strict';

// The frame of the app a signed-in account sees: the user menu (the name and
// the address of the account, "Settings", "Log out"), the navigation (the
// sidebar and the settings navigation, and which of their items is the page
// on screen), and the appearance (light, dark or the system's).
//
// The three official kits draw these with different markup: a menu of the
// component kit and of the single-page kits, a radio group or a row of
// buttons. The steps look for what a person sees, and read the marks each kit
// leaves (aria-current, data-current, data-active, aria-checked).

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  clean,
  listed,
  settle,
  eventually,
  recordNotifications,
  forgetNotifications,
  openUserMenu,
  menuItems,
  closeMenus,
  navigationItems,
} = require('./laravel-helpers');

/**
 * Open an item of the user menu, as a person does: the button with the name
 * of the signed-in account, then the item.
 *
 * Example #1: When I open "Settings" from the user menu
 * Example #2: When we open "Settings" from the user menu
 * Example #3: And I open "Settings" from the user menu
 * Example #4: Then I open "Settings" from the user menu
 * Example #5: Given I open "Settings" from the user menu
 */
When(/^(I |we )*open "([^"]*)" from the user menu$/, async function (pronounCase, item) {
  await recordNotifications(this);
  await forgetNotifications(this);
  const menu = await openUserMenu(this);
  const items = await menuItems(menu);
  const target = menu.getByRole('menuitem', { name: item, exact: true });
  if (!(await target.count())) {
    await closeMenus(this);
    throw friendly({ message: `The user menu has no item "${item}". It offers: ${listed(items)}.`, hint: 'Use the text of the item as the menu shows it.' });
  }
  const from = this.page.url();
  await target.first().click();
  await this.page.waitForURL((url) => url.toString() !== from, { timeout: budget(this) }).catch(() => {});
  await settle(this);
});

/**
 * Assert the items the user menu offers, or that it does not offer one.
 *
 * Example #1: Then the user menu should offer "Settings"
 * Example #2: Then the user menu should offer "Log out"
 * Example #3: And the user menu should not offer "Administration"
 * Example #4: Then the user menu should not offer "Billing"
 * Example #5: And the user menu should offer "Settings"
 */
Then(/^the user menu should( not)* offer "([^"]*)"$/, async function (notCase, item) {
  const menu = await openUserMenu(this);
  const items = await menuItems(menu);
  await closeMenus(this);
  const has = items.includes(clean(item));
  if (notCase && has) {
    throw friendly({ message: `Expected the user menu not to offer "${item}", but it does. It offers: ${listed(items)}.`, hint: 'The user menu opens from the button with the name of the signed-in account.' });
  }
  if (!notCase && !has) {
    throw friendly({ message: `Expected the user menu to offer "${item}". It offers: ${listed(items)}.`, hint: 'The user menu opens from the button with the name of the signed-in account.' });
  }
});

/**
 * Assert that the user menu names an account of the users registry: its name
 * (when the registry gives one) and its address. A menu that shows no address
 * (an admin panel drawn on the app shows the name only) names the account by
 * its name.
 *
 * Example #1: Then the user menu should name "member"
 * Example #2: And the user menu should name "member"
 * Example #3: Then the user menu should name "unverified"
 * Example #4: Then the user menu should name "member"
 * Example #5: But the user menu should name "member"
 */
Then(/^the user menu should name "([^"]*)"$/, async function (handle) {
  const users = (this.parameters && this.parameters.users) || {};
  const user = users[handle];
  if (!user) throw friendly({ message: `The user "${handle}" is not in the users registry. Known users: ${Object.keys(users).join(', ') || '(none)'}.`, hint: 'Add it to worldParameters.users in cucumber.js.' });
  const menu = await openUserMenu(this);
  const text = clean(await menu.innerText().catch(() => ''));
  await closeMenus(this);
  // A user menu that shows no address at all (an admin panel's shows the name only) names the account by its name.
  const parts = /[^\s@]+@[^\s@]+\.[^\s@]+/.test(text) || !user.name ? [user.name, user.email] : [user.name];
  const missing = parts.filter((part) => part && !text.includes(part));
  if (missing.length) {
    throw friendly({ message: `Expected the user menu to name "${handle}" (${[user.name, user.email].filter(Boolean).join(', ')}), but it reads: "${text}".`, hint: 'The user menu shows the name and the address the app stored for the signed-in account.' });
  }
});

/**
 * Assert that the navigation of the page (the sidebar, the settings
 * navigation) has, or does not have, an item.
 *
 * Example #1: Then the navigation should have the item "Dashboard"
 * Example #2: Then the navigation should have the item "Appearance"
 * Example #3: And the navigation should not have the item "Administration"
 * Example #4: Then the navigation should have the item "Security"
 * Example #5: And the navigation should not have the item "Billing"
 */
Then(/^the navigation should( not)* have the item "([^"]*)"$/, async function (notCase, item) {
  const read = () => navigationItems(this);
  if (notCase) {
    const items = await read();
    if (items.some((entry) => entry.text === clean(item))) {
      throw friendly({ message: `Expected the navigation not to have the item "${item}", but it does.`, hint: 'The navigation is every nav landmark of the page: the sidebar and the settings navigation.' });
    }
    return;
  }
  await eventually(this, read, (items) => items.some((entry) => entry.text === clean(item)), (items) => ({
    message: `Expected the navigation to have the item "${item}". It has: ${listed(items.map((entry) => entry.text))}.`,
    hint: 'The navigation is every nav landmark of the page: the sidebar and the settings navigation.',
  }));
});

/**
 * Assert which item of the navigation is the page on screen: the item the
 * page marks as current (aria-current, data-current, data-active), or, where
 * a kit marks it only with a colour, the item whose address is the page's.
 *
 * Example #1: Then the navigation should show "Dashboard" as the current page
 * Example #2: Then the navigation should show "Profile" as the current page
 * Example #3: And the navigation should show "Security" as the current page
 * Example #4: Then the navigation should not show "Dashboard" as the current page
 * Example #5: And the navigation should show "Appearance" as the current page
 */
Then(/^the navigation should( not)* show "([^"]*)" as the current page$/, async function (notCase, item) {
  const strip = (url) => String(url || '').split(/[?#]/)[0].replace(/\/+$/, '');
  const isCurrent = (entry, items) => {
    const marks = items.some((other) => other.current);
    return entry.current || (!marks && strip(entry.href) === strip(this.page.url()));
  };
  const read = () => navigationItems(this);
  const check = (items) => {
    const named = items.filter((entry) => entry.text === clean(item));
    return named.length > 0 && (named.some((entry) => isCurrent(entry, items)) !== !!notCase);
  };
  await eventually(this, read, check, (items) => {
    const named = items.filter((entry) => entry.text === clean(item));
    const current = items.filter((entry) => isCurrent(entry, items)).map((entry) => entry.text);
    return {
      message: !named.length
        ? `The navigation has no item "${item}". It has: ${listed(items.map((entry) => entry.text))}.`
        : `Expected the navigation ${notCase ? 'not ' : ''}to show "${item}" as the current page. The current item: ${listed(current)}.`,
      hint: `The page is ${this.page.url()}.`,
    };
  });
});

/**
 * Choose an appearance on the appearance settings page, as a person does: the
 * option named "Light", "Dark" or "System", whether the kit draws the options
 * as a radio group or as a row of buttons.
 *
 * Example #1: When I choose the "Dark" appearance
 * Example #2: When I choose the "Light" appearance
 * Example #3: And we choose the "System" appearance
 * Example #4: When we choose the "Dark" appearance
 * Example #5: And I choose the "System" appearance
 */
When(/^(I |we )*choose the "(Light|Dark|System)" appearance$/, async function (pronounCase, wanted) {
  const page = this.page;
  const name = new RegExp('^\\s*' + wanted + '\\s*$', 'i');
  const candidates = [
    page.getByRole('radio', { name }),
    page.getByRole('tab', { name }),
    page.getByRole('button', { name }),
  ];
  for (const option of candidates) {
    if (await option.first().isVisible().catch(() => false)) {
      await option.first().click();
      await settle(this);
      return;
    }
  }
  throw friendly({
    message: `The page offers no "${wanted}" appearance (${this.page.url()}).`,
    hint: 'Open the appearance settings first (I go to "/settings/appearance"): the options are "Light", "Dark" and "System".',
  });
});

/** The appearance option the page shows as chosen: aria-checked/aria-pressed, else the preference the app stored in the browser. */
async function chosenAppearance(world) {
  return world.page.evaluate(() => {
    const options = [...document.querySelectorAll('[role="radio"], [aria-pressed], button')]
      .filter((el) => /^(light|dark|system)$/i.test((el.textContent || '').replace(/\s+/g, ' ').trim()));
    const marked = options.find((el) => el.getAttribute('aria-checked') === 'true' || el.getAttribute('aria-pressed') === 'true' || el.getAttribute('data-state') === 'on' || el.hasAttribute('data-checked'));
    if (marked) return { value: marked.textContent.replace(/\s+/g, ' ').trim(), from: 'the option the page marks as chosen' };
    let stored = null;
    try { stored = localStorage.getItem('appearance') || localStorage.getItem('flux.appearance'); } catch (e) { /* storage blocked */ }
    const value = (stored || 'system').replace(/^./, (c) => c.toUpperCase());
    return { value, from: stored ? 'the preference stored in the browser' : 'no stored preference (the system\'s)' };
  }).catch(() => ({ value: '', from: 'nothing (the page could not be read)' }));
}

/**
 * Assert the appearance chosen on the appearance settings page: the option
 * marked as chosen, or, where a kit does not mark it, the preference it
 * stored in the browser.
 *
 * Example #1: Then the chosen appearance should be "Dark"
 * Example #2: Then the chosen appearance should be "Light"
 * Example #3: And the chosen appearance should be "System"
 * Example #4: Then the chosen appearance should be "System"
 * Example #5: And the chosen appearance should be "Dark"
 */
Then(/^the chosen appearance should be "(Light|Dark|System)"$/, async function (wanted) {
  await eventually(this, () => chosenAppearance(this), (chosen) => chosen.value.toLowerCase() === wanted.toLowerCase(), (chosen) => ({
    message: `Expected the chosen appearance "${wanted}", but it is "${chosen.value}" (read from ${chosen.from}).`,
    hint: 'Choose it on the appearance settings page (I choose the "Dark" appearance).',
  }));
});

/**
 * Assert the appearance the page is drawn in: dark when the document carries
 * the "dark" class the kits switch, light otherwise.
 *
 * Example #1: Then the page should be shown in the dark appearance
 * Example #2: Then the page should be shown in the light appearance
 * Example #3: And the page should be shown in the dark appearance
 * Example #4: Then the page should be shown in the light appearance
 * Example #5: But the page should be shown in the light appearance
 */
Then(/^the page should be shown in the (dark|light) appearance$/, async function (wanted) {
  const read = () => this.page.evaluate(() => (document.documentElement.classList.contains('dark') ? 'dark' : 'light')).catch(() => '');
  await eventually(this, read, (value) => value === wanted, (value) => ({
    message: `Expected the page in the ${wanted} appearance, but it is shown in the ${value || 'unknown'} one.`,
    hint: 'The kits switch the "dark" class of the document. "System" follows the colour scheme the browser prefers (light in a test browser).',
  }));
});
