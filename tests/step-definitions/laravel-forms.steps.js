'use strict';

// Forms as a person reads them: a field filled with a value of an account of
// the users registry (so no feature writes a password), the error the app
// shows under a field, a field the browser refuses as empty, the status line
// of an auth page, the notification a save shows for a few seconds, and the
// button that shows or hides what a password field holds.
//
// The text, the clicks and the plain filling of fields are webship-js's own
// steps (I fill in, I press, I should see): this file adds only what the app
// decides.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  listed,
  eventually,
  resolveUser,
  findField,
  fieldErrors,
  pageFieldErrors,
  fillLikeABuiltIn,
  statusLines,
  recordNotifications,
  forgetNotifications,
  shownNotifications,
} = require('./laravel-helpers');

const PARTS = { name: 'name', email: 'email', 'email address': 'email', password: 'password' };

/** A text that ends a sentence: with its own full stop, or with one added. */
function endSentence(text) {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

/** A part of an account of the registry: its name, its address or its password. */
function accountPart(world, part, handle) {
  const user = resolveUser(world, handle);
  const key = PARTS[String(part).toLowerCase()];
  const value = user[key];
  if (!value) {
    throw friendly({
      message: `The user "${handle}" has no ${part} in the users registry.`,
      hint: `Set worldParameters.users.${handle}.${key} in cucumber.js.`,
    });
  }
  return value;
}

/**
 * Fill in a field with the name, the address or the password of an account of
 * the users registry, so a feature never writes a password and runs against an
 * app whose accounts have other names. The field is found as webship-js's
 * "I fill in" finds it: by its label, placeholder or name, exactly as written.
 *
 * Example #1: When I fill in "Password" with the password of "member"
 * Example #2: When we fill in "Current password" with the password of "member"
 * Example #3: And I fill in "Name" with the name of "member"
 * Example #4: When I fill in "Email address" with the email of "member"
 * Example #5: And we fill in "Confirm password" with the password of "member"
 */
When(/^(I |we )*fill in "([^"]*)" with the (name|email|email address|password) of "([^"]*)"$/, async function (pronounCase, field, part, handle) {
  await recordNotifications(this);
  await forgetNotifications(this);
  await fillLikeABuiltIn(this, field, accountPart(this, part, handle));
});

/**
 * Assert that a field holds the name or the address of an account of the
 * users registry: the profile form shows the account's own details.
 *
 * Example #1: Then the "Name" field should hold the name of "member"
 * Example #2: Then the "email" field should hold the email of "member"
 * Example #3: And the "Name" field should hold the name of "unverified"
 * Example #4: Then the "Email address" field should hold the email of "member"
 * Example #5: And the "email" field should hold the email of "unverified"
 */
Then(/^the "([^"]*)" field should hold the (name|email|email address) of "([^"]*)"$/, async function (field, part, handle) {
  const wanted = accountPart(this, part, handle);
  const control = await findField(this, field);
  await eventually(this, () => control.inputValue().catch(() => ''), (value) => value === wanted, (value) => ({
    message: `Expected the "${field}" field to hold the ${part} of "${handle}" ("${wanted}"), but it holds "${value}".`,
    hint: 'The form shows what the app stored for the signed-in account; a scenario that changed it must change it back.',
  }));
});

/**
 * Assert the error the app shows under a field, or that it shows none. The
 * field is found by its label (or name); the error is the message the app
 * prints in the field's own group or names with aria-describedby. The step
 * waits for the message, so it holds right after the press that sent the form.
 *
 * Example #1: Then the "Email address" field should have the error "These credentials do not match our records."
 * Example #2: Then the "Password" field should have the error "The password field confirmation does not match."
 * Example #3: And the "Current password" field should have the error "The password is incorrect."
 * Example #4: Then the "Email address" field should not have the error "The email has already been taken."
 * Example #5: Then the "email" field should have the error "The email has already been taken."
 */
Then(/^the "([^"]*)" field should( not)* have the error "([^"]*)"$/, async function (field, notCase, message) {
  const control = await findField(this, field);
  if (notCase) {
    const errors = await fieldErrors(control);
    if (errors.some((error) => error.includes(message))) {
      throw friendly({ message: `Expected the "${field}" field not to have the error "${message}", but it shows it.`, hint: 'The app shows the error of a refused form under each field it refused.' });
    }
    return;
  }
  try {
    await eventually(this, () => fieldErrors(control), (errors) => errors.some((error) => error.includes(message)), () => ({ message: 'no match' }));
  } catch {
    const errors = await fieldErrors(control);
    const others = (await pageFieldErrors(this)).filter((error) => !errors.includes(error));
    throw friendly({
      message: `Expected the error "${message}" under the "${field}" field. ${errors.length ? `It shows: ${listed(errors)}.` : 'It shows no error.'}`,
      hint: `The error appears under the field once the app refused the form.${others.length ? ` Errors under other fields: ${listed(others)}.` : ''}`,
    });
  }
});

/**
 * Assert that a field shows no error at all.
 *
 * Example #1: Then the "Name" field should have no error
 * Example #2: And the "Email address" field should have no error
 * Example #3: Then the "Password" field should have no error
 * Example #4: And the "Current password" field should have no error
 * Example #5: Then the "email" field should have no error
 */
Then(/^the "([^"]*)" field should have no error$/, async function (field) {
  const control = await findField(this, field);
  const errors = await fieldErrors(control);
  if (errors.length) {
    throw friendly({ message: `Expected no error under the "${field}" field, but it shows: ${listed(errors)}.`, hint: 'The app shows the error of a refused form under each field it refused.' });
  }
});

/**
 * Assert that the browser refused to send a form because a required field is
 * empty, naming the field: the form stays on screen and no request is made.
 * The field is the one a person reads by that label (the label element, or
 * the text `aria-labelledby` points at), or its name.
 *
 * Example #1: Then the "Name" field should block submission as required
 * Example #2: And the "Email address" field should block submission as required
 * Example #3: Then the "Password" field should block submission as required
 * Example #4: And the "Confirm password" field should block submission as required
 * Example #5: Then the "email" field should block submission as required
 */
Then(/^the "([^"]*)" field should block submission as required$/, async function (label) {
  const invalid = await this.page.evaluate(() => {
    const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const labelOf = (el) => {
      const by = (el.getAttribute('aria-labelledby') || '').split(/\s+/).map((id) => document.getElementById(id)).filter(Boolean);
      if (by.length) return norm(by.map((n) => n.textContent).join(' '));
      if (el.labels && el.labels[0]) return norm(el.labels[0].textContent);
      return norm(el.getAttribute('aria-label') || el.name || '');
    };
    const found = [];
    for (const form of document.forms) {
      if (form.noValidate) continue;
      for (const el of form.elements) {
        if (!el.willValidate || el.checkValidity()) continue;
        found.push({ label: labelOf(el), name: el.name || '', missing: el.validity.valueMissing, message: el.validationMessage });
      }
    }
    return found;
  });
  if (!invalid.length) {
    throw friendly({
      message: 'Expected the form to be blocked by an empty required field, but every field of the forms on the page passes the browser\'s checks.',
      hint: 'A form with the "novalidate" attribute is checked by the server instead: assert its error with the "... field should have the error ..." step.',
    });
  }
  const wanted = label.trim().toLowerCase();
  const hit = invalid.find((field) => field.label.toLowerCase() === wanted || field.name.toLowerCase() === wanted)
    || invalid.find((field) => field.label.toLowerCase().startsWith(wanted));
  if (!hit || !hit.missing) {
    throw friendly({
      message: `Expected the "${label}" field to block the form as empty. The fields the browser refuses: ${invalid.map((field) => `"${field.label || field.name}" (${field.message})`).join(', ')}.`,
      hint: 'Leave the field empty and press the button that sends the form; the browser checks the required fields before it sends anything.',
    });
  }
});

/**
 * Assert the status line of the page: the short confirmation an auth page
 * shows above its form after the app did what was asked ("We have emailed
 * your password reset link.", "Your password has been reset."). A text that
 * the page shows as the error of a field fails the step, so a refusal is never
 * taken for a confirmation.
 *
 * Example #1: Then I should see the status message "We have emailed your password reset link."
 * Example #2: Then we should see the status message "Your password has been reset."
 * Example #3: And I should see the status message "A new verification link has been sent to the email address you provided during registration."
 * Example #4: Then I should not see the status message "We have emailed your password reset link."
 * Example #5: Then we should not see the status message "Your password has been reset."
 */
Then(/^(I |we )*should( not)* see the status message "([^"]*)"$/, async function (pronounCase, notCase, message) {
  if (notCase) {
    const lines = await statusLines(this);
    if (lines.some((line) => line.includes(message))) {
      throw friendly({ message: `Expected no status message "${message}", but the page shows it.`, hint: 'The status line is the green confirmation above or below the form of an auth page.' });
    }
    return;
  }
  try {
    await eventually(this, () => statusLines(this), (lines) => lines.some((line) => line.includes(message)), (lines) => ({ message: `Expected the status message "${message}". ${lines.length ? `The page shows: ${listed(lines)}.` : 'The page shows no status message.'}` }));
  } catch (err) {
    const errors = await pageFieldErrors(this);
    const asError = errors.find((error) => error.includes(message));
    throw friendly({
      message: asError ? `Expected the status message "${message}", but the page shows it as the error of a field.` : err.message,
      hint: `Errors on the page: ${listed(errors)}. The status line is the green confirmation an auth page shows once the app did what was asked (${this.page.url()}).`,
    });
  }
});

/**
 * Assert a notification: the message a save shows at the corner of the page
 * for a few seconds ("Profile updated.", "Password updated."). Notifications
 * shown since the last action are remembered, so the step reads one even a
 * moment after it faded. The type is success, error, warning or info.
 *
 * Example #1: Then I should see the notification "Profile updated."
 * Example #2: Then I should see the success notification "Password updated."
 * Example #3: And we should see the notification "Password updated."
 * Example #4: Then I should see the error notification "Something went wrong."
 * Example #5: And I should see the success notification "Profile updated."
 */
Then(/^(I |we )*should see the (?:(success|error|warning|info) )?notification "([^"]*)"$/, async function (pronounCase, type, text) {
  await recordNotifications(this);
  const wanted = type ? type.toLowerCase() : null;
  await eventually(this, () => shownNotifications(this), (list) => list.some((item) => (!wanted || item.type === wanted) && item.text.includes(text)), (list) => ({
    message: `Expected the ${wanted ? wanted + ' ' : ''}notification "${text}". The page showed: ${list.length ? endSentence(list.map((item) => `[${item.type || 'plain'}] ${item.text}`).join('; ')) : 'no notification.'}`,
    hint: 'Notifications are the messages at the corner of the page after a save. Assert one right after the action that raises it; a refused form shows errors under its fields instead.',
  }));
});

/**
 * Assert that no notification was shown since the last action, or none of a
 * type.
 *
 * Example #1: Then I should not see a notification
 * Example #2: Then I should not see an error notification
 * Example #3: And we should not see a notification
 * Example #4: Then we should not see an error notification
 * Example #5: And I should not see a success notification
 */
Then(/^(I |we )*should not see an? (?:(success|error|warning|info) )?notification$/, async function (pronounCase, type) {
  await recordNotifications(this);
  await this.page.waitForTimeout(300);
  const wanted = type ? type.toLowerCase() : null;
  const list = (await shownNotifications(this)).filter((item) => !wanted || item.type === wanted);
  if (list.length) {
    throw friendly({ message: `Expected no ${wanted ? wanted + ' ' : ''}notification, but the page showed: ${endSentence(list.map((item) => `[${item.type || 'plain'}] ${item.text}`).join('; '))}`, hint: 'Notifications shown since the last action of a step of this pack are counted.' });
  }
});

/** The button that shows or hides what a password field holds. */
async function visibilityToggle(world, control, field) {
  const handle = await control.evaluateHandle((el) => {
    for (let node = el.parentElement, i = 0; node && i < 4; node = node.parentElement, i += 1) {
      const buttons = [...node.querySelectorAll('button')].filter((b) => /password|show|hide|visib|reveal/i.test(`${b.getAttribute('aria-label') || ''} ${b.textContent || ''} ${b.getAttribute('title') || ''}`));
      if (buttons.length) return buttons[0];
    }
    return null;
  });
  const button = handle.asElement();
  if (!button) {
    throw friendly({ message: `The "${field}" field has no button that shows its value.`, hint: 'The password fields of the kits have one next to them ("Show password", "Toggle password visibility").' });
  }
  return button;
}

/**
 * Show or hide what a password field holds, with the button next to it, as a
 * person does.
 *
 * Example #1: When I show the value of the "Password" field
 * Example #2: When I hide the value of the "Password" field
 * Example #3: And we show the value of the "Current password" field
 * Example #4: When I show the value of the "Confirm password" field
 * Example #5: And I hide the value of the "Current password" field
 */
When(/^(I |we )*(show|hide) the value of the "([^"]*)" field$/, async function (pronounCase, action, field) {
  const control = await findField(this, field);
  const shown = async () => (await control.getAttribute('type')) !== 'password';
  if ((action === 'show') === (await shown())) return;
  await (await visibilityToggle(this, control, field)).click();
  await eventually(this, shown, (value) => value === (action === 'show'), () => ({
    message: `The button next to the "${field}" field did not ${action} its value.`,
    hint: 'The field turns into a plain text field while its value shows.',
  }));
});

/**
 * Assert that a password field shows what it holds, or hides it.
 *
 * Example #1: Then the "Password" field should show its value
 * Example #2: Then the "Password" field should hide its value
 * Example #3: And the "Current password" field should hide its value
 * Example #4: Then the "Confirm password" field should show its value
 * Example #5: And the "Password" field should hide its value
 */
Then(/^the "([^"]*)" field should (show|hide) its value$/, async function (field, state) {
  const control = await findField(this, field);
  const type = await control.getAttribute('type');
  if ((state === 'show') !== (type !== 'password')) {
    throw friendly({ message: `Expected the "${field}" field to ${state} its value, but it is a field of type "${type}".`, hint: 'A password field shows its value as a plain text field after its button was pressed.' });
  }
});

