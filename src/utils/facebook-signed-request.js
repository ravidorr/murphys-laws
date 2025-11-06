/**
 * Facebook Signed Request Verification Utility
 *
 * This module provides functionality to verify and parse Facebook's signed requests
 * used in data deletion callbacks and other Facebook app integrations.
 *
 * @see https://developers.facebook.com/docs/games/gamesonfacebook/login#parsingsr
 */

import crypto from 'node:crypto';

/**
 * Parses and verifies a Facebook signed request
 *
 * Facebook signed requests come in the format: encoded_signature.encoded_payload
 * Both parts are base64url encoded.
 *
 * @param {string} signedRequest - The signed request string from Facebook
 * @param {string} appSecret - Your Facebook app secret
 * @returns {Object|null} The decoded payload if valid, null if invalid
 */
export function parseSignedRequest(signedRequest, appSecret) {
  if (!signedRequest || typeof signedRequest !== 'string') {
    return null;
  }

  if (!appSecret || typeof appSecret !== 'string') {
    throw new Error('Facebook app secret is required');
  }

  // Split the signed request into signature and payload
  const [encodedSignature, encodedPayload] = signedRequest.split('.', 2);

  if (!encodedSignature || !encodedPayload) {
    return null;
  }

  try {
    // Decode the payload
    const payload = JSON.parse(base64UrlDecode(encodedPayload));

    // Verify the algorithm
    if (!payload.algorithm || payload.algorithm.toUpperCase() !== 'HMAC-SHA256') {
      console.error('Invalid algorithm in signed request:', payload.algorithm);
      return null;
    }

    // Compute expected signature
    const expectedSignature = crypto
      .createHmac('sha256', appSecret)
      .update(encodedPayload)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    // Decode the received signature
    const receivedSignature = encodedSignature
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    // Compare signatures using timing-safe comparison
    if (!crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(receivedSignature)
    )) {
      console.error('Signature verification failed');
      return null;
    }

    return payload;
  } catch (error) {
    console.error('Error parsing signed request:', error.message);
    return null;
  }
}

/**
 * Decodes a base64url encoded string
 *
 * @param {string} str - The base64url encoded string
 * @returns {string} The decoded string
 */
function base64UrlDecode(str) {
  // Convert base64url to base64
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');

  // Add padding if needed
  const padding = base64.length % 4;
  if (padding) {
    base64 += '='.repeat(4 - padding);
  }

  // Decode from base64
  return Buffer.from(base64, 'base64').toString('utf-8');
}

/**
 * Generates a unique confirmation code for deletion requests
 *
 * @param {string} facebookUserId - The Facebook user ID
 * @returns {string} A unique confirmation code
 */
export function generateConfirmationCode(facebookUserId) {
  const timestamp = Date.now();
  const randomBytes = crypto.randomBytes(8).toString('hex');
  return `DEL_${facebookUserId}_${timestamp}_${randomBytes}`;
}
