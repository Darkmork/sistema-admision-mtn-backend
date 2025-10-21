/**
 * Test script to verify frontend encryption can be decrypted by backend
 * Simulates the Web Crypto API encryption process using Node.js crypto
 */

const crypto = require('crypto');
const axios = require('axios');

// Simulate Web Crypto API encryption using Node.js
async function simulateFrontendEncryption(credentials, publicKeyPem) {
  // Step 1: Generate AES-256 key
  const aesKey = crypto.randomBytes(32); // 256 bits

  // Step 2: Encrypt credentials with AES-256-GCM
  const iv = crypto.randomBytes(12); // 12 bytes for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);

  const credentialsJSON = JSON.stringify(credentials);
  let encryptedData = cipher.update(credentialsJSON, 'utf8');
  encryptedData = Buffer.concat([encryptedData, cipher.final()]);

  const authTag = cipher.getAuthTag(); // 16 bytes

  // Step 3: Encrypt AES key with RSA-OAEP
  const encryptedAESKey = crypto.publicEncrypt(
    {
      key: publicKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    },
    aesKey
  );

  // Step 4: Convert to base64 (like the frontend does)
  return {
    encryptedData: encryptedData.toString('base64'),
    encryptedKey: encryptedAESKey.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64')
  };
}

async function testEncryptionFlow() {
  console.log('=== Testing RSA + AES Encryption Flow ===\n');

  try {
    // Step 1: Fetch public key from backend
    console.log('1. Fetching public key from backend...');
    const keyResponse = await axios.get('http://localhost:8082/api/auth/public-key');

    if (!keyResponse.data.success) {
      throw new Error('Failed to fetch public key');
    }

    const publicKeyInfo = keyResponse.data.data;
    console.log(`   ✅ Public key fetched (RSA-${publicKeyInfo.keySize}, expires in ${publicKeyInfo.expiresIn}s)\n`);

    // Step 2: Prepare test credentials
    const testCredentials = {
      email: 'test.encryption@mtn.cl',
      password: 'TestPassword123!'
    };

    console.log('2. Test credentials:');
    console.log(`   Email: ${testCredentials.email}`);
    console.log(`   Password: ${testCredentials.password}\n`);

    // Step 3: Encrypt credentials (simulating frontend)
    console.log('3. Encrypting credentials with RSA + AES...');
    const encryptedPayload = await simulateFrontendEncryption(
      testCredentials,
      publicKeyInfo.publicKey
    );

    console.log('   ✅ Credentials encrypted');
    console.log(`   - Encrypted data length: ${encryptedPayload.encryptedData.length} chars`);
    console.log(`   - Encrypted key length: ${encryptedPayload.encryptedKey.length} chars`);
    console.log(`   - IV length: ${encryptedPayload.iv.length} chars`);
    console.log(`   - Auth tag length: ${encryptedPayload.authTag.length} chars\n`);

    // Step 4: Send encrypted payload to backend
    console.log('4. Sending encrypted payload to backend...');
    console.log('   POST http://localhost:8082/api/auth/login');

    try {
      const loginResponse = await axios.post(
        'http://localhost:8082/api/auth/login',
        encryptedPayload,
        { timeout: 5000 }
      );

      // Note: Login will fail because user doesn't exist, but that's OK
      // We're testing decryption, not authentication
      console.log('   Response:', loginResponse.status, loginResponse.data);

    } catch (loginError) {
      if (loginError.response) {
        const status = loginError.response.status;
        const data = loginError.response.data;

        if (status === 401 && data.code === 'AUTH_001') {
          // Expected: Invalid credentials (user doesn't exist)
          console.log('   ✅ Decryption successful! Backend decrypted and processed credentials.');
          console.log('   ℹ️  Login failed as expected (user does not exist in DB)');
          console.log(`   Response: ${status} - ${data.error}\n`);

          console.log('=== ✅ ENCRYPTION TEST PASSED ===');
          console.log('Frontend encryption → Backend decryption flow is working correctly!\n');
          return true;

        } else if (status === 400 && data.code === 'ENCRYPTION_DECRYPTION_FAILED') {
          // Decryption failed
          console.log('   ❌ Decryption failed!');
          console.log(`   Response: ${status} - ${data.error}`);
          console.log(`   Message: ${data.message}\n`);

          console.log('=== ❌ ENCRYPTION TEST FAILED ===');
          console.log('Backend could not decrypt the payload.\n');
          return false;

        } else {
          // Other error
          console.log(`   ⚠️  Unexpected response: ${status}`);
          console.log('   Data:', data);
        }
      } else {
        throw loginError;
      }
    }

  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error(error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('\n⚠️  Make sure user-service is running on port 8082');
    }
    return false;
  }
}

// Run the test
testEncryptionFlow()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
