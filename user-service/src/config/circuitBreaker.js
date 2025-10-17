const CircuitBreaker = require('opossum');

/**
 * Circuit Breaker Configuration
 *
 * Differentiated circuit breakers for User Service:
 * - Simple: Fast lookups (2s timeout)
 * - Medium: Standard queries with joins + BCrypt (5s timeout)
 * - Write: Critical user data mutations (3s timeout)
 */

// 1. Simple Queries (2s, 60% threshold, 20s reset)
const simpleQueryBreakerOptions = {
  timeout: 2000,
  errorThresholdPercentage: 60,
  resetTimeout: 20000,
  rollingCountTimeout: 10000,
  rollingCountBuckets: 10,
  name: 'UserSimpleQueryBreaker'
};

// 2. Medium Queries (5s, 50% threshold, 30s reset)
const mediumQueryBreakerOptions = {
  timeout: 5000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  rollingCountTimeout: 10000,
  rollingCountBuckets: 10,
  name: 'UserMediumQueryBreaker'
};

// 3. Write Operations (3s, 30% threshold, 45s reset)
const writeOperationBreakerOptions = {
  timeout: 3000,
  errorThresholdPercentage: 30,
  resetTimeout: 45000,
  rollingCountTimeout: 10000,
  rollingCountBuckets: 10,
  name: 'UserWriteBreaker'
};

// Setup event listeners for a circuit breaker
const setupBreakerEvents = (breaker, name) => {
  breaker.on('open', () => {
    console.error(`⚠️ [Circuit Breaker ${name}] OPEN - Too many failures`);
  });

  breaker.on('halfOpen', () => {
    console.warn(`🔄 [Circuit Breaker ${name}] HALF-OPEN - Testing recovery`);
  });

  breaker.on('close', () => {
    console.log(`✅ [Circuit Breaker ${name}] CLOSED - Service recovered`);
  });

  breaker.fallback(() => {
    throw new Error(`Service temporarily unavailable - ${name} circuit breaker open`);
  });
};

// Create circuit breakers
const createCircuitBreakers = () => {
  const simpleQueryBreaker = new CircuitBreaker(
    async (client, query, params) => await client.query(query, params),
    simpleQueryBreakerOptions
  );

  const mediumQueryBreaker = new CircuitBreaker(
    async (client, query, params) => await client.query(query, params),
    mediumQueryBreakerOptions
  );

  const writeOperationBreaker = new CircuitBreaker(
    async (client, query, params) => await client.query(query, params),
    writeOperationBreakerOptions
  );

  // Setup events
  setupBreakerEvents(simpleQueryBreaker, 'Simple');
  setupBreakerEvents(mediumQueryBreaker, 'Medium');
  setupBreakerEvents(writeOperationBreaker, 'Write');

  console.log('✅ Circuit breakers initialized (Simple, Medium, Write)');

  return {
    simpleQueryBreaker,
    mediumQueryBreaker,
    writeOperationBreaker
  };
};

module.exports = {
  createCircuitBreakers
};
