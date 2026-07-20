/**
 * Hard limits for the signing feature. These are defence-in-depth: the file
 * never leaves the browser, but we still cap size to avoid a tab running out
 * of memory while hashing, and cap the certificate size the API will accept.
 */

/** Max original-file size we will read into memory to hash (50 MiB). */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

/** Max size of a certificate JSON the verify endpoint will accept (64 KiB). */
export const MAX_ENVELOPE_BYTES = 64 * 1024;

/** Certificate file suffix appended to the original name. */
export const CERT_SUFFIX = '.radixsig.json';

/** Metadata name given to the on-chain attestation NFT resource. */
export const ATTESTATION_RESOURCE_NAME = 'Radix Document Attestation';
