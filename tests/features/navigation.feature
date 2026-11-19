@navigation
Feature: Navigation
  As a member
  I want the sidebar, the user menu and the settings navigation to show where I am
  So that I find each page of the app without knowing its address

  Scenario: A visitor finds the links to log in and to register on the home page
    Given I am an anonymous user
    And I am on the homepage
    Then the "Log in" link should be visible
    And the "Register" link should be visible

  @critical
  Scenario: The dashboard is in the sidebar, marked as the current page
    Given I am a logged in user with the "member" user
    When I go to "/dashboard"
    Then the navigation should have the item "Dashboard"
    And the navigation should show "Dashboard" as the current page

  Scenario: The user menu names the account and offers its settings and the way out
    Given I am a logged in user with the "member" user
    When I go to "/dashboard"
    Then the user menu should name "member"
    And the user menu should offer "Settings"
    And the user menu should offer "Log out"
    And the user menu should not offer "Administration"

  Scenario: The settings navigation leads to each settings page and marks the one on screen
    Given I am a logged in user with the "member" user
    When I go to "/settings/profile"
    Then the navigation should have the item "Profile"
    And the navigation should have the item "Security"
    And the navigation should have the item "Appearance"
    And the navigation should not have the item "Billing"
    When I click "Appearance"
    Then I should be on "/settings/appearance"
    And the navigation should show "Appearance" as the current page
    And the navigation should not show "Profile" as the current page

  Scenario: The home page offers the dashboard to a member
    Given I am a logged in user with the "member" user
    When I go to the homepage
    Then the "Dashboard" link should be visible
