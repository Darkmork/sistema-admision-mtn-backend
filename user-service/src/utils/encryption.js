const crypto = require('crypto');

// ============= CREDENTIAL ENCRYPTION - RSA + AES HYBRID =============
// RSA-2048 key pair for encrypting credentials in transit
// Keys rotate every 24 hours for enhanced security

const KEY_ROTATION_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
let rsaKeyPair = null;
let keyRotationTime = null;

/**
 * Generate RSA-2048 key pair for credential encryption
 * @returns {Object} { publicKey, privateKey }
 */
function generateRSAKeyPair() {
  console.log('[Encryption] Generating new RSA-2048 key pair...');

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  keyRotationTime = Date.now();
  console.log('[Encryption] RSA key pair generated successfully');

  return { publicKey, privateKey };
}

/**
 * Initialize RSA keys on module load
 */
function initializeKeys() {
  rsaKeyPair = generateRSAKeyPair();

  // Rotate keys every 24 hours
  setInterval(() => {
    const oldKeyCount = rsaKeyPair ? 1 : 0;
    rsaKeyPair = generateRSAKeyPair();
    console.log(`[Encryption] Keys rotated. Previous keys: ${oldKeyCount}`);
  }, KEY_ROTATION_INTERVAL);
}

/**
 * Get current public key for client-side encryption
 * @returns {Object} { publicKey, keyId, expiresIn }
 */
function getPublicKeyInfo() {
  if (!rsaKeyPair || !rsaKeyPair.publicKey) {
    throw new Error('Encryption keys not initialized');
  }

  const keyAge = Date.now() - keyRotationTime;
  const timeUntilRotation = KEY_ROTATION_INTERVAL - keyAge;

  return {
    publicKey: rsaKeyPair.publicKey,
    keyId: keyRotationTime.toString(),
    algorithm: 'RSA-OAEP',
    keySize: 2048,
    hash: 'SHA-256',
    expiresIn: Math.floor(timeUntilRotation / 1000) // seconds
  };
}

/**
 * Decrypt credentials using RSA + AES hybrid encryption
 * @param {Object} encryptedPayload - { encryptedData, encryptedKey, iv, authTag }
 * @returns {Object} Decrypted credentials
 */
function decryptCredentials(encryptedPayload) {
  const { encryptedData, encryptedKey, iv, authTag } = encryptedPayload;

  // Validate all required fields
  if (!encryptedData || !encryptedKey || !iv || !authTag) {
    throw new Error('Invalid encrypted payload: missing required fields');
  }

  // Step 1: Decrypt AES key with RSA private key
  const aesKey = crypto.privateDecrypt(
    {
      key: rsaKeyPair.privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    },
    Buffer.from(encryptedKey, 'base64')
  );

  // Step 2: Decrypt credentials with AES-256-GCM
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    aesKey,
    Buffer.from(iv, 'base64')
  );

  decipher.setAuthTag(Buffer.from(authTag, 'base64'));

  let decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedData, 'base64')),
    decipher.final()
  ]);

  // Parse and return decrypted credentials
  return JSON.parse(decrypted.toString('utf8'));
}

/**
 * Express middleware to decrypt incoming credentials
 * Supports both encrypted and plain text for backward compatibility
 */
function decryptCredentialsMiddleware(req, res, next) {
  // Skip decryption if request is not encrypted (backward compatibility)
  if (!req.body.encryptedData || !req.body.encryptedKey) {
    console.log('[Encryption] Plain text credentials detected (backward compatibility mode)');
    return next();
  }

  try {
    console.log('[Encryption] Encrypted credentials detected, decrypting...');

    // Decrypt and replace request body
    const decryptedCredentials = decryptCredentials(req.body);
    req.body = decryptedCredentials;

    console.log('[Encryption] Credentials decrypted successfully');
    next();

  } catch (error) {
    console.error('[Encryption] Decryption failed:', error.message);

    // Rate limiting: Log suspicious decryption attempts
    // In production, implement IP-based rate limiting here

    return res.status(400).json({
      success: false,
      error: 'Credential decryption failed',
      code: 'ENCRYPTION_DECRYPTION_FAILED',
      message: 'The provided encrypted data could not be decrypted. Please refresh and try again.'
    });
  }
}

// Initialize keys on module load
initializeKeys();

module.exports = {
  generateRSAKeyPair,
  getPublicKeyInfo,
  decryptCredentials,
  decryptCredentialsMiddleware,
  // Export for testing/debugging
  _getKeyRotationTime: () => keyRotationTime,
  _getRsaKeyPair: () => rsaKeyPair
};
