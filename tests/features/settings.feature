@settings
Feature: Settings
  As a member
  I want to keep my name, my address, my password and the look of the app the way I want them
  So that the app is mine

  # Every change a scenario makes is changed back: the name returns to the registry's, the
  # password is "changed" to the one the account has, the appearance returns to the system's.
  # The account is never deleted: the dialog is tested through its refusal.

  Background:
    Given I am a logged in user with the "member" user

  @critical
  Scenario: The profile shows the name and the address of the account
    When I open "Settings" from the user menu
    Then I should be on "/settings/profile"
    And the navigation should show "Profile" as the current page
    And the "Name" field should hold the name of "member"
    And the "email" field should hold the email of "member"

  Scenario: A new name is saved, and the name of the account is put back
    When I go to "/settings/profile"
    And I fill in "Name" with "Mia Member Renamed"
    And I press "Save"
    Then I should see the success notification "Profile updated."
    When I reload the page
    Then I should see "Mia Member Renamed"
    When I fill in "Name" with the name of "member"
    And I press "Save"
    Then I should see the success notification "Profile updated."
    When I reload the page
    Then the "Name" field should hold the name of "member"
    And the user menu should name "member"

  Scenario: An address that belongs to another account is refused
    When I go to "/settings/profile"
    And I fill in "email" with the email of "unverified"
    And I press "Save"
    Then the "email" field should have the error "The email has already been taken."
    And I should not see a success notification
    When I go to "/settings/profile"
    Then the "email" field should hold the email of "member"

  Scenario: Deleting the account asks for the password and refuses a wrong one
    When I go to "/settings/profile"
    And I press "Delete account"
    Then I should see "Are you sure you want to delete your account?" in the modal
    When I fill in "Password" with "wrong-password"
    And I click "Delete account" in the modal
    Then the "Password" field should have the error "The password is incorrect."
    When I click "Cancel" in the modal
    Then I should not see a modal
    And I should be logged in as "member"

  Scenario: The password form refuses a wrong current password and a short new one
    When I go to "/user/confirm-password"
    And I confirm my password as "member"
    And I go to "/settings/security"
    And I fill in "Current password" with "wrong-password"
    And I fill in "New password" with "short"
    And I fill in "Confirm password" with "short"
    And I press "Save"
    Then the "Current password" field should have the error "The password is incorrect."
    And the "New password" field should have the error "The password field must be at least 12 characters."
    And I should not see a success notification

  Scenario: The password form saves a new password (the one the account has)
    When I go to "/user/confirm-password"
    And I confirm my password as "member"
    And I go to "/settings/security"
    And I fill in "Current password" with the password of "member"
    And I fill in "New password" with the password of "member"
    And I fill in "Confirm password" with the password of "member"
    And I press "Save"
    Then I should see the success notification "Password updated."
    And the "Current password" field should have no error

  Scenario: The dark appearance is chosen, kept after a reload, and set back to the system's
    When I go to "/settings/appearance"
    Then the chosen appearance should be "System"
    And the page should be shown in the light appearance
    When I choose the "Dark" appearance
    Then the chosen appearance should be "Dark"
    And the page should be shown in the dark appearance
    When I reload the page
    Then the page should be shown in the dark appearance
    When I choose the "System" appearance
    Then the chosen appearance should be "System"
    And the page should be shown in the light appearance
