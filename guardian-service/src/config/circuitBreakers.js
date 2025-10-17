const CircuitBreaker = require('opossum');
const logger = require('../utils/logger');

// Circuit breaker categories for Guardian Service

// Simple queries (< 2s expected) - lookups, simple selects
const simpleQueryBreakerOptions = {
  timeout: 2000,
  errorThresholdPercentage: 60,
  resetTimeout: 20000,
  rollingCountTimeout: 10000,
  rollingCountBuckets: 10,
  name: 'Simple Query'
};

// Medium queries (2-5s expected) - joins, filters
const mediumQueryBreakerOptions = {
  timeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || '5000', 10),
  errorThresholdPercentage: parseInt(process.env.CIRCUIT_BREAKER_ERROR_THRESHOLD || '50', 10),
  resetTimeout: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT || '30000', 10),
  rollingCountTimeout: 10000,
  rollingCountBuckets: 10,
  name: 'Medium Query'
};

// Write operations (3s timeout)
const writeOperationBreakerOptions = {
  timeout: 3000,
  errorThresholdPercentage: 30,
  resetTimeout: 45000,
  rollingCountTimeout: 10000,
  rollingCountBuckets: 10,
  name: 'Write Operation'
};

// Create circuit breakers
const simpleQueryBreaker = new CircuitBreaker(async (fn) => fn(), simpleQueryBreakerOptions);
const mediumQueryBreaker = new CircuitBreaker(async (fn) => fn(), mediumQueryBreakerOptions);
const writeOperationBreaker = new CircuitBreaker(async (fn) => fn(), writeOperationBreakerOptions);

// Event handlers for all breakers
[simpleQueryBreaker, mediumQueryBreaker, writeOperationBreaker].forEach(breaker => {
  breaker.on('open', () => {
    logger.warn(`[Circuit Breaker ${breaker.options.name}] OPENED - Too many failures detected`);
  });

  breaker.on('halfOpen', () => {
    logger.info(`[Circuit Breaker ${breaker.options.name}] HALF-OPEN - Testing if service recovered`);
  });

  breaker.on('close', () => {
    logger.info(`[Circuit Breaker ${breaker.options.name}] CLOSED - Service recovered successfully`);
  });

  breaker.on('timeout', () => {
    logger.warn(`[Circuit Breaker ${breaker.options.name}] TIMEOUT - Operation exceeded ${breaker.options.timeout}ms`);
  });

  breaker.on('reject', () => {
    logger.warn(`[Circuit Breaker ${breaker.options.name}] REJECTED - Circuit is open, request blocked`);
  });

  breaker.on('failure', (error) => {
    logger.error(`[Circuit Breaker ${breaker.options.name}] FAILURE:`, error.message);
  });
});

module.exports = {
  simpleQueryBreaker,
  mediumQueryBreaker,
  writeOperationBreaker
};
