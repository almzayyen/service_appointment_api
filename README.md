# Service Appointment API

A serverless API for scheduling service appointments. This project uses AWS Lambda, API Gateway, and DynamoDB to provide a scalable, event-driven architecture.

## Features

- Create service appointments
- Validate appointment requests
- Store appointments in DynamoDB
- API key authentication
- Error handling for various scenarios
- Unit and integration tests

## Architecture

- **AWS Lambda**: Handles appointment creation logic
- **API Gateway**: Exposes HTTP endpoints with API key security
- **DynamoDB**: Stores appointment data with efficient query patterns
- **OSS Serverless Framework**: Manages deployment and infrastructure as code (open-source version)

## Prerequisites

- Node.js 14+
- AWS CLI configured with appropriate credentials
- An AWS account (free tier eligible)
- OSS Serverless Framework (installed via npm during setup)

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/service-appointment-api.git
   cd service-appointment-api
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Install the OSS Serverless CLI (open-source version):
   ```
   npm install --save-dev @oss-serverless/cli
   ```

   > **IMPORTANT**: We use the open-source version of Serverless Framework: https://github.com/oss-serverless/serverless

## Deployment with OSS Serverless

All deployment commands use the open-source version of Serverless through npx:

### 1. Quick Deployment (Default Settings)

```bash
# Deploy using the open-source Serverless version
npx sls deploy
```

### 2. Deploy to a Specific Stage

```bash
# For production environment (using open-source Serverless)
npx sls deploy --stage prod

# For staging environment
npx sls deploy --stage staging
```

### 3. Deploy to a Specific Region

```bash
# Deploy to eu-west-1 region (using open-source Serverless)
npx sls deploy --region eu-west-1
```

### 4. Deploy a Single Function (for faster updates)

```bash
# Deploy only the create function (using open-source Serverless)
npx sls deploy function -f create
```

### Deployment Outputs

After successful deployment, you'll see output similar to:

```
Service Information
service: service-appointment-api
stage: dev
region: us-east-1
api keys:
  service-appointment-api-key-1234: xxxxxxxxxxxxxxxxxxxxxxxxxx
endpoints:
  POST - https://xxxxxxxx.execute-api.us-east-1.amazonaws.com/dev/appointments
```

**IMPORTANT:** Copy and save your API key and endpoint URL as you'll need them to make requests.

## Local Development

To run the API locally:

1. Install DynamoDB local:
   ```
   npm run dynamodb:install
   ```

2. Start the local development environment (uses open-source Serverless):
   ```
   npm run dev
   ```

This will start both a local DynamoDB instance and the Serverless offline server.

## Usage

Here are sample curl commands to interact with the API:

### Create an Appointment

```bash
curl -X POST \
  https://xxxxxxxx.execute-api.us-east-1.amazonaws.com/dev/appointments \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: YOUR_API_KEY' \
  -d '{
    "fullName": "Jane Doe",
    "location": "Farrish Subaru",
    "appointmentTime": "2025-04-20T15:30:00Z",
    "car": "Subaru Outback",
    "services": ["Oil Change", "Tire Rotation"]
}'
```

### Create an Appointment (Windows PowerShell)

```powershell
$headers = @{
    "Content-Type" = "application/json"
    "x-api-key" = "YOUR_API_KEY"
}

$body = @{
    fullName = "Jane Doe"
    location = "Farrish Subaru"
    appointmentTime = "2025-04-20T15:30:00Z"
    car = "Subaru Outback"
    services = @("Oil Change", "Tire Rotation")
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://xxxxxxxx.execute-api.us-east-1.amazonaws.com/dev/appointments" -Method Post -Headers $headers -Body $body
```

### Test with Local Endpoint

When running the API locally with `npm run dev`, you can use:

```bash
curl -X POST \
  http://localhost:3000/dev/appointments \
  -H 'Content-Type: application/json' \
  -d '{
    "fullName": "Jane Doe",
    "location": "Farrish Subaru",
    "appointmentTime": "2025-04-20T15:30:00Z",
    "car": "Subaru Outback",
    "services": ["Oil Change", "Tire Rotation"]
}'
```

### Response Examples

#### Success (200 OK)
```json
{
  "message": "Appointment created successfully",
  "appointmentId": "550e8400-e29b-41d4-a716-446655440000",
  "appointment": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "fullName": "Jane Doe",
    "location": "Farrish Subaru",
    "appointmentTime": "2025-04-20T15:30:00Z",
    "locationTimeKey": "Farrish Subaru#2025-04-20T15:30:00Z",
    "car": "Subaru Outback",
    "services": ["Oil Change", "Tire Rotation"],
    "createdAt": "2023-05-01T12:00:00Z",
    "updatedAt": "2023-05-01T12:00:00Z"
  }
}
```

#### Bad Request (400)
```json
{
  "message": "Missing required field: location"
}
```

#### Unauthorized (401)
```
Unauthorized
```

#### Conflict (409)
```json
{
  "message": "This appointment time is already booked at this location"
}
```

## Testing

### Running Unit Tests

Run all tests with Jest:

```bash
npm test
```

### Running Tests with Coverage Report

```bash
npm test -- --coverage
```

### Run Specific Test Files

```bash
# Test only the create handler
npm test -- tests/create.test.js

# Test only a specific test case using pattern matching
npm test -- -t "should create an appointment successfully"
```

### Watch Mode for Development

```bash
npm test -- --watch
```

### Integration/E2E Tests

For end-to-end API tests against your deployed endpoint:

```bash
# Set required environment variables
export API_ENDPOINT="YOUR_API_ENDPOINT_URL"
export API_KEY="YOUR_API_KEY_VALUE" 
export RUN_E2E_TESTS=true

# Run E2E tests
npm run test:e2e
```

### Test Strategy

Our tests are structured as follows:

1. **Unit Tests**: Test individual functions and components in isolation
2. **Integration Tests**: Test the interaction between the Lambda handler and mocked AWS services
3. **E2E Tests**: Test the full API endpoint with real HTTP requests (requires deployment)

We use Jest's mocking capabilities to mock AWS SDK calls, ensuring tests are fast and don't depend on external services.

## Troubleshooting Tests

If tests are failing:

1. Ensure all dependencies are installed: `npm install`
2. Check that environment variables are set correctly for your tests
3. Verify mock implementations match the current AWS SDK usage
4. Run tests with verbose output: `npm test -- --verbose`

## Cost Considerations

This project is designed to be cost-effective:

- Uses AWS Lambda (free tier: 1M requests/month)
- DynamoDB with on-demand capacity (free tier: 25GB storage)
- API Gateway (free tier: 1M API calls/month)

For most small to medium applications, this setup should remain within the AWS free tier. 