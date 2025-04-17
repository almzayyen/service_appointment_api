'use strict';

// Load environment variables from .env file in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: '.env.local' });
}

const AWS = require('aws-sdk');
const uuid = require('uuid');

// Configure AWS with explicit region
const REGION = process.env.AWS_REGION || 'us-east-1';
const IS_OFFLINE = process.env.IS_OFFLINE || false;

// Configure DynamoDB
let dynamoDbConfig = { 
  region: REGION,
  convertEmptyValues: true 
};

// If running offline (local dev), use the local DynamoDB instance
if (IS_OFFLINE) {
  dynamoDbConfig.endpoint = 'http://localhost:8000';
  console.log('Using local DynamoDB instance');
}

AWS.config.update(dynamoDbConfig);

// Get DynamoDB table name or use a default for testing
const TABLE_NAME = process.env.DYNAMODB_TABLE || 'service-appointment-api-dev';

// Initialize DynamoDB client with debugging
const dynamoDb = new AWS.DynamoDB.DocumentClient(dynamoDbConfig);

/**
 * Lambda function to create a service appointment
 */
module.exports.handler = async (event) => {
  // Log the incoming request and environment
  console.log('Received request:', JSON.stringify(event));
  console.log('Environment:', { 
    TABLE_NAME,
    REGION,
    NODE_ENV: process.env.NODE_ENV,
    IS_OFFLINE,
    LAMBDA_FUNCTION_NAME: process.env.AWS_LAMBDA_FUNCTION_NAME || 'local'
  });

  try {
    // Parse request body or use event directly if testing in Lambda console
    let data;
    
    // Check if event is from API Gateway (has a body property)
    if (event.body) {
      try {
        data = JSON.parse(event.body);
      } catch (error) {
        console.error('Invalid JSON format', error);
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Invalid request body format' })
        };
      }
    } else {
      // For direct Lambda invocation (testing in Lambda console)
      data = event;
    }

    // Validate required fields
    const requiredFields = ['fullName', 'location', 'appointmentTime', 'car', 'services'];
    for (const field of requiredFields) {
      if (!data[field]) {
        console.error(`Missing required field: ${field}`);
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: `Missing required field: ${field}` })
        };
      }
    }

    // Additional validation
    if (!Array.isArray(data.services) || data.services.length === 0) {
      console.error('Services must be a non-empty array');
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Services must be a non-empty array' })
      };
    }

    // Validate date format
    const appointmentDate = new Date(data.appointmentTime);
    if (isNaN(appointmentDate.getTime())) {
      console.error('Invalid date format');
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Invalid date format for appointmentTime' })
      };
    }

    // Generate a combined key for location+time uniqueness
    const locationTimeKey = `${data.location}#${data.appointmentTime}`;
    
    // Log the table name
    console.log(`Using DynamoDB table: ${TABLE_NAME}`);

    // First check direct match using the locationTimeKey (faster)
    const getParams = {
      TableName: TABLE_NAME,
      IndexName: 'locationTimeIndex',
      KeyConditionExpression: 'locationTimeKey = :locationTimeKey',
      ExpressionAttributeValues: {
        ':locationTimeKey': locationTimeKey
      }
    };

    console.log('Checking for existing appointments with params:', JSON.stringify(getParams));
    
    // Separate try-catch for the query operation
    let existingAppointments = { Items: [] };
    try {
      existingAppointments = await dynamoDb.query(getParams).promise();
      console.log('Query result:', JSON.stringify(existingAppointments));
      
      if (existingAppointments.Items && existingAppointments.Items.length > 0) {
        console.log('Appointment time conflict:', locationTimeKey);
        return {
          statusCode: 409,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'This appointment time is already booked at this location' })
        };
      }
    } catch (queryError) {
      console.error('Error checking appointment availability', queryError);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: 'Could not process appointment request',
          error: queryError.message,
          code: queryError.code,
          time: new Date().toISOString(),
          tableName: TABLE_NAME,
          params: JSON.stringify(getParams)
        })
      };
    }

    // Prepare item for DynamoDB
    const timestamp = new Date().toISOString();
    const appointmentId = uuid.v4();
    
    const item = {
      id: appointmentId,
      fullName: data.fullName,
      location: data.location,
      appointmentTime: data.appointmentTime,
      locationTimeKey: locationTimeKey,
      car: data.car,
      services: data.services,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    // Write to DynamoDB with a condition to prevent duplicates
    const params = {
      TableName: TABLE_NAME,
      Item: item,
      ConditionExpression: 'attribute_not_exists(id)'
    };

    console.log('Writing appointment to DynamoDB:', JSON.stringify(params));
    
    // Separate try-catch for the put operation
    try {
      await dynamoDb.put(params).promise();
      console.log('Successfully created appointment:', appointmentId);
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Appointment created successfully',
          appointmentId: appointmentId,
          appointment: item
        })
      };
    } catch (putError) {
      console.error('Error creating appointment', putError);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: 'Could not create appointment',
          error: putError.message,
          code: putError.code,
          time: new Date().toISOString(),
          tableName: TABLE_NAME,
          params: JSON.stringify(params)
        })
      };
    }
  } catch (error) {
    console.error('Unhandled error in Lambda:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message: 'Internal server error',
        error: error.message,
        stack: error.stack,
        time: new Date().toISOString()
      })
    };
  }
}; 