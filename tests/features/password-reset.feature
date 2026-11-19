@password-reset
Feature: Password reset through the mail
  As a member who forgot the password
  I want the app to mail me a link to choose a new one
  So that I can log in again without anybody's help

  # The mail is read from the mailbox of the app (worldParameters.mailUrl). The member chooses the
  # password the registry has for it, so the account keeps its password and the link is used: the
  # next run is not asked to wait.

  @critical
  Scenario: A member resets the password with the link the app mails
    Given I am an anonymous user
    When I ask for a password reset link for "member"
    Then I should see the status message "We have emailed your password reset link."
    And an email with the subject "Reset your password" should be sent to "member"
    And the email with the subject "Reset your password" to "member" should contain "This password reset link will expire in 60 minutes."
    When I open the "Reset Password" link of the email to "member"
    Then the "Email" field should hold the email of "member"
    When I fill in "Password" with the password of "member"
    And I fill in "Confirm password" with the password of "member"
    And I press "Reset password"
    Then I should see the status message "Your password has been reset."
    And I should see the login form
    When I open the "Reset Password" link of the email to "member"
    And I fill in "Password" with the password of "member"
    And I fill in "Confirm password" with the password of "member"
    And I press "Reset password"
    Then the "Email" field should have the error "This password reset token is invalid."
    When I log in as "member" with the login form
    Then I should be logged in as "member"

  Scenario: An address with no account gets an error and no mail
    Given I am an anonymous user
    When I ask for a password reset link for "nobody@example.com"
    Then the "Email address" field should have the error "We can't find a user with that email address."
    And I should not see the status message "We have emailed your password reset link."
    And no email should be sent to "nobody@example.com"

  Scenario: A second request within a minute is refused while the first link is unused
    Given I am an anonymous user
    When I ask for a password reset link for "unverified"
    And I ask for a password reset link for "unverified" again
    Then the "Email address" field should have the error "Please wait before retrying."
    When I open the "Reset Password" link of the email to "unverified"
    And I fill in "Password" with the password of "unverified"
    And I fill in "Confirm password" with the password of "unverified"
    And I press "Reset password"
    Then I should see the status message "Your password has been reset."
