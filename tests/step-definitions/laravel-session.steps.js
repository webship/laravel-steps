'use strict';

// The session: logging in by a handle of the users registry or by an address
// and a password, logging out, who is signed in, the login form, and the limit
// the app puts on login attempts.
//
// Accounts are configuration, not test data: they are listed in cucumber.js
// (`worldParameters.users`) and created once by the build of the app. A
// feature never creates or deletes users.
//
// Every assertion waits on the page (the assertion is the wait), and every
// failure is a friendly error with a hint instead of a raw Playwright timeout.

const { Given, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  clean,
  siteUrl,
  homePath,
  loginPath,
  isOnPath,
  currentPath,
  settle,
  open,
  assertPresence,
  resolveUser,
  SESSIONS,
  sessionKey,
  reuseSessions,
  pageFieldErrors,
  recordNotifications,
  userMenuTrigger,
  openUserMenu,
  closeMenus,
  documentStatus,
  backgroundAnswer,
} = require('./laravel-helpers');

const LOGIN_HINT = 'The login form is at /login (worldParameters.loginPath): the fields "Email address" and "Password" and the "Log in" button (data-test="login-button"). Check launchUrl in cucumber.js.';

/** The login form: the form that holds the password field of the login page. */
function loginForm(world) {
  return world.page.locator('form:has(input[type="password"][name="password"]), form:has(input[name="email"]):has(input[type="password"])').first();
}

/** The address field of the login form ("Email address"), by its label first. */
async function emailField(world) {
  for (const label of ['Email address', 'Email']) {
    const byLabel = world.page.getByLabel(label, { exact: true });
    if (await byLabel.count()) return byLabel.first();
  }
  return world.page.locator('form input[name="email"]').first();
}

/** The password field of the login form. */
async function passwordField(world) {
  const byLabel = world.page.getByLabel('Password', { exact: true });
  if (await byLabel.count()) return byLabel.first();
  return world.page.locator('form input[name="password"]').first();
}

/** Open the login page as a visitor: the browser forgets the session it had. */
async function openLoginForm(world) {
  await world.page.context().clearCookies();
  world.__sessionKey = null;
  await open(world, siteUrl(world, loginPath(world)));
  try {
    await loginForm(world).waitFor({ state: 'visible', timeout: budget(world) });
  } catch (err) {
    throw friendly({ message: `The login form did not appear at ${siteUrl(world, loginPath(world))} (${world.page.url()}).`, cause: err, hint: LOGIN_HINT });
  }
}

/**
 * The 429 page the login route answers once the limit of attempts is reached:
 * as the page (a form sent the classic way), or as the answer to the request a
 * single-page kit sent, which it shows in a dialog over the login form.
 */
async function throttled(world, since) {
  return (await documentStatus(world)) === 429
    || /^\s*Too Many Requests\s*$/i.test(await world.page.title().catch(() => ''))
    || !!backgroundAnswer(world, 429, since);
}

/**
 * Fill in and submit the login form, then wait for one of its outcomes: a page
 * that is not the login page (the dashboard, the verification notice, the
 * page asked for), an error under a field, or the 429 page.
 *
 * @returns {Promise<{error: string, throttled: boolean}>}
 */
async function submitLogin(world, email, password, { remember = false } = {}) {
  await openLoginForm(world);
  await (await emailField(world)).fill(email);
  await (await passwordField(world)).fill(password);
  if (remember) {
    const box = world.page.getByRole('checkbox', { name: 'Remember me' });
    if (await box.count()) {
      if (!(await box.first().isChecked().catch(() => false))) await box.first().click();
    } else {
      throw friendly({ message: 'The login form has no "Remember me" checkbox.', hint: LOGIN_HINT });
    }
  }
  const button = world.page.locator('[data-test="login-button"]');
  const submit = (await button.count()) ? button.first() : loginForm(world).locator('button[type="submit"]').first();
  const sentAt = Date.now();
  await submit.click();
  const deadline = Date.now() + 30000;
  for (;;) {
    if (await throttled(world, sentAt)) return { error: 'Too Many Requests (HTTP 429)', throttled: true };
    if (!isOnPath(world, loginPath(world))) break;
    const errors = await pageFieldErrors(world);
    if (errors.length) return { error: errors.join(' '), throttled: false };
    if (Date.now() > deadline) {
      throw friendly({ message: `Logging in as "${email}" led neither to a page of the app nor to an error (${world.page.url()}).`, hint: LOGIN_HINT });
    }
    await world.page.waitForTimeout(150);
  }
  await settle(world);
  return { error: '', throttled: false };
}

/**
 * Log in through the form; when the app answers that there were too many
 * attempts, wait the time its Retry-After header gives (a minute at most) and
 * try once more.
 */
async function loginThroughTheForm(world, user, options) {
  let outcome = await submitLogin(world, user.email, user.password, options);
  if (outcome.throttled) {
    const retry = Math.min(Number((world._lastResponse && world._lastResponse.headers && world._lastResponse.headers['retry-after']) || 60), 65);
    process.stderr.write(`\n[laravel-steps] the login of ${user.email} was refused for too many attempts: waiting ${retry} s, as the app asks (Retry-After).\n`);
    await world.page.waitForTimeout((retry + 1) * 1000);
    outcome = await submitLogin(world, user.email, user.password, options);
  }
  return outcome;
}

/** The address the app shows for the signed-in account, or an empty string when nobody is. */
async function signedInAddress(world) {
  if (!(await userMenuTrigger(world))) {
    await open(world, siteUrl(world, homePath(world)));
  }
  if (await userMenuTrigger(world)) {
    const menu = await openUserMenu(world);
    const text = clean(await menu.innerText().catch(() => ''));
    await closeMenus(world);
    const found = text.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
    return found ? found[0] : text;
  }
  // The verification notice has no user menu: the profile page names the address.
  if (isOnPath(world, loginPath(world))) return '';
  await open(world, siteUrl(world, '/settings/profile'));
  if (isOnPath(world, loginPath(world))) return '';
  const field = world.page.locator('input[name="email"]').first();
  return (await field.count()) ? clean(await field.inputValue().catch(() => '')) : '';
}

/** Take over the session an account opened earlier in this run. */
async function restoreSession(world, user) {
  const key = sessionKey(world, user.email);
  const cookies = SESSIONS.get(key);
  if (!cookies || !reuseSessions(world)) return false;
  const context = world.page.context();
  await context.clearCookies();
  await context.addCookies(cookies);
  await open(world, siteUrl(world, homePath(world)));
  if (!isOnPath(world, loginPath(world))) {
    world.__sessionKey = key;
    return true;
  }
  // The session ended since (a logout, a timeout): log in again.
  SESSIONS.delete(key);
  await context.clearCookies();
  return false;
}

/**
 * Log in as an account of the users registry (`worldParameters.users` in
 * cucumber.js), by its handle. An account that logged in earlier in the run
 * takes its session over; otherwise the step logs in through the login form.
 * The browser ends on the page the app shows after a login: the dashboard, or
 * the verification notice for an account whose address is not verified.
 *
 * Example #1: Given I am a logged in user with the "member" user
 * Example #2: Given we are a logged in user with the "unverified" user
 * Example #3: Given I am a logged in user with "member"
 * Example #4: And I am a logged in user with the "member" user
 * Example #5: Given we are a logged in user with the "member" user
 */
Given(/^(I am |we are )*a logged in user with( the)* "([^"]*)"( user)*$/, { timeout: 120000 }, async function (pronounCase, theCase, handle, userCase) {
  const user = resolveUser(this, handle);
  await recordNotifications(this);
  if (await restoreSession(this, user)) return;
  const outcome = await loginThroughTheForm(this, user);
  if (outcome.error) {
    throw friendly({
      message: `Could not log in as "${handle}" (${user.email}): ${outcome.error}`,
      hint: outcome.throttled
        ? 'The app allows five login attempts a minute for one address. Keep session reuse on (worldParameters.reuseSessions) and log in through the form only where a scenario tests the form.'
        : 'Check the address and the password of the account in worldParameters.users, and that the build of the app created the account.',
    });
  }
  if (reuseSessions(this)) {
    const key = sessionKey(this, user.email);
    SESSIONS.set(key, await this.page.context().cookies());
    this.__sessionKey = key;
  }
});

/**
 * Log in through the login form as an account of the users registry, as a
 * person does: a new session, never one taken over. For the scenarios that
 * test the form itself; the step fails when the app refuses the login.
 *
 * Example #1: When I log in as "member" with the login form
 * Example #2: When we log in as "unverified" with the login form
 * Example #3: When I log in as "member" with the login form and "Remember me" checked
 * Example #4: And I log in as "member" with the login form
 * Example #5: When we log in as "member" with the login form and "Remember me" checked
 */
When(/^(I |we )*log in as "([^"]*)" with the login form( and "Remember me" checked)?$/, { timeout: 120000 }, async function (pronounCase, handle, rememberCase) {
  const user = resolveUser(this, handle);
  await recordNotifications(this);
  const outcome = await loginThroughTheForm(this, user, { remember: !!rememberCase });
  if (outcome.error) {
    throw friendly({
      message: `The login form refused "${handle}" (${user.email}): ${outcome.error}`,
      hint: 'Check the address and the password of the account in worldParameters.users, and that the build of the app created the account.',
    });
  }
});

/**
 * Submit the login form with an address and a password. The step does not
 * expect the login to succeed: assert the outcome with the next step (an
 * error under the "Email address" field, the dashboard).
 *
 * Example #1: When I log in with the email "member@example.com" and the password "wrong-password"
 * Example #2: When we log in with the email "nobody@example.com" and the password "Whatever-123!"
 * Example #3: When I log in with the email "unverified@example.com" and the password "wrong-password"
 * Example #4: And I log in with the email "member@example.com" and the password "wrong-password"
 * Example #5: When we log in with the email "no-such-account@example.org" and the password "Nothing-at-all-1!"
 */
When(/^(I |we )*log in with the email "([^"]*)" and the password "([^"]*)"$/, async function (pronounCase, email, password) {
  await recordNotifications(this);
  await submitLogin(this, email, password);
});

/**
 * Submit the login form several times with an address and a wrong password,
 * as a person who keeps guessing does, and stop as soon as the app refuses
 * further attempts (HTTP 429). The app counts every attempt for one address
 * for a minute; assert the outcome with "I should see the 429 error page".
 * Use an address no other scenario logs in with: the limit is kept for a
 * minute.
 *
 * Example #1: When I try to log in 6 times with the email "guess@example.com" and a wrong password
 * Example #2: When we try to log in 6 times with the email "someone-else@example.com" and a wrong password
 * Example #3: When I try to log in 3 times with the email "guess@example.org" and a wrong password
 * Example #4: And I try to log in 10 times with the email "guess@example.com" and a wrong password
 * Example #5: When I try to log in 6 times with the email "throttle@example.com" and a wrong password
 */
When(/^(I |we )*try to log in (\d+) times with the email "([^"]*)" and a wrong password$/, { timeout: 120000 }, async function (pronounCase, times, email) {
  for (let i = 0; i < Number(times); i += 1) {
    const outcome = await submitLogin(this, email, `wrong-password-${i}`);
    if (outcome.throttled) return;
  }
});

/**
 * Log out as a person does: through "Log out" in the user menu, or the "Log
 * out" button of a page without the menu (the verification notice). The
 * session ends on the server, so no later scenario takes it over.
 *
 * Example #1: When I log out
 * Example #2: When we log out
 * Example #3: And I log out
 * Example #4: Then I log out
 * Example #5: Given I log out
 */
When(/^(I |we )*log out$/, async function (pronounCase) {
  const page = this.page;
  const trigger = await userMenuTrigger(this);
  let item;
  if (trigger) {
    const menu = await openUserMenu(this);
    item = menu.getByRole('menuitem', { name: 'Log out' });
    if (!(await item.count())) item = menu.locator('[data-test="logout-button"]');
  } else {
    item = page.locator('[data-test="logout-button"]:visible, button:visible:has-text("Log out"), a:visible:has-text("Log out")');
  }
  if (!(await item.count())) {
    throw friendly({ message: `There is nothing to log out with on this page (${page.url()}): no user menu and no "Log out" button.`, hint: 'Log in first, and open a page of the app (the dashboard, the settings).' });
  }
  for (const key of [...SESSIONS.keys()]) {
    if (key === this.__sessionKey) SESSIONS.delete(key);
  }
  this.__sessionKey = null;
  const from = page.url();
  await item.first().click();
  try {
    await page.waitForURL((url) => url.toString() !== from, { timeout: budget(this) });
  } catch (err) {
    throw friendly({ message: `Logging out did not leave the page (${from}).`, cause: err, hint: 'The app sends a signed-out visitor to its home page.' });
  }
  await settle(this);
});

/**
 * Assert that somebody is, or nobody is, logged in. The step opens the page
 * signed-in users land on (`homePath`, /dashboard): a visitor is sent to the
 * login form instead.
 *
 * Example #1: Then I should be logged in
 * Example #2: Then I should not be logged in
 * Example #3: Then we should be logged in
 * Example #4: And we should not be logged in
 * Example #5: But I should not be logged in
 */
Then(/^(I |we )*should( not)* be logged in$/, async function (pronounCase, notCase) {
  await open(this, siteUrl(this, homePath(this)));
  const signedIn = !isOnPath(this, loginPath(this));
  if (notCase && signedIn) {
    throw friendly({ message: `Expected nobody to be logged in, but ${homePath(this)} opened without the login form (${this.page.url()}).`, hint: 'Log out first (I log out), or start from a new visitor (I am an anonymous user).' });
  }
  if (!notCase && !signedIn) {
    throw friendly({ message: `Expected to be logged in, but ${homePath(this)} sent the browser to the login form.`, hint: 'Log in first (I am a logged in user with the "..." user).' });
  }
});

/**
 * Assert who is logged in, by a handle of the users registry: the user menu
 * names the address of the signed-in account (the profile settings page does,
 * for an account the app keeps on the verification notice).
 *
 * Example #1: Then I should be logged in as "member"
 * Example #2: Then we should be logged in as "unverified"
 * Example #3: And I should be logged in as "member"
 * Example #4: Then I should be logged in as "unverified"
 * Example #5: And we should be logged in as "member"
 */
Then(/^(I |we )*should be logged in as "([^"]*)"$/, async function (pronounCase, handle) {
  const user = resolveUser(this, handle);
  const address = await signedInAddress(this);
  if (!address) {
    throw friendly({ message: `Expected "${handle}" (${user.email}) to be logged in, but nobody is (${this.page.url()}).`, hint: 'Log in first (I am a logged in user with the "..." user).' });
  }
  if (address.toLowerCase() !== user.email.toLowerCase()) {
    throw friendly({ message: `Expected "${handle}" (${user.email}) to be logged in, but the app names ${address}.`, hint: 'The user menu shows the name and the address of the signed-in account.' });
  }
});

/**
 * Assert that the page shows, or does not show, the login form (the address
 * and password fields and the "Log in" button), for instance after a page
 * that needs a session sent a visitor to it.
 *
 * Example #1: Then I should see the login form
 * Example #2: Then I should not see the login form
 * Example #3: And we should see the login form
 * Example #4: Then we should not see the login form
 * Example #5: But I should see the login form
 */
Then(/^(I |we )*should( not)* see the login form$/, async function (pronounCase, notCase) {
  await assertPresence(this.page.locator('form:has([data-test="login-button"]), form:has(input[name="email"]):has(input[type="password"]):has(button[type="submit"])'), notCase, {
    label: 'the login form',
    hint: LOGIN_HINT,
    timeout: budget(this),
    found: async () => `The page is ${this.page.url()} ("${clean(await this.page.title())}").`,
  });
  if (!notCase && !isOnPath(this, loginPath(this))) {
    throw friendly({ message: `A login form is on the page, but the page is ${currentPath(this)}, not ${loginPath(this)}.`, hint: 'Check worldParameters.loginPath in cucumber.js.' });
  }
});

