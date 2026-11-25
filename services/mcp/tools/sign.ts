/**
 * Barrel for Radix Seal MCP tools.
 *
 * Modularized under `./sign-parts/`:
 *  - `verify.ts` — `verify_document_signature`, `check_signing_request`
 *  - `audit.ts` — `audit_seal_collection`, `get_seal_account_state`
 *  - `manifests.ts` — `build_seal_manifest`
 */
import {
  auditSealCollectionTool,
  getSealAccountStateTool,
} from './sign-parts/audit';
import { buildSealManifestTool } from './sign-parts/manifests';
import {
  checkSigningRequestTool,
  verifyDocumentSignatureTool,
} from './sign-parts/verify';

export {
  verifyDocumentSignatureTool,
  checkSigningRequestTool,
  auditSealCollectionTool,
  getSealAccountStateTool,
  buildSealManifestTool,
};

export const signTools = [
  verifyDocumentSignatureTool,
  checkSigningRequestTool,
  auditSealCollectionTool,
  getSealAccountStateTool,
  buildSealManifestTool,
];
