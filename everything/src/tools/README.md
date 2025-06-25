# RX Resume Tools Testing

This directory contains tools for interacting with the RX Resume API and a test script to verify their functionality.

## Setup

1. Copy the `.env.example` file to `.env`:
   ```
   cp .env.example .env
   ```

2. Edit the `.env` file and add your RX Resume credentials:
   ```
   RX_EMAIL=your_email@example.com
   RX_PASSWORD=your_password
   RX_BASE_URL=https://resume.emmanuelu.com/api
   ```

## Running Tests

The `test_resume_tools.js` script allows you to test each tool individually:

### Create a new resume:
```
node test_resume_tools.js create
```

### Update the summary section:
```
node test_resume_tools.js summary <resume_id>
```

### Update the skills section:
```
node test_resume_tools.js skills <resume_id>
```

### Update the experience section:
```
node test_resume_tools.js experience <resume_id>
```

### Update the education section:
```
node test_resume_tools.js education <resume_id>
```

### Run all tests (creates a new resume and updates all sections):
```
node test_resume_tools.js all
```

## Debugging

The test script outputs detailed information about the request parameters and the response from the API. This can help you identify issues with the tools or the API.

If you encounter any issues, check the following:
1. Make sure your credentials in the `.env` file are correct
2. Verify that the RX Resume API is accessible
3. Check the error messages in the console output

## Adding More Tests

You can add more test functions to the `test_resume_tools.js` file to test other sections or operations. Follow the pattern of the existing test functions.
