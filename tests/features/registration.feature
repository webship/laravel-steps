@registration
Feature: Registration refusals
  As the owner of the app
  I want the registration form to refuse what it must refuse
  So that no account is made with an address that is taken, a weak password or a missing field

  # Registration is tested through its refusals only: no scenario completes a sign-up. Every
  # scenario uses an address that is taken (the one of "member"), so even a form the app wrongly
  # accepted could not make an account.

  Background:
    Given I am an anonymous user
    And I am on "/register"

  @critical
  Scenario: An address that is taken is refused
    When I fill in "Name" with "Rita Refused"
    And I fill in "Email address" with the email of "member"
    And I fill in "Password" with "Refused-Pass-2026!"
    And I fill in "Confirm password" with "Refused-Pass-2026!"
    And I press "Create account"
    Then the "Email address" field should have the error "The email has already been taken."
    And I should be on "/register"
    And I should not be logged in

  Scenario: A confirmation that differs from the password is refused
    When I fill in "Name" with "Rita Refused"
    And I fill in "Email address" with the email of "member"
    And I fill in "Password" with "Refused-Pass-2026!"
    And I fill in "Confirm password" with "Something-Else-2026!"
    And I press "Create account"
    Then the "Password" field should have the error "The password field confirmation does not match."
    And I should be on "/register"

  Scenario: A password the password rules refuse is refused
    When I fill in "Name" with "Rita Refused"
    And I fill in "Email address" with the email of "member"
    And I fill in "Password" with "short"
    And I fill in "Confirm password" with "short"
    And I press "Create account"
    Then the "Password" field should have the error "The password field must be at least 12 characters."
    And I should be on "/register"

  Scenario: An empty name is refused by the browser before anything is sent
    When I fill in "Email address" with the email of "member"
    And I fill in "Password" with "Refused-Pass-2026!"
    And I fill in "Confirm password" with "Refused-Pass-2026!"
    And I press "Create account"
    Then the "Name" field should block submission as required
    And I should be on "/register"
