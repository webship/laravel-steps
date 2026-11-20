'use strict';

// Shared helpers for the step files of this pack.
//
// Not a step file: it registers no step definitions and no hooks. It holds the
// plumbing the steps use and that a project can require for its own steps:
// the wait budget and the settle on the page's own requests, the users
// registry, the session cache, fields found by their label and the errors
// under them, status lines, notifications (toasts), the user menu, the
// navigation, the mailbox of the test site, and the error pages.
//
// The app is a starter-kit app: the pages are the same on the three official
// kits (server-rendered components, and the two single-page kits), but the
// markup is not. Every lookup starts with what a person reads (a label, a
// role, a text) and falls back to the hooks the three kits share
// (`data-test="login-button"` and the like, `role`, `aria-*`).
//
// Everything builds on webship-js's own helpers (`gotoUrl`, `friendly`,
// `fillField`) so the steps fail the way the core webship-js steps do.

const { gotoUrl, friendly, fillField } = require('webship-js/tests/step-definitions/webship');

// ---------------------------------------------------------------------------
// The frame of the app: what a pack that builds on this one adds to
// ---------------------------------------------------------------------------

/**
 * The parts of the app's frame that the steps find by their markup: the
 * button that opens the user menu, the texts of the item that logs out, and
 * the notifications. The values here are the official starter kits'. A pack
 * that builds on this one (an admin panel drawn on the app, with markup of its
 * own) adds its own when it loads, before any step runs; the steps of this
 * pack then find its frame too:
 *
 *   const { FRAME } = require('@webship-js/laravel-steps/tests/step-definitions/laravel-helpers');
 *   FRAME.userMenuTriggers.push('.my-user-menu-button');
 *   FRAME.logoutLabels.push('Sign out');
 *   FRAME.notifications.push({ selector: '.my-toast', typeClassPrefix: 'my-toast-' });
 *
 * A notification's kind (success, error or danger, warning, info) is read
 * from an attribute (`typeAttribute`) or from a class that starts with a
 * prefix (`typeClassPrefix`).
 */
const FRAME = {
  // The button that opens the user menu: the first visible match, in this order.
  userMenuTriggers: [
    '[data-test="sidebar-menu-button"]',
    'header button[aria-haspopup="menu"], [data-flux-header] button[aria-haspopup="menu"], [data-flux-profile]',
  ],
  // The text of the item of the user menu (or of the button of a page without the menu) that logs out.
  logoutLabels: ['Log out'],
  // The notifications a save shows for a few seconds.
  notifications: [
    { selector: '[data-flux-toast-dialog]', typeAttribute: 'data-variant' },
    { selector: '[data-sonner-toast]', typeAttribute: 'data-type' },
  ],
};

/** The kinds of notification of FRAME, as the browser-side code reads them. */
function notificationKinds() {
  return FRAME.notifications.map((kind) => ({ selector: kind.selector, attribute: kind.typeAttribute || '', prefix: kind.typeClassPrefix || '' }));
}

/**
 * The per-assertion wait budget: `minWaitTime.page` from cucumber.js, at least
 * 10 seconds. Kept below webship-js's 45 second step timeout.
 *
 * @param {object} world
 * @returns {number}
 */
function budget(world) {
  return Math.max((world && world.minWaitTime && world.minWaitTime.page) || 0, 10000);
}

/** The settle budget after an action (`minWaitTime.page`, 3 seconds by default). */
function settleBudget(world) {
  return (world && world.minWaitTime && world.minWaitTime.page) || 3000;
}

/** Escape a literal string for use in a RegExp. */
function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** White space collapsed and trimmed. */
function clean(text) {
  return String(text === null || text === undefined ? '' : text).replace(/\s+/g, ' ').trim();
}

/** A list for an error message: `"a", "b", "c"` or `(none)`. */
function listed(values) {
  const items = [...new Set((values || []).map(clean).filter(Boolean))];
  return items.length ? items.map((item) => `"${item}"`).join(', ') : '(none)';
}

/** The site root without a trailing slash. */
function siteRoot(world) {
  return String(world.launchUrl || (world.parameters && world.parameters.launchUrl) || '').replace(/\/+$/, '');
}

/** Join the site root and a path with exactly one slash. Absolute URLs pass through. */
function siteUrl(world, url) {
  if (!url) return siteRoot(world) + '/';
  if (/^https?:\/\//i.test(url)) return url;
  return siteRoot(world) + '/' + String(url).replace(/^\/+/, '');
}

/** A path of the app read from cucumber.js (`worldParameters.<key>`), or its default. */
function appPath(world, key, fallback) {
  const value = world.parameters && world.parameters[key];
  return '/' + String(value || fallback).replace(/^\/+/, '');
}

/** The page signed-in users land on (`homePath`, /dashboard on the starter kits). */
function homePath(world) {
  return appPath(world, 'homePath', '/dashboard');
}

/** The login page (`loginPath`, /login). */
function loginPath(world) {
  return appPath(world, 'loginPath', '/login');
}

/** The path of the page the browser shows, without the query and the fragment. */
function currentPath(world) {
  try {
    return new URL(world.page.url()).pathname.replace(/\/+$/, '') || '/';
  } catch {
    return '';
  }
}

/** Whether the browser shows the page of a path (trailing slashes ignored). */
function isOnPath(world, path) {
  return currentPath(world) === (String(path).replace(/\/+$/, '') || '/');
}

// ---------------------------------------------------------------------------
// Waiting on the page's own requests
// ---------------------------------------------------------------------------

// The single-page kits talk to the server with XHR, the component kit with
// fetch; a settle that watches the requests the page makes covers the three.
const TRACKED = new WeakMap();

/**
 * The background requests (XHR and fetch) of the page that are still running,
 * and how many started so far. The tracker is attached once per page.
 *
 * @returns {{pending: Set, started: number}}
 */
function requests(world) {
  const page = world.page;
  let state = TRACKED.get(page);
  if (!state) {
    state = { pending: new Set(), started: 0, answers: [] };
    TRACKED.set(page, state);
    const background = (request) => ['xhr', 'fetch'].includes(request.resourceType());
    page.on('request', (request) => {
      if (!background(request)) return;
      state.pending.add(request);
      state.started += 1;
    });
    // The answers to the background requests, newest last: a single-page kit shows an error page
    // that answers one of them in a dialog over the page, not as the page.
    page.on('response', (response) => {
      if (!background(response.request())) return;
      state.answers.push({ url: response.url(), method: response.request().method(), status: response.status(), at: Date.now() });
      if (state.answers.length > 50) state.answers.shift();
    });
    const done = (request) => { state.pending.delete(request); };
    page.on('requestfinished', done);
    page.on('requestfailed', done);
    // A navigation drops the requests of the page it leaves.
    page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) state.pending.clear(); });
  }
  return state;
}

/**
 * Wait for the page to go quiet after an action: the document is loaded and no
 * background request has been running for a moment. Returns as soon as that is
 * true, and at the latest after `timeout` (the settle budget by default).
 */
async function settle(world, timeout) {
  const state = requests(world);
  const deadline = Date.now() + (timeout || settleBudget(world));
  await world.page.waitForLoadState('domcontentloaded', { timeout: Math.max(deadline - Date.now(), 1) }).catch(() => {});
  let quietSince = 0;
  while (Date.now() < deadline) {
    if (state.pending.size === 0) {
      if (!quietSince) quietSince = Date.now();
      if (Date.now() - quietSince >= 300) return;
    } else {
      quietSince = 0;
    }
    await world.page.waitForTimeout(40);
  }
}

/**
 * Run an action that makes the page talk to the server, and wait for the
 * exchange to finish: for a request or a navigation to start (a moment at
 * most) and for every request to end.
 */
async function afterRequests(world, fn) {
  const state = requests(world);
  const before = state.started;
  const url = world.page.url();
  const result = await fn();
  const startBy = Date.now() + 1500;
  while (state.started === before && world.page.url() === url && Date.now() < startBy) {
    await world.page.waitForTimeout(40);
  }
  await settle(world, budget(world));
  return result;
}

/** Open a URL and wait for the page to settle. */
async function open(world, url) {
  requests(world);
  try {
    await gotoUrl(world.page, url);
  } catch (err) {
    // A network interface that comes or goes on the machine (a container starting next door) aborts the navigation once: go again.
    if (!/ERR_NETWORK_CHANGED/.test(String(err && err.message))) throw err;
    await world.page.waitForTimeout(500);
    await gotoUrl(world.page, url);
  }
  await world.page.waitForSelector('body', { state: 'attached', timeout: budget(world) });
  await world.page.waitForLoadState('load', { timeout: budget(world) }).catch(() => {});
  await settle(world);
}

/**
 * Wait until a locator has (or, with `notCase`, no longer has) a visible match
 * and fail with a friendly error otherwise: the wait and the assertion are one
 * call, so content that arrives a moment late still passes.
 */
async function assertPresence(locator, notCase, { label, hint, timeout, found }) {
  try {
    await locator.first().waitFor({ state: notCase ? 'hidden' : 'visible', timeout });
  } catch {
    const seen = found ? await found().catch(() => '') : '';
    throw friendly({
      message: (notCase ? `Expected not to see ${label}, but it is on the page.` : `Expected to see ${label}, but it did not appear within ${timeout} ms.`) + (seen ? ` ${seen}` : ''),
      hint,
    });
  }
}

/**
 * Poll a reading until it satisfies a check, or fail with the last reading.
 *
 * @param {object} world
 * @param {Function} read - async () => value
 * @param {Function} check - (value) => boolean
 * @param {Function} explain - (value) => {message, hint}
 */
async function eventually(world, read, check, explain, timeout) {
  const deadline = Date.now() + (timeout || budget(world));
  let value;
  for (;;) {
    value = await read();
    if (check(value)) return value;
    if (Date.now() > deadline) throw friendly(explain(value));
    await world.page.waitForTimeout(200);
  }
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

/**
 * An account of the users registry in cucumber.js (`worldParameters.users`),
 * by the handle a scenario names it with.
 *
 * @returns {{handle: string, email: string, password: string, name: (string|undefined)}}
 */
function resolveUser(world, handle) {
  const users = (world.parameters && world.parameters.users) || {};
  const entry = users[handle];
  if (!entry) {
    throw friendly({
      message: `The user "${handle}" is not in the users registry. Known users: ${Object.keys(users).join(', ') || '(none)'}.`,
      hint: `Add it to worldParameters.users in cucumber.js: users: { ${handle}: { email: '${handle}@example.com', password: process.env.${String(handle).toUpperCase()}_PASSWORD } }. The account itself is created once by the build of the app, never by a feature.`,
    });
  }
  const email = entry.email || entry.username;
  if (!email || !entry.password) {
    throw friendly({
      message: `The user "${handle}" has no ${email ? 'password' : 'email address'} in the users registry.`,
      hint: `Set worldParameters.users.${handle}.email and .password in cucumber.js, from environment variables.`,
    });
  }
  return { handle, email, password: entry.password, name: entry.name };
}

/** A handle of the users registry stands for its address; anything else is an address. */
function addressOf(world, who) {
  const users = (world.parameters && world.parameters.users) || {};
  return users[who] ? resolveUser(world, who).email : who;
}

// The sessions of the accounts that logged in during this run, by site and
// address: the cookies of the browser after a login through the form. A
// scenario that logs in as an account that already has a session takes it
// over instead of filling in the login form again. That is quicker, and it
// keeps a suite under the limit the app puts on logins (five a minute for
// one address, every attempt counted). `worldParameters.reuseSessions: false`
// in cucumber.js turns it off.
const SESSIONS = new Map();

function sessionKey(world, email) {
  return `${siteRoot(world)}|${String(email).toLowerCase()}`;
}

function reuseSessions(world) {
  return !(world.parameters && world.parameters.reuseSessions === false);
}

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------

/**
 * The visible form control a person means by `name`: its label exactly as
 * written (the label element, `aria-labelledby` or `aria-label`), then its
 * `name` attribute, then the one label that starts with the text (letter case
 * ignored: "Email" is the "Email address" of a kit that writes it so), then
 * its placeholder. A control in an open dialog wins over one behind it.
 *
 * @returns {Promise<import('playwright').Locator>} one element
 */
async function findField(world, name, { timeout } = {}) {
  const page = world.page;
  const deadline = Date.now() + (timeout || budget(world));
  const candidates = () => [
    page.getByLabel(name, { exact: true }),
    page.locator(`[name="${String(name).replace(/["\\]/g, '\\$&')}"]`),
    page.getByLabel(new RegExp('^\\s*' + escapeRegExp(name), 'i')),
    page.getByPlaceholder(name, { exact: true }),
  ];
  for (;;) {
    for (const locator of candidates()) {
      const visible = [];
      const count = await locator.count().catch(() => 0);
      for (let i = 0; i < count; i += 1) {
        const item = locator.nth(i);
        if (await item.isVisible().catch(() => false)) visible.push(item);
      }
      if (visible.length === 1) return visible[0];
      if (visible.length > 1) {
        for (const item of visible) {
          if (await item.evaluate((el) => !!el.closest('dialog[open], [role="dialog"]')).catch(() => false)) return item;
        }
        return visible[0];
      }
    }
    if (Date.now() > deadline) break;
    await page.waitForTimeout(150);
  }
  const labels = await visibleFieldLabels(world);
  throw friendly({
    message: `No field "${name}" is on the page (${world.page.url()}). The fields are: ${listed(labels)}.`,
    hint: 'Name the field by its label as the page writes it, or by its name attribute ("email", "password").',
  });
}

/** The labels of the visible form controls of the page, for an error message. */
async function visibleFieldLabels(world) {
  return world.page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('input:not([type=hidden]), select, textarea')) {
      const box = el.getBoundingClientRect();
      if (!box.width && !box.height) continue;
      const by = (el.getAttribute('aria-labelledby') || '').split(/\s+/).map((id) => document.getElementById(id)).filter(Boolean);
      const text = by.length ? by.map((n) => n.textContent).join(' ') : ((el.labels && el.labels[0] && el.labels[0].textContent) || el.getAttribute('aria-label') || el.getAttribute('name') || '');
      out.push(text.replace(/\s+/g, ' ').trim());
    }
    return out;
  }).catch(() => []);
}

/**
 * The error messages shown for a field: the elements its `aria-errormessage`
 * or `aria-describedby` name, and the error lines inside the smallest
 * container that holds the field and no other field (`[role=alert]`, the
 * component kit's `[data-flux-error]`, the single-page kits' red text line).
 *
 * @returns {Promise<string[]>}
 */
async function fieldErrors(field) {
  return field.evaluate((el) => {
    const shown = (n) => {
      if (!n || !n.isConnected) return false;
      const style = getComputedStyle(n);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const box = n.getBoundingClientRect();
      return box.width > 0 || box.height > 0;
    };
    const text = (n) => (n.textContent || '').replace(/\s+/g, ' ').trim();
    const found = [];
    const ids = `${el.getAttribute('aria-errormessage') || ''} ${el.getAttribute('aria-describedby') || ''}`.split(/\s+/).filter(Boolean);
    for (const id of ids) {
      const node = document.getElementById(id);
      if (node && shown(node) && text(node)) found.push(text(node));
    }
    let group = null;
    for (let node = el.parentElement, i = 0; node && i < 6; node = node.parentElement, i += 1) {
      const others = [...node.querySelectorAll('input:not([type=hidden]), select, textarea')].filter((c) => c !== el);
      if (others.length) break;
      group = node;
    }
    if (group) {
      const lines = group.querySelectorAll('[role="alert"], [data-flux-error], [aria-live="assertive"], p[class*="text-red"], div[class*="text-red"], span[class*="text-red"], [class*="text-destructive"], [class*="error"]');
      for (const line of lines) {
        if (line === el || line.contains(el)) continue;
        if (shown(line) && text(line)) found.push(text(line));
      }
    }
    return [...new Set(found)];
  }).catch(() => []);
}

/** Every field error shown on the page, as `label: message`, for an error message. */
async function pageFieldErrors(world) {
  return world.page.evaluate(() => {
    const out = [];
    const nodes = [...document.querySelectorAll('[role="alert"], [data-flux-error], p[class*="text-red"], div[class*="text-red"]')];
    // The message a field names once the app marked it invalid (aria-invalid, then aria-errormessage or
    // aria-describedby): how a form whose errors carry no role or colour of the kits says which field failed.
    for (const field of document.querySelectorAll('[aria-invalid="true"]')) {
      for (const id of `${field.getAttribute('aria-errormessage') || ''} ${field.getAttribute('aria-describedby') || ''}`.split(/\s+/).filter(Boolean)) {
        const node = document.getElementById(id);
        if (node) nodes.push(node);
      }
    }
    for (const n of nodes) {
      const box = n.getBoundingClientRect();
      const t = (n.textContent || '').replace(/\s+/g, ' ').trim();
      if (t && (box.width || box.height) && getComputedStyle(n).display !== 'none') out.push(t);
    }
    return [...new Set(out)];
  }).catch(() => []);
}

/**
 * Fill a field the way webship-js's "I fill in" does: by its exact label,
 * placeholder or name. A field that none of them matches is looked for the
 * way a person reads it (findField): a label that carries a required mark
 * ("Password*"), on a form whose fields have no name attribute.
 */
async function fillLikeABuiltIn(world, name, value) {
  try {
    await fillField(world.page, name, value, world);
  } catch (err) {
    const field = await findField(world, name, { timeout: 1000 }).catch(() => null);
    if (!field) throw err;
    await field.fill(value === undefined || value === null ? '' : String(value));
  }
}

// ---------------------------------------------------------------------------
// Status lines and notifications
// ---------------------------------------------------------------------------

/**
 * The status lines of the page: the short confirmations an auth page shows
 * above or below its form ("We have emailed your password reset link.").
 * The three kits print them as a line of green text, with no role.
 */
async function statusLines(world) {
  return world.page.evaluate((kinds) => {
    const out = [];
    const toasts = ['ui-toast-group', '[data-sonner-toaster]', ...kinds.map((kind) => kind.selector)].join(', ');
    for (const n of document.querySelectorAll('[role="status"]:not(:empty), [class*="text-green"]')) {
      // A notification, or the region that holds the notifications, is not a status line.
      if (n.closest(toasts) || n.querySelector(kinds.map((kind) => kind.selector).join(', '))) continue;
      const box = n.getBoundingClientRect();
      const t = (n.textContent || '').replace(/\s+/g, ' ').trim();
      if (t && (box.width || box.height)) out.push(t);
    }
    return [...new Set(out)];
  }, notificationKinds()).catch(() => []);
}

// The kits show the outcome of a background save as a notification that
// fades after a few seconds: the component kit as `[data-flux-toast-dialog]`
// (`data-variant`), the single-page kits as `[data-sonner-toast]`
// (`data-type`); a pack that builds on this one adds its own (FRAME). A
// recorder keeps the ones shown since the last action, so an assertion a
// moment after the notification faded still reads it.
function recorderScript() {
  return `(() => {
  if (window.__webshipToastRecorder) return;
  window.__webshipToastRecorder = true;
  const KEY = '__webshipToasts';
  const KINDS = ${JSON.stringify(notificationKinds())};
  const typeOf = (node, kind) => {
    if (kind.attribute) return (node.getAttribute(kind.attribute) || '').toLowerCase();
    if (kind.prefix) {
      const found = [...node.classList].find((name) => name.startsWith(kind.prefix));
      return found ? found.slice(kind.prefix.length).toLowerCase() : '';
    }
    return '';
  };
  const read = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || '[]'); } catch (e) { return []; } };
  const record = (node, kind) => {
    if (!node || node.nodeType !== 1 || node.__webshipRecorded) return;
    const text = (node.textContent || '').replace(/\\s+/g, ' ').trim();
    if (!text) return;
    node.__webshipRecorded = true;
    const list = read();
    list.push({ type: typeOf(node, kind), text, at: Date.now() });
    try { sessionStorage.setItem(KEY, JSON.stringify(list.slice(-30))); } catch (e) { /* storage is full or blocked */ }
  };
  const scan = () => KINDS.forEach((kind) => document.querySelectorAll(kind.selector).forEach((node) => record(node, kind)));
  const start = () => {
    scan();
    new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  };
  if (document.documentElement) start(); else document.addEventListener('DOMContentLoaded', start);
})();`;
}

/** Start recording the notifications of this browser context (once). */
async function recordNotifications(world) {
  const script = recorderScript();
  if (!world.__toastsRecorded) {
    world.__toastsRecorded = true;
    await world.page.context().addInitScript(script);
  }
  await world.page.evaluate(script).catch(() => {});
}

/** Forget the notifications shown so far: the next assertion is about what the next action shows. */
async function forgetNotifications(world) {
  await world.page.evaluate(() => { try { sessionStorage.removeItem('__webshipToasts'); } catch (e) { /* ignore */ } }).catch(() => {});
}

const TOAST_TYPES = { success: 'success', danger: 'error', error: 'error', warning: 'warning', info: 'info', default: '' };

/** The notifications on the page now and the ones recorded since the last action, as `{type, text}`. */
async function shownNotifications(world) {
  const list = await world.page.evaluate((kinds) => {
    const typeOf = (node, kind) => {
      if (kind.attribute) return (node.getAttribute(kind.attribute) || '').toLowerCase();
      if (kind.prefix) {
        const found = [...node.classList].find((name) => name.startsWith(kind.prefix));
        return found ? found.slice(kind.prefix.length).toLowerCase() : '';
      }
      return '';
    };
    const now = [];
    for (const kind of kinds) {
      for (const node of document.querySelectorAll(kind.selector)) {
        const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
        if (text) now.push({ type: typeOf(node, kind), text });
      }
    }
    let recorded = [];
    try { recorded = JSON.parse(sessionStorage.getItem('__webshipToasts') || '[]'); } catch (e) { /* ignore */ }
    return [...recorded, ...now];
  }, notificationKinds()).catch(() => []);
  const seen = new Set();
  return list.map((item) => ({ type: Object.prototype.hasOwnProperty.call(TOAST_TYPES, item.type) ? TOAST_TYPES[item.type] : item.type, text: item.text }))
    .filter((item) => {
      const key = item.type + '|' + item.text;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

// ---------------------------------------------------------------------------
// The user menu and the navigation
// ---------------------------------------------------------------------------

/**
 * The button that opens the user menu: the one the three kits mark
 * `data-test="sidebar-menu-button"`, else a visible menu button of the
 * header (the narrow layouts), else one a pack that builds on this one added
 * to FRAME.userMenuTriggers.
 */
async function userMenuTrigger(world) {
  const page = world.page;
  const candidates = FRAME.userMenuTriggers.map((selector) => page.locator(selector));
  for (const locator of candidates) {
    const count = await locator.count().catch(() => 0);
    for (let i = 0; i < count; i += 1) {
      if (await locator.nth(i).isVisible().catch(() => false)) return locator.nth(i);
    }
  }
  return null;
}

/** The menu that is open now. */
function openMenu(world) {
  return world.page.locator('[role="menu"]:visible').last();
}

/** Open the user menu and return it, or fail with a friendly error. */
async function openUserMenu(world) {
  const trigger = await userMenuTrigger(world);
  if (!trigger) {
    throw friendly({
      message: `This page has no user menu (${world.page.url()}): nobody is signed in, or it is a page without the app's frame.`,
      hint: 'Log in first (I am a logged in user with the "..." user) and open a page of the app, such as the dashboard.',
    });
  }
  const menu = openMenu(world);
  if (!(await menu.isVisible().catch(() => false))) await trigger.click();
  try {
    await menu.waitFor({ state: 'visible', timeout: budget(world) });
  } catch (err) {
    throw friendly({ message: 'The user menu did not open.', cause: err, hint: 'The user menu opens from the button with the name of the signed-in user, at the foot of the sidebar.' });
  }
  return menu;
}

/** The text of the items of a menu (`role="menuitem"`). */
async function menuItems(menu) {
  return (await menu.getByRole('menuitem').allInnerTexts().catch(() => [])).map(clean).filter(Boolean);
}

/** Close a menu that is open (Escape). */
async function closeMenus(world) {
  if (await openMenu(world).isVisible().catch(() => false)) await world.page.keyboard.press('Escape').catch(() => {});
}

/**
 * The items of the navigation landmarks of the page (the sidebar, the settings
 * navigation): their text, their address and whether the page marks them as
 * the current one (`aria-current`, `data-current`, `data-active="true"`,
 * `aria-selected="true"`).
 */
async function navigationItems(world) {
  return world.page.evaluate(() => {
    const items = [];
    const navs = document.querySelectorAll('nav, [role="navigation"], [data-flux-sidebar] , [data-sidebar="sidebar"]');
    for (const nav of navs) {
      for (const link of nav.querySelectorAll('a[href]')) {
        const box = link.getBoundingClientRect();
        if (!box.width && !box.height) continue;
        const text = (link.textContent || link.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
        if (!text) continue;
        const marked = (node) => !!node && (
          (node.hasAttribute('aria-current') && node.getAttribute('aria-current') !== 'false')
          || (node.hasAttribute('data-current') && node.getAttribute('data-current') !== 'false')
          || node.getAttribute('data-active') === 'true'
          || node.getAttribute('aria-selected') === 'true');
        const current = marked(link) || marked(link.parentElement) || marked(link.closest('[data-sidebar="menu-button"], [data-slot="sidebar-menu-button"]'));
        items.push({ text, href: link.href, current, nav: nav.getAttribute('aria-label') || '' });
      }
    }
    const seen = new Set();
    return items.filter((item) => {
      const key = item.text + '|' + item.href;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }).catch(() => []);
}

// ---------------------------------------------------------------------------
// The mailbox of the test site
// ---------------------------------------------------------------------------

/**
 * The address of the mailbox that catches the mail of the app
 * (`worldParameters.mailUrl` in cucumber.js): a Mailpit, which every DDEV
 * project has at port 8026.
 */
function mailUrl(world) {
  const url = world.parameters && world.parameters.mailUrl;
  if (!url) {
    throw friendly({ message: 'No mailbox is configured.', hint: 'Set worldParameters.mailUrl in cucumber.js to the Mailpit of the app, for example https://your-app.ddev.site:8026.' });
  }
  return String(url).replace(/\/+$/, '');
}

/** The messages of the mailbox to an address, newest first, as Mailpit lists them. */
async function mailList(world, address) {
  const request = world.page.context().request;
  const response = await request.get(`${mailUrl(world)}/api/v1/search?query=${encodeURIComponent('to:' + address)}`, { failOnStatusCode: false, ignoreHTTPSErrors: true });
  if (!response.ok()) throw new Error(`the mailbox answered HTTP ${response.status()}`);
  return (await response.json()).messages || [];
}

/**
 * The newest e-mail to an address that arrived after a moment in time, once it
 * is there (and, when `subject` is given, with that subject).
 *
 * @returns {Promise<{id: string, subject: string, text: string, html: string}>}
 */
async function mailTo(world, address, { since = 0, subject = null, timeout } = {}) {
  const request = world.page.context().request;
  const base = mailUrl(world);
  const deadline = Date.now() + (timeout || budget(world) * 2);
  let found = null;
  let problem = '';
  let subjects = [];
  for (;;) {
    try {
      const messages = (await mailList(world, address)).filter((message) => !since || Date.parse(message.Created) >= since - 2000);
      subjects = messages.map((message) => message.Subject);
      found = messages.find((message) => !subject || clean(message.Subject) === clean(subject)) || null;
      problem = messages.length ? `it has ${messages.length} for that address since the step before, none with the subject "${subject}"` : 'it has none for that address since the step before';
      if (found) break;
    } catch (err) {
      problem = clean(err && err.message).split(' Call log')[0];
    }
    if (Date.now() > deadline) break;
    await world.page.waitForTimeout(300);
  }
  if (!found) {
    throw friendly({
      message: `No e-mail${subject ? ` "${subject}"` : ''} to ${address} arrived in the mailbox at ${base} (${problem}).${subjects.length ? ` Subjects: ${listed(subjects)}.` : ''}`,
      hint: 'The app must send its mail to this mailbox (MAIL_MAILER=smtp, MAIL_HOST and MAIL_PORT of the mail catcher), and the address must be the one of the account. Check worldParameters.mailUrl in cucumber.js.',
    });
  }
  const message = await (await request.get(`${base}/api/v1/message/${found.ID}`, { ignoreHTTPSErrors: true })).json();
  return { id: found.ID, subject: message.Subject || '', text: message.Text || '', html: message.HTML || '' };
}

/**
 * The address of a link of an e-mail, by the text a person clicks (the text
 * of the button of the HTML version, or the label before the address in the
 * text version: "Reset Password: https://…").
 */
function mailLink(mail, label) {
  const anchors = [...String(mail.html).matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => ({ href: m[1].replace(/&amp;/g, '&'), text: clean(m[2].replace(/<[^>]+>/g, ' ')) }));
  const byText = anchors.find((a) => a.text.toLowerCase() === clean(label).toLowerCase());
  if (byText) return { href: byText.href, anchors };
  const line = String(mail.text).split('\n').map((l) => l.trim()).find((l) => l.toLowerCase().startsWith(clean(label).toLowerCase() + ':'));
  const inLine = line && line.match(/https?:\/\/\S+/);
  return { href: inLine ? inLine[0].replace(/[)\].,]+$/, '') : null, anchors };
}

// ---------------------------------------------------------------------------
// Error pages
// ---------------------------------------------------------------------------

// The status texts of the error pages the framework renders.
const STATUS_TEXTS = {
  401: 'Unauthorized', 402: 'Payment Required', 403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed',
  419: 'Page Expired', 429: 'Too Many Requests', 500: 'Server Error', 503: 'Service Unavailable',
};

/**
 * The error page a single-page kit shows over the page: the answer of a
 * background request that was not one of its own pages (a 419, a 429, a 500)
 * goes into a dialog that holds it in a frame. Returns what that frame shows,
 * and the status of the newest background answer of that status, or null when
 * no such dialog is open.
 *
 * @returns {Promise<{title: string, heading: string, text: string, status: (number|null)}|null>}
 */
async function errorDialog(world) {
  const page = world.page;
  const open = await page.locator('dialog[open] iframe, [role="dialog"] iframe').count().catch(() => 0);
  if (!open) return null;
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    const title = clean(await frame.title().catch(() => ''));
    const heading = clean(await frame.locator('h1').first().innerText({ timeout: 500 }).catch(() => ''));
    const text = clean(await frame.locator('body').innerText({ timeout: 500 }).catch(() => ''));
    if (!text) continue;
    const code = (heading.match(/\b(\d{3})\b/) || text.match(/^(\d{3})\b/) || [])[1];
    const answers = requests(world).answers.filter((answer) => String(answer.status) === code);
    return { title, heading, text, status: answers.length ? answers[answers.length - 1].status : null };
  }
  return null;
}

/** The newest answer to a background request with a status, since a moment in time. */
function backgroundAnswer(world, status, since = 0) {
  const answers = requests(world).answers.filter((answer) => answer.status === status && answer.at >= since);
  return answers.length ? answers[answers.length - 1] : null;
}

/**
 * The status of the document the browser shows: the one webship-js recorded
 * for the last navigation of the page (`_lastResponse`), else the one the
 * browser keeps in its navigation timing.
 */
async function documentStatus(world) {
  const last = world._lastResponse;
  const strip = (url) => String(url || '').split('#')[0];
  if (last && last.page === world.page && strip(last.url) === strip(world.page.url())) return last.status;
  return world.page.evaluate(() => {
    const entry = performance.getEntriesByType('navigation')[0];
    return entry && typeof entry.responseStatus === 'number' && entry.responseStatus ? entry.responseStatus : null;
  }).catch(() => null);
}

module.exports = {
  FRAME,
  budget,
  settleBudget,
  escapeRegExp,
  clean,
  listed,
  siteRoot,
  siteUrl,
  homePath,
  loginPath,
  currentPath,
  isOnPath,
  requests,
  settle,
  afterRequests,
  open,
  assertPresence,
  eventually,
  resolveUser,
  addressOf,
  SESSIONS,
  sessionKey,
  reuseSessions,
  findField,
  visibleFieldLabels,
  fieldErrors,
  pageFieldErrors,
  fillLikeABuiltIn,
  statusLines,
  recordNotifications,
  forgetNotifications,
  shownNotifications,
  userMenuTrigger,
  openMenu,
  openUserMenu,
  menuItems,
  closeMenus,
  navigationItems,
  mailUrl,
  mailList,
  mailTo,
  mailLink,
  STATUS_TEXTS,
  documentStatus,
  errorDialog,
  backgroundAnswer,
};
