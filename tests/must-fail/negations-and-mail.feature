@must-fail
Feature: Assertions that must fail: the other side of each assertion, and the mail
  Each scenario asserts something that is not true on the test app. Its steps before the last one
  pass; the last one must fail, with the message its description announces and a hint.

  Scenario: A visitor is said to be logged in
    Fails with: Expected to be logged in, but /dashboard sent the browser to the login form.
    Given I am an anonymous user
    Then I should be logged in

  Scenario: The login form is said to be gone from the login page
    Fails with: Expected not to see the login form, but it is on the page.
    Given I am an anonymous user
    When I go to "/login"
    Then I should not see the login form

  Scenario: The user menu is said to name the other account
    Fails with: Expected the user menu to name "unverified"
    Given I am a logged in user with the "member" user
    When I go to "/dashboard"
    Then the user menu should name "unverified"

  Scenario: An item the user menu has is said to be missing
    Fails with: Expected the user menu not to offer "Settings", but it does.
    Given I am a logged in user with the "member" user
    When I go to "/dashboard"
    Then the user menu should not offer "Settings"

  Scenario: An item the navigation has is said to be missing
    Fails with: Expected the navigation not to have the item "Dashboard", but it does.
    Given I am a logged in user with the "member" user
    When I go to "/dashboard"
    Then the navigation should not have the item "Dashboard"

  Scenario: The verification notice is said to be gone for an account that is kept on it
    Fails with: Expected not to see the email verification notice (its "Resend verification email" button), but it is on the page.
    Given I am a logged in user with the "unverified" user
    When I go to "/email/verify"
    Then I should not see the email verification notice

  @js-off
  Scenario: The 404 page is said not to be there
    Fails with: Expected not to see the 404 error page, but the browser shows it
    Given I am an anonymous user
    When I go to "/no-such-page-of-the-app"
    Then I should not see the 404 error page

  Scenario: A password field said to hide a value it shows
    Fails with: Expected the "Password" field to hide its value, but it is a field of type "text".
    Given I am an anonymous user
    And I am on "/login"
    When I show the value of the "Password" field
    Then the "Password" field should hide its value

  Scenario: A save is said to have raised no notification
    Fails with: Expected no notification, but the page showed: [success] Profile updated.
    Given I am a logged in user with the "member" user
    When I go to "/settings/profile"
    And I fill in "Name" with the name of "member"
    And I click the "Save" button
    Then I should not see a notification

  Scenario: A mail the app sent is said not to have been sent
    Fails with: Expected no e-mail to unverified@example.com, but the app sent: "Verify your email address".
    Given I am a logged in user with the "unverified" user
    When I go to "/email/verify"
    And I press "Resend verification email"
    Then no email should be sent to "unverified"

  Scenario: A mail is said to hold a text it does not hold
    Fails with: The e-mail "Verify your email address" to unverified@example.com does not contain "Your order has shipped."
    Given I am a logged in user with the "unverified" user
    When I go to "/email/verify"
    And I press "Resend verification email"
    Then the email with the subject "Verify your email address" to "unverified" should contain "Your order has shipped."
