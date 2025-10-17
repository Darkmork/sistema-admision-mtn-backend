const CircuitBreaker = require('opossum');
const logger = require('../utils/logger');

// Circuit breaker options for different query types
const simpleQueryBreakerOptions = {
  timeout: parseInt(process.env.CB_SIMPLE_TIMEOUT || '2000'),
  errorThresholdPercentage: parseInt(process.env.CB_SIMPLE_ERROR_THRESHOLD || '60'),
  resetTimeout: parseInt(process.env.CB_SIMPLE_RESET_TIMEOUT || '20000'),
  name: 'ApplicationSimpleQueryBreaker'
};

const mediumQueryBreakerOptions = {
  timeout: parseInt(process.env.CB_MEDIUM_TIMEOUT || '5000'),
  errorThresholdPercentage: parseInt(process.env.CB_MEDIUM_ERROR_THRESHOLD || '50'),
  resetTimeout: parseInt(process.env.CB_MEDIUM_RESET_TIMEOUT || '30000'),
  name: 'ApplicationMediumQueryBreaker'
};

const writeOperationBreakerOptions = {
  timeout: parseInt(process.env.CB_WRITE_TIMEOUT || '3000'),
  errorThresholdPercentage: parseInt(process.env.CB_WRITE_ERROR_THRESHOLD || '30'),
  resetTimeout: parseInt(process.env.CB_WRITE_RESET_TIMEOUT || '45000'),
  name: 'ApplicationWriteBreaker'
};

const externalServiceBreakerOptions = {
  timeout: parseInt(process.env.CB_EXTERNAL_TIMEOUT || '8000'),
  errorThresholdPercentage: parseInt(process.env.CB_EXTERNAL_ERROR_THRESHOLD || '70'),
  resetTimeout: parseInt(process.env.CB_EXTERNAL_RESET_TIMEOUT || '120000'),
  name: 'ApplicationExternalServiceBreaker'
};

// Create circuit breakers
const simpleQueryBreaker = new CircuitBreaker(async (fn) => fn(), simpleQueryBreakerOptions);
const mediumQueryBreaker = new CircuitBreaker(async (fn) => fn(), mediumQueryBreakerOptions);
const writeOperationBreaker = new CircuitBreaker(async (fn) => fn(), writeOperationBreakerOptions);
const externalServiceBreaker = new CircuitBreaker(async (fn) => fn(), externalServiceBreakerOptions);

// Event handlers for all breakers
const breakers = [
  { name: 'Simple', breaker: simpleQueryBreaker },
  { name: 'Medium', breaker: mediumQueryBreaker },
  { name: 'Write', breaker: writeOperationBreaker },
  { name: 'External', breaker: externalServiceBreaker }
];

breakers.forEach(({ name, breaker }) => {
  breaker.on('open', () => {
    logger.warn(`[Circuit Breaker ${name}] Circuit opened - requests will fail fast`);
  });

  breaker.on('halfOpen', () => {
    logger.info(`[Circuit Breaker ${name}] Circuit half-open - testing recovery`);
  });

  breaker.on('close', () => {
    logger.info(`[Circuit Breaker ${name}] Circuit closed - normal operation restored`);
  });

  breaker.on('failure', (error) => {
    logger.error(`[Circuit Breaker ${name}] Request failed:`, error.message);
  });

  breaker.on('timeout', () => {
    logger.warn(`[Circuit Breaker ${name}] Request timed out`);
  });

  breaker.on('success', () => {
    logger.debug(`[Circuit Breaker ${name}] Request succeeded`);
  });
});

module.exports = {
  simpleQueryBreaker,
  mediumQueryBreaker,
  writeOperationBreaker,
  externalServiceBreaker
};
