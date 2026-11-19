@must-fail
Feature: Assertions that must fail: the frame of the app and the error pages
  Each scenario asserts something that is not true on the test app. Its steps before the last one
  pass; the last one must fail, with the message its description announces and a hint.

  Scenario: A menu item the user menu does not have
    Fails with: Expected the user menu to offer "Administration". It offers: "Settings", "Log out".
    Given I am a logged in user with the "member" user
    When I go to "/dashboard"
    Then the user menu should offer "Administration"

  Scenario: A navigation item the app does not have
    Fails with: Expected the navigation to have the item "Billing".
    Given I am a logged in user with the "member" user
    When I go to "/settings/profile"
    Then the navigation should have the item "Billing"

  Scenario: The wrong item taken for the current page
    Fails with: Expected the navigation to show "Dashboard" as the current page. The current item: "Profile"
    Given I am a logged in user with the "member" user
    When I go to "/settings/profile"
    Then the navigation should show "Dashboard" as the current page

  Scenario: An appearance that was not chosen
    Fails with: Expected the chosen appearance "Dark", but it is "System"
    Given I am a logged in user with the "member" user
    When I go to "/settings/appearance"
    Then the chosen appearance should be "Dark"

  Scenario: A light page taken for a dark one
    Fails with: Expected the page in the dark appearance, but it is shown in the light one.
    Given I am a logged in user with the "member" user
    When I go to "/settings/appearance"
    Then the page should be shown in the dark appearance

  @js-off
  Scenario: A page of the app taken for the 404 page
    Fails with: Expected the 404 (Not Found) error page, but the browser shows HTTP 200
    Given I am an anonymous user
    When I go to "/login"
    Then I should see the 404 error page

  @js-off
  Scenario: The plain 500 page taken for the debug page
    Fails with: Expected the page to show debug information, but it shows none (HTTP 500, "Server Error").
    Given I am an anonymous user
    When I go to "/test-fixtures/server-error"
    Then the page should show debug information

  @js-off
  Scenario: The maintenance bypass used while the app is up
    Fails with: The maintenance bypass gave this browser no cookie
    Given I am an anonymous user
    When I use the maintenance bypass
