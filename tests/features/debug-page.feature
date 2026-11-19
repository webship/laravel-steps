@debug-page @js-off
Feature: The debug page check, on a real debug page
  As the owner of the app
  I want to know that the check for debug information sees a real debug page
  So that a green "the page should not show debug information" means something

  # A lane of its own: the app runs with APP_DEBUG=true for it
  # (ddev dotenv set .env --app-debug=true) and with APP_DEBUG=false again after.
  # The default run leaves this feature out (tags).

  Scenario: An error nothing catches shows the debug page, and the check sees it
    Given I am an anonymous user
    When I go to "/test-fixtures/server-error"
    Then the response status code should be 500
    And the page should show debug information
