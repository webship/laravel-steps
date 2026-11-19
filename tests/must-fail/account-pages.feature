@must-fail
Feature: Assertions that must fail: the account pages and the mail
  Each scenario asserts something that is not true on the test app. Its steps before the last one
  pass; the last one must fail, with the message its description announces and a hint.

  Scenario: A verified member is said to be on the verification notice
    Fails with: Expected to see the email verification notice (its "Resend verification email" button), but it did not appear
    Given I am a logged in user with the "member" user
    When I go to "/dashboard"
    Then I should see the email verification notice

  Scenario: The dashboard is said to ask for the password
    Fails with: Expected to see the password confirmation form, but it did not appear
    Given I am a logged in user with the "member" user
    When I go to "/dashboard"
    Then I should be asked to confirm my password

  Scenario: A mail to an address that has no account
    Fails with: No e-mail "Reset your password" to nobody@example.com arrived in the mailbox
    Given I am an anonymous user
    When I ask for a password reset link for "nobody@example.com"
    Then an email with the subject "Reset your password" should be sent to "nobody@example.com"
