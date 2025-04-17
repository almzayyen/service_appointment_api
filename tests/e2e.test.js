'use strict';

// Skip these tests in CI environments since they require a deployed API
const runEndToEndTests = process.env.RUN_E2E_TESTS === 'true';

// These tests require the API to be deployed first
// They use the actual API endpoint and API key from environment variables
describe('Service Appointment API (E2E)', () => {
  // Skip all tests if environment variables are not set
  if (!runEndToEndTests) {
    test.skip('E2E tests are skipped (set RUN_E2E_TESTS=true to enable)', () => {});
    return;
  }
  
  const API_ENDPOINT = process.env.API_ENDPOINT;
  const API_KEY = process.env.API_KEY;
  
  if (!API_ENDPOINT || !API_KEY) {
    test.skip('Missing API_ENDPOINT or API_KEY environment variables', () => {});
    return;
  }

  console.log('Running E2E tests against:', API_ENDPOINT);
  console.log('Using API Key:', API_KEY.substring(0, 3) + '...' + API_KEY.substring(API_KEY.length - 3));

  const fetch = require('node-fetch');
  
  // Helper function to make API requests
  const callApi = async (body) => {
    console.log(`Making API call to ${API_ENDPOINT} with body:`, JSON.stringify(body));
    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY
        },
        body: JSON.stringify(body)
      });
      
      const responseText = await response.text();
      console.log(`Response status: ${response.status}, body:`, responseText);
      
      const data = responseText ? JSON.parse(responseText) : null;
      return { status: response.status, data };
    } catch (error) {
      console.error('API call failed:', error);
      return { status: 500, data: { message: error.message } };
    }
  };
  
  // ✅ 200 OK: Appointment created
  test('should create an appointment successfully', async () => {
    // Use a unique time to avoid conflicts with existing appointments
    const uniqueTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    const requestBody = {
      fullName: 'E2E Test User',
      location: 'Farrish Subaru',
      appointmentTime: uniqueTime,
      car: 'Subaru Outback',
      services: ['Oil Change', 'Tire Rotation']
    };
    
    const response = await callApi(requestBody);
    
    if (response.status !== 200) {
      console.error('Failed to create appointment:', response.data);
    }
    
    expect(response.status).toBe(200);
    expect(response.data.message).toBe('Appointment created successfully');
    expect(response.data.appointmentId).toBeDefined();
  }, 10000); // Increase timeout to 10 seconds
  
  // 🚫 400 Bad Request: Missing inputs
  test('should return 400 when required fields are missing', async () => {
    const requestBody = {
      fullName: 'E2E Test User',
      // Missing other required fields
    };
    
    const response = await callApi(requestBody);
    
    expect(response.status).toBe(400);
    expect(response.data.message).toContain('Missing required field');
  });
  
  // ⚠️ 409 Conflict: Appointment already exists
  test('should return 409 when appointment time is already booked', async () => {
    // First create an appointment
    const appointmentTime = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    
    const requestBody = {
      fullName: 'E2E Test User',
      location: 'Farrish Subaru',
      appointmentTime: appointmentTime,
      car: 'Subaru Outback',
      services: ['Oil Change', 'Tire Rotation']
    };
    
    // Create the first appointment
    const firstResponse = await callApi(requestBody);
    console.log('First appointment response:', firstResponse);
    
    if (firstResponse.status !== 200) {
      console.warn('First appointment creation failed, test may not be valid');
    }
    
    // Try to create a second appointment at the same time
    const duplicateResponse = await callApi(requestBody);
    
    expect(duplicateResponse.status).toBe(409);
    expect(duplicateResponse.data.message).toBe('This appointment time is already booked at this location');
  }, 15000); // Increase timeout to 15 seconds
}); 