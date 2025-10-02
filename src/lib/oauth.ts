/**
 * OAuth utility functions for handling Base64URL encoding/decoding
 */

/**
 * Convert a Base64URL encoded string to an object
 * @param str Base64URL encoded string
 * @returns Decoded object or null if parsing fails
 */
export const fromBase64Url = (str: string): any => {
  try {
    const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
};

/**
 * Convert an object to a Base64URL encoded string
 * @param obj Object to encode
 * @returns Base64URL encoded string
 */
export const toBase64Url = (obj: any): string => {
  const json = JSON.stringify(obj);
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};