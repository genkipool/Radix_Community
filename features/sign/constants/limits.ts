/**
 * Hard limits for the signing feature. These are defence-in-depth: the file
 * never leaves the browser, but we still cap size to avoid a tab running out
 * of memory while hashing, and cap the certificate size the API will accept.
 */

/** Max original-file size we will read into memory to hash (50 MiB). */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

/**
 * Max size of a certificate JSON the verify endpoint will accept (256 KiB).
 * A trusted timestamp token carries the authority's whole certificate chain and
 * runs to a few KiB per signature, so the old 64 KiB ceiling would have turned
 * a well-evidenced multi-party certificate into an unverifiable one.
 */
export const MAX_ENVELOPE_BYTES = 256 * 1024;

/** Certificate file suffix appended to the original name. */
export const CERT_SUFFIX = '.radixsig.json';

/** Metadata name given to the on-chain attestation NFT resource. */
export const ATTESTATION_RESOURCE_NAME = 'Radix Document Attestation';
