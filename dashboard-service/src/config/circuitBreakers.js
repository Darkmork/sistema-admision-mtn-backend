const CircuitBreaker = require('opossum');
const logger = require('../utils/logger');

// Circuit breaker categories for Dashboard Service
// Dashboard queries can be heavy, so we use different timeouts

// Simple queries (< 2s expected)
const simpleQueryBreakerOptions = {
  timeout: 2000,
  errorThresholdPercentage: 60,
  resetTimeout: 20000,
  rollingCountTimeout: 10000,
  rollingCountBuckets: 10,
  name: 'Simple Query'
};

// Medium queries (2-5s expected)
const mediumQueryBreakerOptions = {
  timeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || '5000', 10),
  errorThresholdPercentage: parseInt(process.env.CIRCUIT_BREAKER_ERROR_THRESHOLD || '50', 10),
  resetTimeout: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT || '30000', 10),
  rollingCountTimeout: 10000,
  rollingCountBuckets: 10,
  name: 'Medium Query'
};

// Heavy queries (analytics, complex aggregations - up to 10s)
const heavyQueryBreakerOptions = {
  timeout: 10000,
  errorThresholdPercentage: 40,
  resetTimeout: 60000,
  rollingCountTimeout: 15000,
  rollingCountBuckets: 10,
  name: 'Heavy Query'
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
const heavyQueryBreaker = new CircuitBreaker(async (fn) => fn(), heavyQueryBreakerOptions);
const writeOperationBreaker = new CircuitBreaker(async (fn) => fn(), writeOperationBreakerOptions);

// Event handlers for all breakers
[simpleQueryBreaker, mediumQueryBreaker, heavyQueryBreaker, writeOperationBreaker].forEach(breaker => {
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
  heavyQueryBreaker,
  writeOperationBreaker
};
