#!/usr/bin/env node
/**
 * Generate Compliance Attestation
 * 
 * Creates signed attestation statements for compliance periods.
 * 
 * Usage:
 *   node scripts/generate-attestation.mjs --type quarterly --quarter Q1 --year 2026
 *   node scripts/generate-attestation.mjs --type annual --year 2026
 *   node scripts/generate-attestation.mjs --type ad_hoc --from 2026-01-01 --to 2026-01-31
 *   node scripts/generate-attestation.mjs --list
 */
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Dynamic import to avoid TS compilation issues
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Generate Compliance Attestation

Usage:
  node scripts/generate-attestation.mjs --type quarterly --quarter Q1 --year 2026
  node scripts/generate-attestation.mjs --type annual --year 2026
  node scripts/generate-attestation.mjs --type ad_hoc --from 2026-01-01 --to 2026-01-31
  node scripts/generate-attestation.mjs --list

Options:
  --type        Attestation type: quarterly, annual, ad_hoc
  --quarter     Quarter (Q1, Q2, Q3, Q4) for quarterly type
  --year        Year (e.g., 2026)
  --from        Start date for ad_hoc (ISO format)
  --to          End date for ad_hoc (ISO format)
  --attester    Attester user ID (default: system)
  --org         Organization name (default: Papa App)
  --list        List existing attestations
  --dry-run     Show what would be generated without saving
`);
    process.exit(0);
  }
  
  // Set WORKSPACE_ROOT if not set
  if (!process.env.WORKSPACE_ROOT) {
    process.env.WORKSPACE_ROOT = join(__dirname, '..', 'workspace');
  }
  
  try {
    // Dynamic import of the service
    const { 
      generateQuarterlyAttestation, 
      generateAnnualAttestation,
      generateAttestation,
      saveAttestation,
      listAttestations 
    } = await import('../lib/attestation-service.js');
    
    if (args.includes('--list')) {
      const attestations = listAttestations();
      console.log('[attestation] Listing attestations...');
      console.log(JSON.stringify(attestations, null, 2));
      process.exit(0);
    }
    
    const typeIdx = args.indexOf('--type');
    const type = typeIdx >= 0 ? args[typeIdx + 1] : null;
    
    const yearIdx = args.indexOf('--year');
    const year = yearIdx >= 0 ? parseInt(args[yearIdx + 1], 10) : new Date().getFullYear();
    
    const attesterIdx = args.indexOf('--attester');
    const attesterUserId = attesterIdx >= 0 ? args[attesterIdx + 1] : 'system';
    
    const orgIdx = args.indexOf('--org');
    const organization = orgIdx >= 0 ? args[orgIdx + 1] : 'Papa App';
    
    const dryRun = args.includes('--dry-run');
    
    const attester = {
      role: 'Compliance Officer',
      user_id: attesterUserId,
      organization,
    };
    
    let filepath;
    
    if (type === 'quarterly') {
      const quarterIdx = args.indexOf('--quarter');
      const quarterStr = quarterIdx >= 0 ? args[quarterIdx + 1] : 'Q1';
      const quarter = parseInt(quarterStr.replace('Q', ''), 10);
      
      if (quarter < 1 || quarter > 4) {
        console.error('[attestation] Invalid quarter. Use Q1, Q2, Q3, or Q4.');
        process.exit(1);
      }
      
      console.log(`[attestation] Generating quarterly attestation for Q${quarter} ${year}...`);
      
      if (dryRun) {
        console.log('[attestation] Dry run - no file saved.');
        process.exit(0);
      }
      
      filepath = generateQuarterlyAttestation(year, quarter, attester);
      
    } else if (type === 'annual') {
      console.log(`[attestation] Generating annual attestation for FY ${year}...`);
      
      if (dryRun) {
        console.log('[attestation] Dry run - no file saved.');
        process.exit(0);
      }
      
      filepath = generateAnnualAttestation(year, attester);
      
    } else if (type === 'ad_hoc') {
      const fromIdx = args.indexOf('--from');
      const toIdx = args.indexOf('--to');
      
      const from = fromIdx >= 0 ? args[fromIdx + 1] : null;
      const to = toIdx >= 0 ? args[toIdx + 1] : null;
      
      if (!from || !to) {
        console.error('[attestation] --from and --to are required for ad_hoc type.');
        process.exit(1);
      }
      
      console.log(`[attestation] Generating ad-hoc attestation from ${from} to ${to}...`);
      
      if (dryRun) {
        console.log('[attestation] Dry run - no file saved.');
        process.exit(0);
      }
      
      const period = {
        from: new Date(from).toISOString(),
        to: new Date(to + 'T23:59:59.999Z').toISOString(),
        type: 'ad_hoc',
        label: `${from} to ${to}`,
      };
      
      const attestation = generateAttestation({
        period,
        attester,
        scope: `Ad-hoc compliance attestation for ${from} to ${to}`,
      });
      
      filepath = saveAttestation(attestation);
      
    } else {
      console.error('[attestation] Invalid or missing --type. Use quarterly, annual, or ad_hoc.');
      process.exit(1);
    }
    
    console.log(`[attestation] ✅ Attestation saved to: ${filepath}`);
    process.exit(0);
    
  } catch (error) {
    console.error('[attestation] Error:', error.message);
    if (error.message.includes('Cannot find module')) {
      console.error('[attestation] Note: Run `npm run build` first to compile TypeScript files.');
    }
    process.exit(1);
  }
}

main();
