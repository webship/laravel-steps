'use strict';

// The pages around an account that the app's auth layer serves: the password
// reset through the mail it sends, the notice an account with an address not
// yet verified is kept on, and the password confirmation in front of a
// sensitive page. The mail is read from the mailbox of the test app
// (`worldParameters.mailUrl`, a Mailpit).
//
// Registration is tested through its refusals only, with webship-js's own
// steps and the field errors of laravel-forms.steps.js: no scenario of this
// pack completes a sign-up.

const { Before, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  clean,
  listed,
  siteUrl,
  currentPath,
  settle,
  open,
  assertPresence,
  resolveUser,
  addressOf,
  findField,
  pageFieldErrors,
  statusLines,
  recordNotifications,
  mailUrl,
  mailList,
  mailTo,
  mailLink,
} = require('./laravel-helpers');

const RESET_HINT = 'The page "Forgot your password?" of the login form (/forgot-password) has an "Email address" field and the button "Email password reset link" (data-test="email-password-reset-link-button").';

// A mail step reads the mail that arrived since the scenario started, or since
// the step of this pack that asked for mail (a password reset link): never a
// mail of an earlier scenario or run.
Before(function () {
  this.__mailAskedAt = 0;
  this.__scenarioStartedAt = Date.now();
});

/** The moment from which a mail step reads the mailbox. */
function mailSince(world) {
  return world.__mailAskedAt || world.__scenarioStartedAt || 0;
}

/**
 * Ask for a password reset link, as a person does: the "Forgot password"
 * page, the address of an account (a handle of the users registry stands for
 * its address, anything else is used as it is), the button. Assert the outcome
 * with the next step: the status message, or the error under the field.
 *
 * Example #1: When I ask for a password reset link for "member"
 * Example #2: When we ask for a password reset link for "unverified"
 * Example #3: When I ask for a password reset link for "nobody@example.com"
 * Example #4: And I ask for a password reset link for "member" again
 * Example #5: When we ask for a password reset link for "member@example.com"
 */
When(/^(I |we )*ask for a password reset link for "([^"]*)"( again)?$/, async function (pronounCase, who, againCase) {
  const address = addressOf(this, who);
  await recordNotifications(this);
  await open(this, siteUrl(this, '/forgot-password'));
  let field;
  try {
    field = await findField(this, 'Email address', { timeout: budget(this) });
  } catch (err) {
    throw friendly({ message: `The password reset page did not show its form (${this.page.url()}).`, hint: RESET_HINT });
  }
  await field.fill(address);
  const button = this.page.locator('[data-test="email-password-reset-link-button"]');
  const submit = (await button.count()) ? button.first() : this.page.getByRole('button', { name: 'Email password reset link' });
  if (!againCase || !this.__mailAskedAt) this.__mailAskedAt = Date.now();
  await submit.click();
  // One of two outcomes: the status line, or an error under the field.
  const deadline = Date.now() + budget(this);
  while (Date.now() < deadline) {
    if ((await statusLines(this)).length || (await pageFieldErrors(this)).length) break;
    await this.page.waitForTimeout(150);
  }
  await settle(this);
});

/**
 * Assert that the app sent an e-mail with a subject to an address (a handle of
 * the users registry stands for its address) since the step that asked for it.
 *
 * Example #1: Then an email with the subject "Reset your password" should be sent to "member"
 * Example #2: Then an email with the subject "Verify your email address" should be sent to "unverified"
 * Example #3: And an email with the subject "Reset your password" should be sent to "member@example.com"
 * Example #4: Then an email with the subject "Reset your password" should be sent to "unverified"
 * Example #5: And an email with the subject "Verify your email address" should be sent to "unverified@example.com"
 */
Then(/^an email with the subject "([^"]*)" should be sent to "([^"]*)"$/, async function (subject, who) {
  await mailTo(this, addressOf(this, who), { since: mailSince(this), subject });
});

/**
 * Assert that the app sent no e-mail to an address since the step that asked
 * for one: a request it refused sends nothing.
 *
 * Example #1: Then no email should be sent to "nobody@example.com"
 * Example #2: Then no email should be sent to "member"
 * Example #3: And no email should be sent to "unverified"
 * Example #4: Then no email should be sent to "no-such-account@example.org"
 * Example #5: And no email should be sent to "nobody@example.com"
 */
Then(/^no email should be sent to "([^"]*)"$/, async function (who) {
  const address = addressOf(this, who);
  // Mail goes out while the app answers the request; a moment more is for a slow mail catcher.
  await this.page.waitForTimeout(1000);
  let messages;
  try {
    messages = (await mailList(this, address)).filter((message) => Date.parse(message.Created) >= mailSince(this) - 1000);
  } catch (err) {
    throw friendly({ message: `The mailbox at ${mailUrl(this)} could not be read.`, cause: err, hint: 'Check worldParameters.mailUrl in cucumber.js.' });
  }
  if (messages.length) {
    throw friendly({ message: `Expected no e-mail to ${address}, but the app sent: ${listed(messages.map((message) => message.Subject))}.`, hint: 'The step counts the mail that arrived since the step that asked for one.' });
  }
});

/**
 * Assert that the newest e-mail to an address with a subject holds a text.
 *
 * Example #1: Then the email with the subject "Reset your password" to "member" should contain "This password reset link will expire in 60 minutes."
 * Example #2: Then the email with the subject "Verify your email address" to "unverified" should contain "Please click the button below to verify your email address."
 * Example #3: And the email with the subject "Reset your password" to "member" should contain "If you did not request a password reset, no further action is required."
 * Example #4: Then the email with the subject "Reset your password" to "member@example.com" should contain "Reset Password"
 * Example #5: And the email with the subject "Verify your email address" to "unverified" should contain "Verify Email Address"
 */
Then(/^the email with the subject "([^"]*)" to "([^"]*)" should contain "([^"]*)"$/, async function (subject, who, text) {
  const mail = await mailTo(this, addressOf(this, who), { since: mailSince(this), subject });
  if (!clean(mail.text).includes(clean(text)) && !clean(mail.html.replace(/<[^>]+>/g, ' ')).includes(clean(text))) {
    throw friendly({ message: `The e-mail "${mail.subject}" to ${addressOf(this, who)} does not contain "${text}". It reads: ${clean(mail.text).slice(0, 300)}…`, hint: 'The step compares the text with white space collapsed.' });
  }
});

/**
 * Open a link of an e-mail the app sent, by the text a person clicks (the
 * button of the mail), as a person does: the newest e-mail to the address
 * (a handle of the users registry stands for its address) that holds such a
 * link, since the step that asked for it. "with a changed signature" opens a
 * copy of a signed link whose signature was altered, as a link that was
 * tampered with arrives.
 *
 * Example #1: When I open the "Reset Password" link of the email to "member"
 * Example #2: When I open the "Verify Email Address" link of the email to "unverified" with a changed signature
 * Example #3: And we open the "Reset Password" link of the email to "unverified"
 * Example #4: When I open the "Reset Password" link of the email to "member@example.com"
 * Example #5: When we open the "Verify Email Address" link of the email to "unverified@example.com" with a changed signature
 */
When(/^(I |we )*open the "([^"]*)" link of the email to "([^"]*)"( with a changed signature)?$/, async function (pronounCase, label, who, tamperCase) {
  const address = addressOf(this, who);
  const deadline = Date.now() + budget(this) * 2;
  let link = null;
  let mail = null;
  for (;;) {
    mail = await mailTo(this, address, { since: mailSince(this), timeout: Math.max(deadline - Date.now(), 1000) });
    link = mailLink(mail, label);
    if (link.href || Date.now() > deadline) break;
    await this.page.waitForTimeout(300);
  }
  if (!link.href) {
    throw friendly({ message: `The newest e-mail to ${address} ("${mail.subject}") has no link "${label}". Its links: ${listed(link.anchors.map((a) => a.text))}.`, hint: 'Name the link by the text of the button of the e-mail.' });
  }
  let href = link.href;
  if (tamperCase) {
    const url = new URL(href);
    if (!url.searchParams.get('signature')) {
      throw friendly({ message: `The "${label}" link of the e-mail to ${address} is not signed (${href}).`, hint: 'Only a signed link (one with a signature parameter) can be opened with a changed signature.' });
    }
    url.searchParams.set('signature', url.searchParams.get('signature').split('').reverse().join(''));
    href = url.toString();
  }
  await open(this, href);
});

/**
 * Assert that the browser shows, or does not show, the email verification
 * notice the app keeps an account on until its address is verified: the
 * notice at /email/verify and its "Resend verification email" button.
 *
 * Example #1: Then I should see the email verification notice
 * Example #2: Then I should not see the email verification notice
 * Example #3: And we should see the email verification notice
 * Example #4: Then we should not see the email verification notice
 * Example #5: But I should see the email verification notice
 */
Then(/^(I |we )*should( not)* see the email verification notice$/, async function (pronounCase, notCase) {
  const resend = this.page.getByRole('button', { name: 'Resend verification email' });
  await assertPresence(resend, notCase, {
    label: 'the email verification notice (its "Resend verification email" button)',
    hint: 'The app sends an account whose address is not verified to /email/verify from every page that needs a verified address.',
    timeout: budget(this),
    found: async () => `The page is ${currentPath(this)} ("${clean(await this.page.title())}").`,
  });
  if (!notCase && !/\/email\/verify$/.test(currentPath(this))) {
    throw friendly({ message: `A "Resend verification email" button is on the page, but the page is ${currentPath(this)}, not /email/verify.`, hint: 'The notice is the page the app keeps an unverified account on.' });
  }
});

/**
 * Assert that the app asks for the password before it opens a page: the
 * password confirmation page, with its password field and its "Confirm"
 * button. The app asks again once the confirmation of the session is older
 * than its timeout (three hours on a new app).
 *
 * Example #1: Then I should be asked to confirm my password
 * Example #2: Then I should not be asked to confirm my password
 * Example #3: And we should be asked to confirm our password
 * Example #4: Then we should not be asked to confirm our password
 * Example #5: But I should be asked to confirm my password
 */
Then(/^(I |we )*should( not)* be asked to confirm (?:my|our) password$/, async function (pronounCase, notCase) {
  const form = this.page.locator('form:has([data-test="confirm-password-button"]), form[action*="confirm-password"]');
  await assertPresence(form, notCase, {
    label: 'the password confirmation form',
    hint: 'The app asks for the password at /user/confirm-password before a page that needs a recent confirmation (the security settings of the starter kits).',
    timeout: budget(this),
    found: async () => `The page is ${currentPath(this)} ("${clean(await this.page.title())}").`,
  });
});

/**
 * Fill in and send the password confirmation form, and wait for the answer:
 * the page that asked for it, or the error under the field. The button is the
 * one the kits mark `data-test="confirm-password-button"` ("Confirm" on one
 * kit, "Confirm password" on the others).
 */
async function sendConfirmation(world, password) {
  const field = await findField(world, 'Password');
  await field.fill(password);
  const button = world.page.locator('[data-test="confirm-password-button"]');
  const submit = (await button.count()) ? button.first() : world.page.getByRole('button', { name: /^\s*Confirm( password)?\s*$/ });
  const from = world.page.url();
  await submit.click();
  const deadline = Date.now() + budget(world);
  while (Date.now() < deadline) {
    if (world.page.url() !== from || (await pageFieldErrors(world)).length) break;
    await world.page.waitForTimeout(150);
  }
  await settle(world);
}

/**
 * Confirm the password on the password confirmation page with the password
 * of an account of the users registry, as a person does, and wait for the
 * answer: the page that asked for it, or the error under the field.
 *
 * Example #1: When I confirm my password as "member"
 * Example #2: When we confirm our password as "member"
 * Example #3: And I confirm my password as "member"
 * Example #4: When I confirm my password as "unverified"
 * Example #5: And we confirm our password as "member"
 */
When(/^(I |we )*confirm (?:my|our) password as "([^"]*)"$/, async function (pronounCase, handle) {
  await sendConfirmation(this, resolveUser(this, handle).password);
});

/**
 * Send the password confirmation form with a password as it is written: a
 * wrong one, to see the form refuse it. Assert the outcome with the next step.
 *
 * Example #1: When I confirm my password with "wrong-password"
 * Example #2: When we confirm our password with "not-my-password"
 * Example #3: And I confirm my password with "wrong-password"
 * Example #4: When I confirm my password with "12345678"
 * Example #5: And we confirm our password with "wrong-password"
 */
When(/^(I |we )*confirm (?:my|our) password with "([^"]*)"$/, async function (pronounCase, password) {
  await sendConfirmation(this, password);
});
