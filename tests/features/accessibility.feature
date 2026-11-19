@a11y
Feature: Accessibility of the pages every app starts from
  As the owner of the app
  I want its pages to have no critical accessibility violation and a label on every field
  So that the app works with a screen reader and a keyboard from its first day

  # The audit is axe's. Lower findings of the starter kits (no main landmark on the auth pages, the
  # contrast of a few grey texts) are reported by "I print accessibility violations" and not
  # asserted here.

  Scenario Outline: <page> has no critical accessibility violation and a label on every field
    Given I am an anonymous user
    And I am on "<path>"
    Then the page should have no critical accessibility violations
    And every form field should have an accessible label
    And the page should declare a language
    And the page should have a title

    Examples:
      | page                    | path             |
      | The login page          | /login           |
      | The registration page   | /register        |
      | The password reset page | /forgot-password |

  Scenario: The dashboard and the settings have no critical accessibility violation
    Given I am a logged in user with the "member" user
    When I go to "/dashboard"
    Then the page should have no critical accessibility violations
    When I go to "/settings/profile"
    Then the page should have no critical accessibility violations
    And every form field should have an accessible label
