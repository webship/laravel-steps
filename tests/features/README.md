# Features

Reference features for the test app that `.github/scripts/build-ddev-site.sh`
builds: a new app made with the official installer and a starter kit, the one
route the script adds (`/test-fixtures/server-error`), and the two accounts of
`cucumber.js` (`member`, verified; `unverified`). Copy a feature into your
project and replace the addresses, names and texts with those of your app.

| Feature | Covers |
| --- | --- |
| `session` | Logging in with the form, a refused password, a page that needs a session, the session through a reload, logging out, "Remember me", the password field that shows its value, the limit on login attempts (429). |
| `registration` | Registration refused: an address that is taken, a confirmation that differs, a password the rules refuse, an empty name. No sign-up is completed. |
| `password-reset` | The request, the mail, the link, the new password, the login; a link used twice; an address with no account; a second request within a minute. |
| `email-verification` | The notice an unverified account is kept on, a new link by mail, a tampered link (403), the profile of an unverified account. |
| `password-confirmation` | The password asked for in front of the security settings, a wrong one refused, the right one. |
| `settings` | The profile (its details, a new name and the old one back, an address that is taken), the account deletion dialog refused, the password form (refusals and a save), the appearance. |
| `navigation` | The home page of a visitor and of a member, the sidebar, the user menu, the settings navigation and the current page. |
| `error-pages` | The 404, 419, 405 and 500 pages, with no debug information. |
| `health` | The health route. |
| `accessibility` | An accessibility audit of the auth pages, the dashboard and the profile. |
| `maintenance` | `@maintenance`, a lane of its own with the app down: the maintenance page, the health route, the bypass. |
| `debug-page` | `@debug-page`, a lane of its own with `APP_DEBUG=true`: the debug page check on a real debug page. |

Scenarios that change something change it back: the name of the account, the
appearance, the password (a password form is given the password the account
has). Every password reset link a scenario asks for is used. No scenario
creates or deletes a user, completes a registration, or opens a real
verification link.
