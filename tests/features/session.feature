@session
Feature: Logging in and out
  As a member of the app
  I want to log in with my address and my password, and to log out again
  So that only I reach my dashboard and my settings

  # The accounts are the ones of the users registry in cucumber.js. A scenario that tests the login
  # form logs in through it; the others take over the session of the first login of the run.

  @critical
  Scenario: A member logs in with the login form and lands on the dashboard
    Given I am an anonymous user
    When I log in as "member" with the login form
    Then I should be on "/dashboard"
    And I should be logged in as "member"

  @critical
  Scenario: A wrong password is refused with an error under the address
    Given I am an anonymous user
    When I log in with the email "unverified@example.com" and the password "wrong-password"
    Then I should see the login form
    And the "Email address" field should have the error "These credentials do not match our records."
    And the "Email address" field should hold the email of "unverified"
    And the "Password" field should have no error
    And I should not be logged in

  Scenario: A page that needs a session sends a visitor to the login form
    Given I am an anonymous user
    When I go to "/settings/profile"
    Then I should see the login form
    And I should be on "/login"

  Scenario: The session lasts through a reload and a visit to another page
    Given I am a logged in user with the "member" user
    When I reload the page
    And I go to "/settings/profile"
    Then I should be logged in as "member"

  Scenario: Logging out ends the session
    Given I am an anonymous user
    When I log in as "member" with the login form
    And I log out
    Then I should be on the homepage
    And I should not be logged in

  Scenario: "Remember me" gives the browser a cookie that outlives the session
    Given I am an anonymous user
    When I log in as "unverified" with the login form and "Remember me" checked
    Then a cookie with a name containing "remember_web" should exist
    And I should be logged in as "unverified"

  Scenario: The password field shows its value only when asked
    Given I am an anonymous user
    And I am on "/login"
    When I fill in "Password" with "Visible-Pass-2026!"
    Then the "Password" field should hide its value
    When I show the value of the "Password" field
    Then the "Password" field should show its value
    When I hide the value of the "Password" field
    Then the "Password" field should hide its value

  @js-off
  Scenario: Too many attempts for one address are refused for a minute
    Given I am an anonymous user
    When I try to log in 6 times with the email "too-many-guesses@example.com" and a wrong password
    Then I should see the 429 error page
