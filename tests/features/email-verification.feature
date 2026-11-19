@email-verification
Feature: Email verification
  As the owner of the app
  I want an account to verify its address before it uses the app
  So that every account belongs to somebody who reads that mail

  # The "unverified" account is never verified by the suite: no scenario opens the real link.

  @critical
  Scenario: An account whose address is not verified is kept on the verification notice
    Given I am a logged in user with the "unverified" user
    Then I should see the email verification notice
    When I go to "/dashboard"
    Then I should see the email verification notice
    When I go to "/settings/appearance"
    Then I should see the email verification notice

  Scenario: A new verification link is mailed on request
    Given I am a logged in user with the "unverified" user
    When I go to "/email/verify"
    And I press "Resend verification email"
    Then I should see the status message "A new verification link has been sent to the email address you provided during registration."
    And an email with the subject "Verify your email address" should be sent to "unverified"
    And the email with the subject "Verify your email address" to "unverified" should contain "Please click the button below to verify your email address."

  @js-off
  Scenario: A verification link that was tampered with is refused
    Given I am a logged in user with the "unverified" user
    When I go to "/email/verify"
    And I press "Resend verification email"
    And I open the "Verify Email Address" link of the email to "unverified" with a changed signature
    Then I should see the 403 error page
    And I should see "Invalid signature."
    When I go to "/dashboard"
    Then I should see the email verification notice

  Scenario: The profile settings tell the account that its address is not verified
    Given I am a logged in user with the "unverified" user
    When I go to "/settings/profile"
    Then I should see "Your email address is unverified."
    And the "Name" field should hold the name of "unverified"
    And I should not see "Delete account"
