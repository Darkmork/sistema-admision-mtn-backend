const axios = require('axios');
const logger = require('./utils/logger');

// Service health check configuration
const services = [
  { name: 'Gateway', url: 'http://localhost:8080/gateway/status' },
  { name: 'User Service', url: 'http://localhost:8082/health' },
  { name: 'Application Service', url: 'http://localhost:8083/health' },
  { name: 'Evaluation Service', url: 'http://localhost:8084/health' },
  { name: 'Notification Service', url: 'http://localhost:8085/health' },
  { name: 'Dashboard Service', url: 'http://localhost:8086/health' },
  { name: 'Guardian Service', url: 'http://localhost:8087/health' }
];

/**
 * Check health of a single service
 */
async function checkService(service) {
  try {
    const startTime = Date.now();
    const response = await axios.get(service.url, {
      timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000', 10)
    });
    const responseTime = Date.now() - startTime;

    return {
      name: service.name,
      status: 'healthy',
      statusCode: response.status,
      responseTime: `${responseTime}ms`,
      data: response.data
    };
  } catch (error) {
    return {
      name: service.name,
      status: 'unhealthy',
      statusCode: error.response?.status || 0,
      error: error.message
    };
  }
}

/**
 * Check health of all services
 */
async function checkAllServices() {
  console.log('\n🏥 Health Check - Sistema de Admisión MTN\n');
  console.log('═'.repeat(80));

  const results = await Promise.all(services.map(checkService));

  const healthy = results.filter(r => r.status === 'healthy').length;
  const unhealthy = results.filter(r => r.status === 'unhealthy').length;

  results.forEach(result => {
    const icon = result.status === 'healthy' ? '✅' : '❌';
    const statusText = result.status === 'healthy'
      ? `${result.statusCode} (${result.responseTime})`
      : `${result.statusCode} - ${result.error}`;

    console.log(`${icon} ${result.name.padEnd(25)} ${statusText}`);
  });

  console.log('═'.repeat(80));
  console.log(`\n📊 Summary: ${healthy}/${services.length} services healthy`);

  if (unhealthy > 0) {
    console.log(`⚠️  Warning: ${unhealthy} service(s) unhealthy\n`);
    process.exit(1);
  } else {
    console.log('✅ All services are healthy\n');
    process.exit(0);
  }
}

/**
 * Continuous monitoring mode
 */
async function monitorServices() {
  const interval = parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000', 10);

  console.log(`\n🔄 Starting continuous monitoring (interval: ${interval}ms)\n`);

  setInterval(async () => {
    const timestamp = new Date().toISOString();
    console.log(`\n[${timestamp}] Health Check:`);

    const results = await Promise.all(services.map(checkService));
    const healthy = results.filter(r => r.status === 'healthy').length;
    const unhealthy = results.filter(r => r.status === 'unhealthy').length;

    results.forEach(result => {
      const icon = result.status === 'healthy' ? '✅' : '❌';
      console.log(`  ${icon} ${result.name}: ${result.status}`);

      if (result.status === 'unhealthy') {
        logger.error(`Service ${result.name} is unhealthy:`, result.error);
      }
    });

    console.log(`  📊 ${healthy}/${services.length} healthy\n`);
  }, interval);
}

// Main execution
const args = process.argv.slice(2);

if (args.includes('--monitor') || args.includes('-m')) {
  monitorServices();
} else {
  checkAllServices();
}
