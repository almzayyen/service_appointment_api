'use strict';

/**
 * Test suite for the Create Appointment Lambda handler
 * 
 * This file uses Jest to test the appointment creation functionality
 * with mocked AWS services to avoid making actual DynamoDB calls.
 */

// Import the handler before mocking dependencies
const { handler } = require('../src/handlers/create');

// Mock UUID consistently for predictable test outcomes
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('test-uuid-12345')
}));

/**
 * Mock AWS SDK
 * 
 * This approach mocks the AWS.DynamoDB.DocumentClient methods by creating
 * mock functions that we can control in our tests. Each test can set
 * the desired response or error for these mock functions.
 * 
 * The key strategy is to mock at the lowest possible level (the promise() method)
 * rather than the higher-level method calls, which allows us to reliably
 * control the responses regardless of how many calls the handler makes.
 */
jest.mock('aws-sdk', () => {
  // Setup spy functions we can control in each test
  const mockQueryFn = jest.fn();
  const mockPutFn = jest.fn();
  
  return {
    config: {
      update: jest.fn()
    },
    DynamoDB: {
      DocumentClient: jest.fn(() => ({
        query: () => ({
          promise: mockQueryFn
        }),
        put: () => ({
          promise: mockPutFn
        })
      }))
    }
  };
});

// Import AWS after mocking
const AWS = require('aws-sdk');
const mockDocumentClient = new AWS.DynamoDB.DocumentClient();
const mockQueryPromise = mockDocumentClient.query().promise;
const mockPutPromise = mockDocumentClient.put().promise;

describe('Create Appointment Lambda', () => {
  beforeEach(() => {
    // Clear all mock implementations and call history
    jest.clearAllMocks();
    
    // Set environment variables needed by the handler
    process.env.DYNAMODB_TABLE = 'service-appointment-api-test';
    process.env.NODE_ENV = 'test';
    process.env.IS_OFFLINE = 'false';
    process.env.AWS_REGION = 'us-east-1';
  });

  /**
   * Test case: Successful appointment creation
   * 
   * This tests the happy path where an appointment is successfully created:
   * 1. No existing appointments are found at the requested time/location
   * 2. DynamoDB put operation succeeds
   * 3. A 200 response is returned with appropriate data
   */
  test('should create an appointment successfully', async () => {
    // Mock successful query response (no existing appointments)
    mockQueryPromise.mockResolvedValue({ Items: [] });
    
    // Mock successful put response
    mockPutPromise.mockResolvedValue({});

    const event = {
      body: JSON.stringify({
        fullName: 'Jane Doe',
        location: 'Farrish Subaru',
        appointmentTime: '2025-04-20T15:30:00Z',
        car: 'Subaru Outback',
        services: ['Oil Change', 'Tire Rotation']
      })
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).message).toBe('Appointment created successfully');
    expect(mockQueryPromise).toHaveBeenCalled();
    expect(mockPutPromise).toHaveBeenCalled();
  });

  /**
   * Test case: Missing required fields
   * 
   * This tests input validation when required fields are missing:
   * 1. Request is missing required fields
   * 2. A 400 response is returned without calling DynamoDB
   */
  test('should return 400 when required fields are missing', async () => {
    const event = {
      body: JSON.stringify({
        fullName: 'Jane Doe'
        // Missing: location, appointmentTime, car, services
      })
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toContain('Missing required field');
    expect(mockQueryPromise).not.toHaveBeenCalled();
    expect(mockPutPromise).not.toHaveBeenCalled();
  });

  /**
   * Test case: Invalid data type for services
   * 
   * This tests input validation for the services field:
   * 1. Services is not an array as required
   * 2. A 400 response is returned without calling DynamoDB
   */
  test('should return 400 when services is not an array', async () => {
    const event = {
      body: JSON.stringify({
        fullName: 'Jane Doe',
        location: 'Farrish Subaru',
        appointmentTime: '2025-04-20T15:30:00Z',
        car: 'Subaru Outback',
        services: 'Oil Change' // Should be an array
      })
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toBe('Services must be a non-empty array');
    expect(mockQueryPromise).not.toHaveBeenCalled();
    expect(mockPutPromise).not.toHaveBeenCalled();
  });

  /**
   * Test case: Appointment conflict
   * 
   * This tests the conflict detection:
   * 1. DynamoDB query returns existing appointment(s) at the same time/location
   * 2. A 409 response is returned without attempting to create another appointment
   */
  test('should return 409 when appointment time is already booked', async () => {
    // Mock query response with existing appointment
    mockQueryPromise.mockResolvedValue({
      Items: [
        {
          id: 'existing-id',
          appointmentTime: '2025-04-20T15:30:00Z',
          location: 'Farrish Subaru'
        }
      ]
    });

    const event = {
      body: JSON.stringify({
        fullName: 'Jane Doe',
        location: 'Farrish Subaru',
        appointmentTime: '2025-04-20T15:30:00Z',
        car: 'Subaru Outback',
        services: ['Oil Change', 'Tire Rotation']
      })
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(409);
    expect(JSON.parse(response.body).message).toBe('This appointment time is already booked at this location');
    expect(mockQueryPromise).toHaveBeenCalled();
    expect(mockPutPromise).not.toHaveBeenCalled();
  });

  /**
   * Test case: DynamoDB query failure
   * 
   * This tests error handling when the query operation fails:
   * 1. DynamoDB query operation fails with an error
   * 2. A 500 response is returned with appropriate error message
   */
  test('should return 500 when DynamoDB query fails', async () => {
    // Mock query failure
    mockQueryPromise.mockRejectedValue(new Error('Query Error'));

    const event = {
      body: JSON.stringify({
        fullName: 'Jane Doe',
        location: 'Farrish Subaru',
        appointmentTime: '2025-04-20T15:30:00Z',
        car: 'Subaru Outback',
        services: ['Oil Change', 'Tire Rotation']
      })
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body).message).toBe('Could not process appointment request');
    expect(mockQueryPromise).toHaveBeenCalled();
    expect(mockPutPromise).not.toHaveBeenCalled();
  });

  /**
   * Test case: DynamoDB put failure
   * 
   * This tests error handling when the put operation fails:
   * 1. DynamoDB query succeeds (no conflicts)
   * 2. DynamoDB put operation fails with an error
   * 3. A 500 response is returned with appropriate error message
   */
  test('should return 500 when DynamoDB put fails', async () => {
    // Mock successful query
    mockQueryPromise.mockResolvedValue({ Items: [] });
    
    // Mock put failure
    mockPutPromise.mockRejectedValue(new Error('Put Error'));

    const event = {
      body: JSON.stringify({
        fullName: 'Jane Doe',
        location: 'Farrish Subaru',
        appointmentTime: '2025-04-20T15:30:00Z',
        car: 'Subaru Outback',
        services: ['Oil Change', 'Tire Rotation']
      })
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body).message).toBe('Could not create appointment');
    expect(mockQueryPromise).toHaveBeenCalled();
    expect(mockPutPromise).toHaveBeenCalled();
  });
}); 