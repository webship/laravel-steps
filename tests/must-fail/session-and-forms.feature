@must-fail
Feature: Assertions that must fail: the session and the forms
  Each scenario asserts something that is not true on the test app. Its steps before the last one
  pass; the last one must fail, with the message its description announces and a hint.
  tests/check-must-fail.js runs them. They only read: the app is left as it was.

  Scenario: The wrong account is named as the one logged in
    Fails with: Expected "unverified" (unverified@example.com) to be logged in, but the app names member@example.com.
    Given I am a logged in user with the "member" user
    Then I should be logged in as "unverified"

  Scenario: A signed-in member is said to be logged out
    Fails with: Expected nobody to be logged in
    Given I am a logged in user with the "member" user
    Then I should not be logged in

  Scenario: The dashboard is taken for the login form
    Fails with: Expected to see the login form, but it did not appear
    Given I am a logged in user with the "member" user
    When I go to "/dashboard"
    Then I should see the login form

  Scenario: A field error that is not the one shown
    Fails with: Expected the error "Unknown account." under the "Email address" field. It shows: "These credentials do not match our records."
    Given I am an anonymous user
    When I log in with the email "unverified@example.com" and the password "wrong-password"
    Then the "Email address" field should have the error "Unknown account."

  Scenario: A field that shows an error is said to have none
    Fails with: Expected no error under the "Email address" field, but it shows: "These credentials do not match our records."
    Given I am an anonymous user
    When I log in with the email "unverified@example.com" and the password "wrong-password"
    Then the "Email address" field should have no error

  Scenario: A filled field is said to block the form as empty
    Fails with: Expected the "Name" field to block the form as empty. The fields the browser refuses: "Email address" (Please fill out this field.)
    Given I am an anonymous user
    And I am on "/register"
    When I fill in "Name" with "Rita Refused"
    Then the "Name" field should block submission as required

  Scenario: A field holds another account's name
    Fails with: Expected the "Name" field to hold the name of "unverified" ("Uma Unverified"), but it holds "Mia Member".
    Given I am a logged in user with the "member" user
    When I go to "/settings/profile"
    Then the "Name" field should hold the name of "unverified"

  Scenario: A refusal is taken for a status message
    Fails with: Expected the status message "We have emailed your password reset link."
    Given I am an anonymous user
    When I ask for a password reset link for "nobody@example.com"
    Then I should see the status message "We have emailed your password reset link."

  Scenario: A notification that no action raised
    Fails with: Expected the success notification "Profile updated.". The page showed: no notification.
    Given I am a logged in user with the "member" user
    When I go to "/settings/profile"
    Then I should see the success notification "Profile updated."

  Scenario: A password field said to show its value before anybody asked
    Fails with: Expected the "Password" field to show its value, but it is a field of type "password".
    Given I am an anonymous user
    And I am on "/login"
    Then the "Password" field should show its value
