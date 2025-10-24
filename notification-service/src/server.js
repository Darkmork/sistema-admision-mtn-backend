const http = require('http');

console.log('🔵 [SIMPLE] Starting notification service (v2)...');

const PORT = process.env.PORT || 8085;

// Import app with error handling
let app;
try {
  console.log('🔵 [SIMPLE] Loading app module...');
  app = require('./app');
  console.log('✅ [SIMPLE] App loaded successfully');
} catch (error) {
  console.error('❌ [SIMPLE] Failed to load app:', error);
  process.exit(1);
}

// Create HTTP server
const server = http.createServer(app);

// Start listening on :: for IPv6 support (Railway private networking)
// :: accepts both IPv4 and IPv6 connections
server.listen(PORT, '::', () => {
  console.log(`✅ [SIMPLE] Notification Service running on port ${PORT}`);
  console.log(`🏥 [SIMPLE] Health check available (listening on :: for IPv4/IPv6)`);
});

// Handle server errors
server.on('error', (error) => {
  console.error('❌ [SIMPLE] Server error:', error);
  process.exit(1);
});

// Basic graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 [SIMPLE] SIGTERM received, closing server...');
  server.close(() => {
    console.log('✅ [SIMPLE] Server closed');
    process.exit(0);
  });
});
