const CircuitBreaker = require('opossum');

/**
 * Shared Circuit Breaker Factory
 *
 * Creates differentiated circuit breakers for database operations:
 * - Simple: Fast lookups (2s timeout, 60% threshold)
 * - Medium: Standard queries with joins (5s timeout, 50% threshold) - DEFAULT
 * - Write: Critical data mutations (3s timeout, 30% threshold - more strict)
 *
 * @param {string} serviceName - Name of the service for logging
 * @param {Object} customOptions - Optional custom thresholds per breaker type
 */

const createCircuitBreakers = (serviceName, customOptions = {}) => {
  const defaultOptions = {
    simple: {
      timeout: 2000,
      errorThresholdPercentage: 60,
      resetTimeout: 20000,
      rollingCountTimeout: 10000,
      rollingCountBuckets: 10,
      name: `${serviceName}SimpleQueryBreaker`
    },
    medium: {
      timeout: 5000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
      rollingCountTimeout: 10000,
      rollingCountBuckets: 10,
      name: `${serviceName}MediumQueryBreaker`
    },
    write: {
      timeout: 3000,
      errorThresholdPercentage: 30,
      resetTimeout: 45000,
      rollingCountTimeout: 10000,
      rollingCountBuckets: 10,
      name: `${serviceName}WriteBreaker`
    }
  };

  // Merge custom options
  const options = {
    simple: { ...defaultOptions.simple, ...customOptions.simple },
    medium: { ...defaultOptions.medium, ...customOptions.medium },
    write: { ...defaultOptions.write, ...customOptions.write }
  };

  // Setup event listeners for a circuit breaker
  const setupBreakerEvents = (breaker, name) => {
    breaker.on('open', () => {
      console.error(`⚠️  [Circuit Breaker ${name}] OPEN - Too many failures (${breaker.options.errorThresholdPercentage}% threshold exceeded)`);
    });

    breaker.on('halfOpen', () => {
      console.warn(`🔄 [Circuit Breaker ${name}] HALF-OPEN - Testing recovery`);
    });

    breaker.on('close', () => {
      console.log(`✅ [Circuit Breaker ${name}] CLOSED - Service recovered`);
    });

    breaker.on('fallback', () => {
      console.warn(`🔀 [Circuit Breaker ${name}] FALLBACK triggered`);
    });

    breaker.fallback(() => {
      throw new Error(`Service temporarily unavailable - ${name} circuit breaker open`);
    });

    // Success/failure metrics
    breaker.on('success', () => {
      // Optional: Track success metrics
    });

    breaker.on('failure', (error) => {
      console.error(`❌ [Circuit Breaker ${name}] Operation failed:`, error.message);
    });

    breaker.on('timeout', () => {
      console.error(`⏱️  [Circuit Breaker ${name}] Operation timed out (${breaker.options.timeout}ms)`);
    });
  };

  // Create circuit breakers
  const simpleQueryBreaker = new CircuitBreaker(
    async (client, query, params) => await client.query(query, params),
    options.simple
  );

  const mediumQueryBreaker = new CircuitBreaker(
    async (client, query, params) => await client.query(query, params),
    options.medium
  );

  const writeOperationBreaker = new CircuitBreaker(
    async (client, query, params) => await client.query(query, params),
    options.write
  );

  // Setup events
  setupBreakerEvents(simpleQueryBreaker, options.simple.name);
  setupBreakerEvents(mediumQueryBreaker, options.medium.name);
  setupBreakerEvents(writeOperationBreaker, options.write.name);

  console.log(`✅ [${serviceName}] Circuit breakers initialized:`);
  console.log(`   - Simple: ${options.simple.timeout}ms timeout, ${options.simple.errorThresholdPercentage}% threshold`);
  console.log(`   - Medium: ${options.medium.timeout}ms timeout, ${options.medium.errorThresholdPercentage}% threshold`);
  console.log(`   - Write: ${options.write.timeout}ms timeout, ${options.write.errorThresholdPercentage}% threshold`);

  return {
    simpleQueryBreaker,
    mediumQueryBreaker,
    writeOperationBreaker
  };
};

/**
 * Get circuit breaker stats for monitoring
 */
const getBreakerStats = (breaker) => {
  return {
    name: breaker.name,
    state: breaker.opened ? 'OPEN' : breaker.halfOpen ? 'HALF-OPEN' : 'CLOSED',
    stats: breaker.stats
  };
};

module.exports = {
  createCircuitBreakers,
  getBreakerStats
};
