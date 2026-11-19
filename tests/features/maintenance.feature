@maintenance @js-off
Feature: Maintenance mode
  As the operator of the app
  I want a down app to answer with its maintenance page, and to let me in with its secret
  So that visitors know to come back and I can check the app before it is up again

  # A lane of its own: the app must be down with the secret of cucumber.js first
  # (php artisan down --secret="webship-maintenance-bypass"), and up again after
  # (php artisan up). The default run leaves this feature out (tags).

  Scenario: Every page answers with the maintenance page
    Given I am an anonymous user
    When I go to "/login"
    Then I should see the 503 error page
    And the page should not show debug information

  Scenario: The health route still answers during maintenance
    Given I am an anonymous user
    When I go to "/up"
    Then the response status code should be 200
    And I should see "Application up"

  Scenario: The bypass lets one browser in
    Given I am an anonymous user
    When I use the maintenance bypass
    Then the response status code should be 200
    When I go to "/login"
    Then I should see the login form
