@health
Feature: Health check
  As the operator of the app
  I want its health route to answer
  So that a load balancer or a monitor knows the app is up

  @critical
  Scenario: The health route answers that the application is up
    Given I am an anonymous user
    When I go to "/up"
    Then the response status code should be 200
    And I should see "Application up"
