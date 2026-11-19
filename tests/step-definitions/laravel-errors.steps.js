'use strict';

// The pages the framework answers with when something is refused or goes
// wrong: the error pages by their status (403, 404, 419, 429, 500, 503), the
// check that a live app shows no debug information, a form sent to the app
// from another site (refused with "Page Expired"), and the way past the
// maintenance page.
//
// The status a step reads is the one the browser received for the page on
// screen (webship-js records it for every navigation), so it follows the
// session and the forms the scenario sent; webship-js's own "the response
// status code should be ..." reads the same.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  clean,
  listed,
  siteUrl,
  currentPath,
  settle,
  open,
  STATUS_TEXTS,
  documentStatus,
  errorDialog,
} = require('./laravel-helpers');

/** What the page on screen says about itself: its status, title, main heading and text. */
async function pageSummary(world) {
  const status = await documentStatus(world);
  const title = clean(await world.page.title().catch(() => ''));
  const heading = clean(await world.page.locator('h1').first().innerText({ timeout: 500 }).catch(() => ''));
  const text = clean(await world.page.locator('body').innerText({ timeout: 1000 }).catch(() => ''));
  return { status, title, heading, text };
}

/**
 * Assert that the browser shows the error page of a status: the page answered
 * with that status, and it shows the code (and, for the statuses the framework
 * names, the status text: "Not Found", "Page Expired", "Server Error",
 * "Service Unavailable"). An app with error pages of its own passes as long as
 * they print the code. On the single-page kits a form that gets an error page
 * for an answer shows it in a dialog over the page: the step reads that dialog
 * and the status of the answer it holds.
 *
 * Example #1: Then I should see the 404 error page
 * Example #2: Then I should see the 403 error page
 * Example #3: And I should see the 419 error page
 * Example #4: Then we should see the 500 error page
 * Example #5: Then I should not see the 404 error page
 */
Then(/^(I |we )*should( not)* see the (\d{3}) error page$/, async function (pronounCase, notCase, code) {
  const wanted = Number(code);
  const name = STATUS_TEXTS[wanted];
  const deadline = Date.now() + budget(this);
  let summary;
  const showsIn = (s) => !!s && s.status === wanted && (s.heading.includes(code) || s.text.includes(code)) && (!name || s.text.includes(name) || s.title.includes(name));
  for (;;) {
    summary = await pageSummary(this);
    const shows = showsIn(summary) || showsIn(await errorDialog(this));
    if (notCase ? !shows : shows) return;
    if (notCase || Date.now() > deadline) break;
    await this.page.waitForTimeout(200);
  }
  const what = `HTTP ${summary.status === null ? '(status unknown)' : summary.status}, "${summary.title}"${summary.heading ? `, heading "${summary.heading}"` : ''}`;
  if (notCase) {
    throw friendly({ message: `Expected not to see the ${code} error page, but the browser shows it (${what}) at ${currentPath(this)}.`, hint: 'The step reads the status the browser received for the page on screen.' });
  }
  throw friendly({
    message: `Expected the ${code}${name ? ` (${name})` : ''} error page, but the browser shows ${what} at ${currentPath(this)}: "${summary.text.slice(0, 160)}".`,
    hint: summary.status === wanted
      ? `The status is right, but the page does not print the code ${code}${name ? ` and "${name}"` : ''}: an app with its own error pages should print them.`
      : 'The step reads the status the browser received for the page on screen (the one the last navigation, link or form brought).',
  });
});

/** The signs of a debug page the page shows: what a live app must never print. */
async function debugSigns(world) {
  return world.page.evaluate(() => {
    const text = (document.body ? document.body.innerText : '').replace(/\s+/g, ' ');
    const headings = [...document.querySelectorAll('h1, h2')].map((h) => h.textContent.replace(/\s+/g, ' ').trim());
    const signs = [];
    const exception = headings.find((h) => /\b[A-Z][A-Za-z]*(?:Exception|Error)\b/.test(h) && !/^\d{3}\b/.test(h));
    if (exception) signs.push(`the exception class "${exception}"`);
    if (/\b(?:Exception|Stack) trace\b/i.test(text)) signs.push('an exception trace');
    const file = text.match(/[\w./-]+\.php:\d+/);
    if (file) signs.push(`a source file "${file[0]}"`);
    const runtime = text.match(/\bPHP \d+\.\d+(?:\.\d+)?\b/);
    if (runtime) signs.push(`the runtime version "${runtime[0]}"`);
    if (/\b(?:Illuminate|Symfony)\\[A-Z]/.test(text)) signs.push('class names of the framework');
    if (/\bCopy as Markdown\b/.test(text)) signs.push('the "Copy as Markdown" button of the debug page');
    return signs;
  }).catch(() => []);
}

/**
 * Assert that the page shows no debug information: no exception class, no
 * exception trace, no source file and line, no runtime version. A live app
 * answers an error with a plain error page; a debug page shows how the app is
 * built to anybody.
 *
 * Example #1: Then the page should not show debug information
 * Example #2: And the page should not show debug information
 * Example #3: Then the page should show debug information
 * Example #4: But the page should not show debug information
 * Example #5: Then the page should not show debug information
 */
Then(/^the page should( not)* show debug information$/, async function (notCase) {
  const signs = await debugSigns(this);
  if (notCase && signs.length) {
    throw friendly({
      message: `The page shows debug information: ${signs.join(', ')} (${currentPath(this)}).`,
      hint: 'A live app runs with APP_DEBUG=false: an error then renders the plain error page. Check the environment of the app.',
    });
  }
  if (!notCase && !signs.length) {
    const summary = await pageSummary(this);
    throw friendly({
      message: `Expected the page to show debug information, but it shows none (HTTP ${summary.status}, "${summary.title}").`,
      hint: 'An app shows its debug page only with APP_DEBUG=true.',
    });
  }
});

/**
 * Send a form to an address of the app from a page of another site, as a
 * forged form on somebody else's page does: the browser posts it with no valid
 * token and says it comes from another site. The app must refuse it with its
 * "Page Expired" page (419); assert that with the next step.
 *
 * Example #1: When a page of another site sends a form to "/login"
 * Example #2: When a page of another site sends a form to "/register"
 * Example #3: And a page of another site sends a form to "/forgot-password"
 * Example #4: When a page of another site sends a form to "/logout"
 * Example #5: When a page of another site sends a form to "/user/confirm-password"
 */
When(/^a page of another site sends a form to "([^"]*)"$/, async function (path) {
  const action = siteUrl(this, path);
  const page = this.page;
  await page.goto('about:blank');
  await page.setContent(`<!doctype html><title>Another site</title><form method="post" action="${action.replace(/"/g, '&quot;')}"><input type="hidden" name="_token" value="a-token-of-another-site"><input type="hidden" name="email" value="nobody@example.com"><input type="hidden" name="password" value="not-a-password"><button type="submit">Send</button></form>`);
  try {
    await Promise.all([
      page.waitForNavigation({ timeout: budget(this) }),
      page.locator('button[type="submit"]').click(),
    ]);
  } catch (err) {
    throw friendly({ message: `The form of the other site did not reach ${action}.`, cause: err, hint: 'Check launchUrl in cucumber.js.' });
  }
  await page.waitForLoadState('load', { timeout: budget(this) }).catch(() => {});
  await settle(this);
});

/**
 * Open the address that lets this browser past the maintenance page: the
 * secret the app was put down with (`php artisan down --secret=...`), from
 * `worldParameters.maintenanceSecret` in cucumber.js. The app answers with a
 * cookie and sends the browser to its home page.
 *
 * Example #1: When I use the maintenance bypass
 * Example #2: When we use the maintenance bypass
 * Example #3: And I use the maintenance bypass
 * Example #4: Given I use the maintenance bypass
 * Example #5: Then we use the maintenance bypass
 */
When(/^(I |we )*use the maintenance bypass$/, async function (pronounCase) {
  const secret = this.parameters && this.parameters.maintenanceSecret;
  if (!secret) {
    throw friendly({ message: 'No maintenance secret is configured.', hint: 'Set worldParameters.maintenanceSecret in cucumber.js to the secret the app was put down with (php artisan down --secret=...).' });
  }
  await open(this, siteUrl(this, '/' + String(secret).replace(/^\/+/, '')));
  const cookies = (await this.page.context().cookies()).map((cookie) => cookie.name);
  if (!cookies.some((name) => /maintenance/i.test(name))) {
    const summary = await pageSummary(this);
    throw friendly({
      message: `The maintenance bypass gave this browser no cookie (HTTP ${summary.status}, "${summary.title}" at ${currentPath(this)}). Cookies: ${listed(cookies)}.`,
      hint: 'The app must be down with this secret (php artisan down --secret=...), and worldParameters.maintenanceSecret must be that secret.',
    });
  }
});
