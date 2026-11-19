@password-confirmation
Feature: Password confirmation
  As a member
  I want the app to ask for my password again before its security settings
  So that nobody who finds my session open changes my password

  # The app asks once a session, so the scenario starts a session of its own.

  Scenario: The security settings ask for the password, refuse a wrong one and open after the right one
    Given I am an anonymous user
    When I log in as "member" with the login form
    And I go to "/settings/security"
    Then I should be asked to confirm my password
    When I confirm my password with "wrong-password"
    Then the "Password" field should have the error "The provided password was incorrect."
    And I should be asked to confirm my password
    When I confirm my password as "member"
    Then I should be on "/settings/security"
    And I should not be asked to confirm my password
