#!/usr/bin/env node

/**
 * Gateway Smoke Tests
 * Tests critical gateway functionality
 */

const axios = require('axios');
const { exit } = require('process');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

// Colors for output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let passed = 0;
let failed = 0;

function success(message) {
  console.log(`${GREEN}✓${RESET} ${message}`);
  passed++;
}

function fail(message, error) {
  console.log(`${RED}✗${RESET} ${message}`);
  if (error) {
    console.log(`  ${RED}Error: ${error.message}${RESET}`);
    if (error.response) {
      console.log(`  Status: ${error.response.status}`);
      console.log(`  Data:`, error.response.data);
    }
  }
  failed++;
}

function info(message) {
  console.log(`${YELLOW}ℹ${RESET} ${message}`);
}

async function runTests() {
  console.log('\n==============================================');
  console.log('  Gateway Smoke Tests');
  console.log('  Base URL:', BASE_URL);
  console.log('==============================================\n');

  // Test 1: Health check
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    if (response.status === 200 && response.data.success === true) {
      success('Health check endpoint returns 200 OK');
    } else {
      fail('Health check endpoint did not return expected response');
    }
  } catch (error) {
    fail('Health check endpoint failed', error);
  }

  // Test 2: Readiness check
  try {
    const response = await axios.get(`${BASE_URL}/ready`);
    if (response.status === 200 && response.data.success === true) {
      success('Readiness check endpoint returns 200 OK');
    } else {
      fail('Readiness check endpoint did not return expected response');
    }
  } catch (error) {
    fail('Readiness check endpoint failed', error);
  }

  // Test 3: Gateway status
  try {
    const response = await axios.get(`${BASE_URL}/gateway/status`);
    if (response.status === 200 && response.data.data.type === 'express-gateway') {
      success('Gateway status endpoint returns correct information');
    } else {
      fail('Gateway status endpoint did not return expected data');
    }
  } catch (error) {
    fail('Gateway status endpoint failed', error);
  }

  // Test 4: CORS headers
  try {
    const response = await axios.get(`${BASE_URL}/health`, {
      headers: {
        'Origin': 'http://localhost:5173'
      }
    });
    if (response.headers['access-control-allow-origin']) {
      success('CORS headers are present');
    } else {
      fail('CORS headers are missing');
    }
  } catch (error) {
    fail('CORS test failed', error);
  }

  // Test 5: Rate limit headers
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    if (response.headers['ratelimit-limit']) {
      success('Rate limit headers are present');
      info(`  Rate limit: ${response.headers['ratelimit-limit']} requests per window`);
    } else {
      fail('Rate limit headers are missing');
    }
  } catch (error) {
    fail('Rate limit test failed', error);
  }

  // Test 6: Request ID tracking
  try {
    const customRequestId = 'test-request-123';
    const response = await axios.get(`${BASE_URL}/health`, {
      headers: {
        'x-request-id': customRequestId
      }
    });
    if (response.headers['x-request-id'] === customRequestId) {
      success('Request ID is propagated correctly');
    } else {
      fail('Request ID propagation failed');
    }
  } catch (error) {
    fail('Request ID test failed', error);
  }

  // Test 7: Security headers (Helmet)
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    const hasSecurityHeaders =
      response.headers['x-content-type-options'] ||
      response.headers['x-frame-options'] ||
      response.headers['x-xss-protection'];

    if (hasSecurityHeaders) {
      success('Security headers (Helmet) are present');
    } else {
      fail('Security headers are missing');
    }
  } catch (error) {
    fail('Security headers test failed', error);
  }

  // Test 8: 404 handler
  try {
    await axios.get(`${BASE_URL}/nonexistent-route`);
    fail('404 handler did not work (request succeeded unexpectedly)');
  } catch (error) {
    if (error.response && error.response.status === 404) {
      success('404 handler works correctly');
    } else {
      fail('404 handler test failed', error);
    }
  }

  // Test 9: Authentication required for protected routes
  try {
    await axios.get(`${BASE_URL}/api/users`);
    fail('Protected route allowed access without JWT (should return 401)');
  } catch (error) {
    if (error.response && error.response.status === 401) {
      success('Protected routes require authentication');
    } else {
      fail('Authentication check failed', error);
    }
  }

  // Test 10: Public routes are accessible
  try {
    // Note: This will fail if application-service is not running
    const response = await axios.post(`${BASE_URL}/api/students/validate-rut`, {
      rut: '12.345.678-9'
    });

    // Even if the backend is not available, the gateway should proxy the request
    // and return a 502 Bad Gateway error, not 401 Unauthorized
    success('Public routes are accessible without authentication');
  } catch (error) {
    if (error.response && error.response.status === 502) {
      success('Public routes are accessible (backend unavailable but gateway proxied)');
    } else if (error.response && error.response.status === 401) {
      fail('Public route requires authentication (should be public)');
    } else {
      info('Public route test skipped (backend service not running)');
    }
  }

  // Summary
  console.log('\n==============================================');
  console.log(`  Results: ${GREEN}${passed} passed${RESET}, ${RED}${failed} failed${RESET}`);
  console.log('==============================================\n');

  if (failed > 0) {
    exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error(`${RED}Fatal error running tests:${RESET}`, error.message);
  exit(1);
});
