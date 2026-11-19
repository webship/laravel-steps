<p align="center"><img src="https://raw.githubusercontent.com/webship/laravel-steps/2.0.x/assets/logo.svg" alt="Laravel logo" width="96"></p>

# laravel-steps

Cucumber step definitions for testing Laravel apps with
[webship-js](https://webship.co/docs/webship-js/2.0.x), a BDD browser automation
harness built on Playwright and Cucumber-js.

A framework ships no fixed pages, so `@webship-js/laravel-steps` targets the
pages most real apps start from: the ones the official starter kits give every
new app, and the ones the framework itself answers with. That is the session
(logging in and out, the limit on login attempts, "Remember me"), registration
(through its refusals), the password reset through the mail, email
verification, the password confirmation in front of a sensitive page, the
dashboard and its navigation, the user menu, the settings (profile, password,
appearance, the account deletion dialog), notifications, the errors under a
field and the status lines of the auth pages, the error pages (403, 404, 419,
429, 500, 503), maintenance mode and its bypass, the health route, and the
check that a live app shows no debug page. The steps are written against an app
made with the official installer and the Livewire starter kit, on Laravel 13.

No step phrase names the framework or a library: a scenario reads `Given I am a
logged in user with the "member" user` and `Then I should see the 404 error
page`.

CI builds a real app with [DDEV](https://ddev.com) on the runner, the way the
official installer makes it, and runs the whole suite against it, twice, on
every push and pull request; see
[`.github/workflows/test.yml`](.github/workflows/test.yml).

## From nothing to a green run

What the machine needs: Docker, [DDEV](https://ddev.com), git, python3, and Node.js 20 or later with npm. PHP, Composer, the database and the app's own Node.js run in DDEV's containers.

**1. The app.** The pack's own build script (the one CI runs) makes a new app in a DDEV project the way the DDEV quickstart does with the official installer: `laravel new` with the Livewire starter kit, its database migrated, its assets built. It then adds one page (an error nothing catches, for the 500 page), creates the accounts of [Test users](#test-users), and runs the app as a live app runs (`APP_ENV=production`, `APP_DEBUG=false`). It takes two to five minutes.

```bash
git clone https://github.com/webship/laravel-steps.git
SITE_DIR="$PWD/laravel-app" laravel-steps/.github/scripts/build-ddev-site.sh
```

The app answers at `https://laravelsteps.ddev.site` and its mailbox at `https://laravelsteps.ddev.site:8026`.

**2. A test project.**

```bash
mkdir laravel-tests && cd laravel-tests
npm init -y
npm install --save-dev webship-js @webship-js/laravel-steps
npx init-webship-js
```

`npx init-webship-js` writes `cucumber.js`, `playwright.config.ts`, the `tests/` folders with a first feature and the `npm test` scripts, and installs Chromium. npm usually runs it already when it installs webship-js; a second run changes nothing.

**3. `cucumber.js`.** Replace the file with the wiring of the pack: the step files of webship-js and of the pack, the tags that keep the lanes out of a normal run, the address of the app and of its mailbox, and the accounts (the JSON of [Test users](#test-users)).

```javascript
module.exports = {
  default: {
    requireModule: ['tsx/cjs'],
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js',
      'node_modules/@webship-js/laravel-steps/tests/step-definitions/*.js',
      'tests/step-definitions/**/*.js',
    ],
    paths: ['tests/features/**/*.feature'],
    // Work in progress, the assertions that must fail, and the two lanes that need the app in another
    // state (@maintenance: the app is down; @debug-page: APP_DEBUG=true) stay out of a normal run.
    tags: 'not @wip and not @must-fail and not @maintenance and not @debug-page',
    format: ['@cucumber/pretty-formatter', 'json:tests/reports/cucumber_report.json'],
    worldParameters: {
      launchUrl: process.env.LAUNCH_URL || 'https://laravelsteps.ddev.site',
      mailUrl: (process.env.LAUNCH_URL || 'https://laravelsteps.ddev.site') + ':8026',
      maintenanceSecret: 'webship-maintenance-bypass',
      reuseSessions: true,
      // The browser logs every error page as "Failed to load resource: the server responded with a
      // status of 404" (403, 419, 429, 500, 503): not a fault of the app. The scenarios that open an
      // error page carry @js-off, so the warning mode below stays on for every other page.
      javascript: { mode: 'warn', levels: ['error'] },
      // The waits webship-js adds around each page, scenario and step (milliseconds).
      minWaitTime: { page: 3000, before_scenario: 0, after_scenario: 0, before_step: 0, after_step: 0 },
      users: {
        member: { email: 'member@example.com', password: 'Member-Pass-2026!', name: 'Mia Member' },
        unverified: { email: 'unverified@example.com', password: 'Member-Pass-2026!', name: 'Uma Unverified' },
      },
    },
  },
};
```

**4. A first feature**, `tests/features/first-run.feature`:

```gherkin
Feature: First run
  Scenario: A member logs in and lands on the dashboard
    Given I am a logged in user with the "member" user
    Then I should be on "/dashboard"
    And the navigation should show "Dashboard" as the current page

  @js-off
  Scenario: An address the app does not have answers with the 404 page
    Given I am an anonymous user
    When I go to "/no-such-page-of-the-app"
    Then I should see the 404 error page
    And the page should not show debug information
```

**5. Run it.** Set `LAUNCH_URL` to the address of the app (the build script's app answers at the default; `LAUNCH_URL=https://laravelsteps.ddev.site npm test` says it out loud), then:

```bash
LAUNCH_URL=https://laravelsteps.ddev.site npm test
```

A green first run prints every step, then the summary (the starter feature of `npx init-webship-js` and the two scenarios above, passed) and the HTML report it wrote:

```
3 scenarios (3 passed)
9 steps (9 passed)
0m05.104s (executing steps: 0m05.073s)
[webship-js] HTML report → …/laravel-tests/tests/reports/cucumber_report.html
```

From there, copy the features of [`tests/features/`](tests/features/) (they also ship in the package, under `node_modules/@webship-js/laravel-steps/tests/features/`): together they use every step of the pack. They read no file of their own.

### What the suite tests

The features of this repository run every step of the pack against the test app, twice in a row in CI on every change, then the assertions that must fail, then two lanes with the app in another state: logging in with the form, a refused password, a page that needs a session, the session through a reload, logging out, "Remember me", the password field that shows its value on request, the limit on login attempts (the 429 page); registration refused for an address that is taken, a confirmation that differs, a password the rules refuse, an empty name; the password reset from the request to the mail, the link, the new password and the login, a link used twice, an address with no account, a second request within a minute; the verification notice an unverified account is kept on, a new verification link by mail, a tampered link (the 403 page), the profile of an unverified account; the password confirmation in front of the security settings; the profile (its details, a new name and the old one back, an address that is taken), the account deletion dialog refused with a wrong password, the password form (refusals, and a save), the appearance (dark, kept after a reload, back to the system's); the sidebar, the user menu and the settings navigation, and which item is the page on screen; the 404, 419 (a form sent from another site), 405 and 500 pages with no debug information; the health route; an accessibility audit of the auth pages, the dashboard and the profile; the maintenance page, the health route during maintenance and the bypass (`@maintenance`); and the debug page check on a real debug page (`@debug-page`).

Not tested: completing a registration (the suite never creates an account), verifying an address for good (the suite never opens the real verification link), deleting an account, two-factor authentication and passkeys (an account left half way through either would break every later login), and the pages an app adds of its own.

## Requirements

- Node.js 20 or later
- A webship-js 2.0 test project (webship-js 2.0.16 or later)
- An app made from an official starter kit (Livewire, React or Vue), and accounts on it for the suite

## Install

```bash
npm install --save-dev @webship-js/laravel-steps
```

## Quick start

1. Add the step files to the `require` list of your webship-js `cucumber.js`:

   ```javascript
   require: [
     'node_modules/webship-js/tests/step-definitions/**/*.js',
     'node_modules/@webship-js/laravel-steps/tests/step-definitions/*.js',
     'tests/step-definitions/**/*.js',
   ],
   ```

2. Point `launchUrl` at the app and name the accounts the suite logs in with
   (see [Accounts](#accounts)):

   ```javascript
   worldParameters: {
     launchUrl: process.env.LAUNCH_URL || 'https://your-app.ddev.site',
     homePath: '/dashboard',   // the page signed-in accounts land on
     loginPath: '/login',      // the login page
     mailUrl: 'https://your-app.ddev.site:8026', // the mailbox of the app (Mailpit), for the mail steps
     maintenanceSecret: process.env.MAINTENANCE_SECRET, // the secret of "php artisan down --secret=...", for the maintenance lane
     users: {
       member: { email: 'member@example.com', password: process.env.MEMBER_PASSWORD, name: 'Mia Member' },
     },
   },
   ```

3. Copy a feature file from [`tests/features/`](tests/features/) into your
   project and replace the addresses, names and texts with those of your app.

```gherkin
Feature: Password reset

  Scenario: A member resets the password with the link the app mails
    Given I am an anonymous user
    When I ask for a password reset link for "member"
    Then I should see the status message "We have emailed your password reset link."
    And an email with the subject "Reset your password" should be sent to "member"
    When I open the "Reset Password" link of the email to "member"
    And I fill in "Password" with the password of "member"
    And I fill in "Confirm password" with the password of "member"
    And I press "Reset password"
    Then I should see the status message "Your password has been reset."
```

## What is included

| File | Steps | Covers |
| --- | --- | --- |
| `laravel-session.steps.js` | 8 | Login by a handle of the users registry (a session taken over when the account already has one), login through the form, login with an address and a password, repeated attempts until the limit, logout, who is signed in, the login form. |
| `laravel-account.steps.js` | 8 | The password reset request, the mail the app sends (subject, text, no mail), a link of a mail opened as a person does (or with a changed signature), the email verification notice, the password confirmation. |
| `laravel-forms.steps.js` | 10 | A field filled with the name, address or password of an account of the registry, a field that holds them, the error under a field (or none), a field the browser refuses as empty, the status line of an auth page, notifications, the button that shows a password. |
| `laravel-app.steps.js` | 8 | The user menu (open an item, what it offers, the account it names), the navigation (its items, the current page), the appearance (choose one, the chosen one, the one the page is drawn in). |
| `laravel-errors.steps.js` | 4 | The error page of a status, the debug information a live app must not show, a form sent from another site, the maintenance bypass. |
| `laravel-helpers.js` | | Shared plumbing for the files above and for your own steps: the wait budget, the requests of the page, friendly errors, the users registry and the session cache, fields and their errors, status lines, notifications, the user menu, the navigation, the mailbox, the status of the page. It registers no step. |

Text, links, the plain filling of fields, buttons, dialogs, cookies, the status
code of a page and the accessibility audit are webship-js's own steps (`I
should see "..."`, `I fill in "..." with "..."`, `I press "..."`, `I click
"..." in the modal`, `a cookie with a name containing "..." should exist`, `the
response status code should be 405`, `the page should have no critical
accessibility violations`): this pack adds only what the app decides.

## How the steps find things and wait

- **By what a person reads.** A field is found by its label (the label element,
  or the text `aria-labelledby` points at), else its name; an error by the
  field it belongs to; a menu item by its text; a navigation item by its text.
  The hooks the three official starter kits share are the fallback:
  `data-test="login-button"`, `data-test="sidebar-menu-button"`,
  `data-test="logout-button"`, `data-test="confirm-password-button"` and the
  like, `role`, `aria-current`, `data-current`, `data-active`, `aria-checked`.
- **Three kits, one phrase.** The kits draw the same pages with different
  markup: the appearance options are a radio group in one kit and a row of
  buttons in the others, the current page of a navigation is marked in one and
  only coloured in another, notifications are toasts of two kinds. A step looks
  for what a person sees and reads the mark each kit leaves.
- **No fixed sleeps.** The steps wait on the page's own signals: the requests
  it makes (the single-page kits use XHR, the component kit fetch), the address
  it moves to, the error that appears under a field, the status line.
- **Notifications fade.** A notification stays a few seconds. The steps record
  the ones shown since the last action, so `I should see the notification
  "Profile updated."` reads one even a moment after it faded.
- **Failures say what was found.** `Expected the error "Unknown account." under
  the "Email address" field. It shows: "These credentials do not match our
  records."` with a hint on where to look.

## Accounts

The suite never creates or deletes a user. Accounts are configuration: list
the ones the app has in `worldParameters.users`, by a handle the scenarios
use, each with its `email`, `password` and (for the steps that check or put
back a name) `name`.

```javascript
users: {
  member: { email: 'member@example.com', password: process.env.MEMBER_PASSWORD, name: 'Mia Member' },
  unverified: { email: 'unverified@example.com', password: process.env.UNVERIFIED_PASSWORD, name: 'Uma Unverified' },
},
```

An account that logged in once keeps its session for the rest of the run: a
later scenario that logs in as the same handle takes the session over instead
of filling in the login form again. That is quicker, and it matters: the app
allows five login attempts a minute for one address, and counts every attempt,
also the ones that succeed. A step that meets the limit anyway waits the time
the app's `Retry-After` header gives, once. `reuseSessions: false` in
`worldParameters` turns the reuse off.

## Test users

The accounts this repository's suite logs in as, exactly as `cucumber.js`
lists them in `worldParameters.users` (the default values; the `*_EMAIL`,
`*_PASSWORD` and `*_NAME` variables replace them).
[`.github/scripts/build-ddev-site.sh`](.github/scripts/build-ddev-site.sh)
creates them on the local test app, and CI does the same on the runner. They are
placeholder credentials of that throwaway app, not of any real one.

```json
{
  "member": { "email": "member@example.com", "password": "Member-Pass-2026!", "name": "Mia Member" },
  "unverified": { "email": "unverified@example.com", "password": "Member-Pass-2026!", "name": "Uma Unverified" }
}
```

`member` has a verified address; `unverified` has not, so the app keeps it on
the verification notice.

## A test app

[`.github/scripts/build-ddev-site.sh`](.github/scripts/build-ddev-site.sh)
builds the app the suite of this repository runs against, the documented way:
a DDEV project of type `laravel` with Node.js 24, the official installer in the
web container (`laravel new --livewire`, or `STARTER_KIT=react` or `vue`), the
database DDEV gives the project (MariaDB), the assets built with npm. Then:

- one route, `/test-fixtures/server-error`, an error nothing catches, for the
  500 page (a new app has no page that fails, and the suite must see one);
- the accounts of [Test users](#test-users), written through the app itself
  ([`site/accounts.php`](site/accounts.php));
- `APP_ENV=production` and `APP_DEBUG=false`, as a live app runs: an error
  renders the error page, never the debug page, and the password rules are the
  ones a live app applies (at least 12 characters, both cases, a number, a
  symbol, not in a known breach).

```bash
SITE_DIR="$PWD/../laravel-app" .github/scripts/build-ddev-site.sh
npm test
```

Nothing is installed that the starter kit does not bring: no paid package, no
trial, no sign-in to any service.

## Steps

One example of each step; the JSDoc block above each definition holds five.

### `laravel-session.steps.js` (8)

- `Given I am a logged in user with the "member" user`
- `When I log in as "member" with the login form`
- `When I log in with the email "member@example.com" and the password "wrong-password"`
- `When I try to log in 6 times with the email "guess@example.com" and a wrong password`
- `When I log out`
- `Then I should be logged in`
- `Then I should be logged in as "member"`
- `Then I should see the login form`

### `laravel-account.steps.js` (8)

- `When I ask for a password reset link for "member"`
- `Then an email with the subject "Reset your password" should be sent to "member"`
- `Then no email should be sent to "nobody@example.com"`
- `Then the email with the subject "Reset your password" to "member" should contain "This password reset link will expire in 60 minutes."`
- `When I open the "Reset Password" link of the email to "member"`
- `Then I should see the email verification notice`
- `Then I should be asked to confirm my password`
- `When I confirm my password as "member"`

### `laravel-forms.steps.js` (10)

- `When I fill in "Password" with the password of "member"`
- `Then the "Name" field should hold the name of "member"`
- `Then the "Email address" field should have the error "These credentials do not match our records."`
- `Then the "Name" field should have no error`
- `Then the "Name" field should block submission as required`
- `Then I should see the status message "We have emailed your password reset link."`
- `Then I should see the notification "Profile updated."`
- `Then I should not see a notification`
- `When I show the value of the "Password" field`
- `Then the "Password" field should show its value`

### `laravel-app.steps.js` (8)

- `When I open "Settings" from the user menu`
- `Then the user menu should offer "Settings"`
- `Then the user menu should name "member"`
- `Then the navigation should have the item "Dashboard"`
- `Then the navigation should show "Dashboard" as the current page`
- `When I choose the "Dark" appearance`
- `Then the chosen appearance should be "Dark"`
- `Then the page should be shown in the dark appearance`

### `laravel-errors.steps.js` (4)

- `Then I should see the 404 error page`
- `Then the page should not show debug information`
- `When a page of another site sends a form to "/login"`
- `When I use the maintenance bypass`

## Testing this package

```bash
npm install
SITE_DIR="$PWD/../laravel-app" .github/scripts/build-ddev-site.sh
npm run test:examples      # the examples and the features against the step patterns
npm run test:paths         # a feature or a scenario named on the command line runs alone
npx cucumber-js --dry-run  # no undefined and no ambiguous step
npm test                   # the suite, against the app
npm run test:must-fail     # assertions that must fail, each with its message
```

The two lanes need the app in another state, and put it back:

```bash
(cd ../laravel-app && ddev artisan down --secret="webship-maintenance-bypass")
npm run test:maintenance   # the maintenance page, the health route, the bypass
(cd ../laravel-app && ddev artisan up)

(cd ../laravel-app && ddev dotenv set .env --app-debug=true)
CUCUMBER_TAGS=@debug-page npx cucumber-js   # the debug page check sees a real debug page
(cd ../laravel-app && ddev dotenv set .env --app-debug=false)
```

`LAUNCH_URL` points the suite at another app; `npx cucumber-js
tests/features/session.feature` runs one feature and `npx cucumber-js
tests/features/session.feature:<line>` one scenario (the line of its
`Scenario:`; the paths of `cucumber.js` are left out when the command line
names any); `FEATURES` runs a subset too
(`FEATURES=tests/features/session.feature npm test`); `CUCUMBER_TAGS=@critical`
runs the smoke lane; `HEADLESS=false` shows the browser.

`tests/must-fail/` holds scenarios that assert something that is not true on
the test app. `npm run test:must-fail` runs them and checks that each one
fails at its last step, with the message it announces and a hint: a step that
cannot fail proves nothing.

The suite leaves the app as it found it: a scenario that changes the name of
the account puts it back, the password forms are given the password the
account has, the appearance returns to the system's, and every password reset
link a scenario asks for is used. A run stopped half way can leave a changed
name; the build script gives the accounts back their name, password and state
without building anything:

```bash
ACCOUNTS_ONLY=1 SITE_DIR="$PWD/../laravel-app" .github/scripts/build-ddev-site.sh
```

## How the steps were written

Every page a step touches was opened in a real browser first, and the step was
written from what is there: the roles and names of the accessibility tree, the
stable attributes, what the page does while it loads or saves, the exact
messages. The steps are proven on Laravel 13 with the Livewire starter kit, in
US English, with Chromium.

Not covered: completing a registration, verifying an address, deleting an
account, two-factor authentication, passkeys, the teams variants and the
variants that sign in through a hosted identity service, and an app's own
pages.

## License

MIT

## Logo

The Laravel logo in this README comes from Simple Icons 16.37.0 (CC0-1.0), filled with the colour the set lists for the brand. The Laravel name and logo are trademarks of their owner; this pack is not affiliated with or endorsed by them.
