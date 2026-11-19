@error-pages @js-off
Feature: Error pages
  As the owner of a live app
  I want every error to answer with a plain error page
  So that visitors understand what happened and nobody learns how the app is built

  # The browser logs every error page as a resource that failed to load: the scenarios carry
  # @js-off. The 403 page is in email-verification.feature, the 429 page in session.feature.

  @critical
  Scenario: An address the app does not have answers with the 404 page
    Given I am an anonymous user
    When I go to "/no-such-page-of-the-app"
    Then I should see the 404 error page
    And the response status code should be 404
    And the page should not show debug information

  Scenario: A form sent from another site is refused with the expired page
    Given I am an anonymous user
    When a page of another site sends a form to "/login"
    Then I should see the 419 error page
    And I should not be logged in

  @critical
  Scenario: An error nothing catches shows the 500 page and no debug information
    Given I am an anonymous user
    When I go to "/test-fixtures/server-error"
    Then I should see the 500 error page
    And the page should not show debug information

  Scenario: A request with a method the address does not take is refused
    Given I am an anonymous user
    When I go to "/logout"
    Then the response status code should be 405
    And the page should not show debug information
