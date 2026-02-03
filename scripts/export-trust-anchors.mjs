#!/usr/bin/env node
/**
 * Export Trust Anchors
 * 
 * Generates trust anchors bundle for 3rd-party verification.
 * 
 * Usage:
 *   node scripts/export-trust-anchors.mjs --org "Papa App Inc."
 *   node scripts/export-trust-anchors.mjs --keys-only
 *   node scripts/export-trust-anchors.mjs --list
 */
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Export Trust Anchors

Generates cryptographic trust anchors for 3rd-party verification.

Usage:
  node scripts/export-trust-anchors.mjs --org "Papa App Inc."
  node scripts/export-trust-anchors.mjs --keys-only
  node scripts/export-trust-anchors.mjs --list

Options:
  --org         Organization name for the bundle
  --keys-only   Export only public keys (minimal format)
  --list        List existing trust anchor bundles
  --output      Custom output path (default: workspace/00_SYSTEM/trust-anchors/)
`);
    process.exit(0);
  }
  
  // Set WORKSPACE_ROOT if not set
  if (!process.env.WORKSPACE_ROOT) {
    process.env.WORKSPACE_ROOT = join(__dirname, '..', 'workspace');
  }
  
  try {
    const { 
      exportTrustAnchors, 
      exportPublicKeysOnly, 
      listTrustAnchorsBundles 
    } = await import('../lib/trust-anchors-service.js');
    
    if (args.includes('--list')) {
      const bundles = listTrustAnchorsBundles();
      console.log('[trust-anchors] Listing bundles...');
      console.log(JSON.stringify(bundles, null, 2));
      process.exit(0);
    }
    
    if (args.includes('--keys-only')) {
      console.log('[trust-anchors] Exporting public keys only...');
      const keysExport = exportPublicKeysOnly();
      console.log(JSON.stringify(keysExport, null, 2));
      process.exit(0);
    }
    
    const orgIdx = args.indexOf('--org');
    const organization = orgIdx >= 0 ? args[orgIdx + 1] : 'Papa App';
    
    console.log(`[trust-anchors] Generating trust anchors bundle for "${organization}"...`);
    
    const { filepath, bundle } = exportTrustAnchors(organization);
    
    console.log(`[trust-anchors] ✅ Trust anchors exported to: ${filepath}`);
    console.log(`[trust-anchors] Bundle ID: ${bundle.bundle_id}`);
    console.log(`[trust-anchors] Keys: ${bundle.keys.length}`);
    console.log(`[trust-anchors] Policies: ${bundle.policies.length}`);
    console.log(`[trust-anchors] Attestations: ${bundle.attestations.length}`);
    console.log(`[trust-anchors] Bundle hash: ${bundle.bundle_hash.slice(0, 16)}...`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('[trust-anchors] Error:', error.message);
    if (error.message.includes('Cannot find module')) {
      console.error('[trust-anchors] Note: Run `npm run build` first to compile TypeScript files.');
    }
    process.exit(1);
  }
}

main();
