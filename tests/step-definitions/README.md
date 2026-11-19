# Step definitions

| File | Covers |
| --- | --- |
| `laravel-session.steps.js` | The session: login by a handle of the users registry (a session taken over when the account already has one), login through the form, login with an address and a password, repeated attempts until the app refuses them, logout, who is signed in, the login form. |
| `laravel-account.steps.js` | The pages around an account: the password reset request, the mail the app sends (its subject, its text, or no mail), a link of a mail opened as a person does (or with a changed signature), the email verification notice, the password confirmation. |
| `laravel-forms.steps.js` | Forms as a person reads them: a field filled with the name, address or password of an account of the registry, a field that holds them, the error under a field (or none), a field the browser refuses as empty, the status line of an auth page, notifications, the button that shows a password. |
| `laravel-app.steps.js` | The frame of the app: the user menu (open an item, what it offers, the account it names), the navigation (its items, the current page), the appearance (choose one, the chosen one, the one the page is drawn in). |
| `laravel-errors.steps.js` | The framework's own pages: the error page of a status, the debug information a live app must not show, a form sent from another site, the maintenance bypass. |
| `laravel-helpers.js` | Shared plumbing: the wait budget, the requests of the page, friendly errors, the users registry and the session cache, fields and their errors, status lines, notifications, the user menu, the navigation, the mailbox of the test app, the status of the page. It registers no step. |

## Rules for a new step

- Check `node_modules/webship-js/tests/step-definitions/` first: a step that the
  generic click, fill and see vocabulary already covers is not added here.
- No step phrase names the framework or a library. A name appears only as an
  argument a step asserts.
- The regular expression starts with the pronoun group `(I |we )*` where a
  person acts, and an assertion takes `should( not)*`, so one definition reads
  both polarities.
- A JSDoc block above the step holds at least five `Example #N:` lines. Run
  `npm run test:examples`: every example must match its own step and no step of
  webship-js.
- Find things the way a person does: a label, a role, a text. The hooks the
  three official starter kits share (`data-test="…"`, `role`, `aria-*`,
  `data-current`, `data-active`) are the fallback. When the kits draw a thing
  differently, the step finds it in each of them; the phrase stays one.
- Wait on the page, never on a fixed time: on the locator, on the requests of
  the page (`settle`, `afterRequests`), on the address it moves to, on the
  error under a field.
- Fail with `friendly({ message, hint })`: what was expected, what was found
  and where to look.
- A step never creates or deletes a user: accounts are configuration, named in
  the `users` registry of `cucumber.js` and created by the build of the app.
- Open the page in a real browser before writing or changing its step, and
  write the step from what is there: the roles and names of the accessibility
  tree, the stable attributes, what the page does while it loads or saves.
- Give every assertion a scenario in `tests/must-fail/` that makes it fail.
