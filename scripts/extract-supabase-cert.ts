#!/usr/bin/env tsx
/**
 * Extract Supabase Server Certificate
 * 
 * Connects to Supabase PostgreSQL server and extracts the SSL certificate chain.
 * Saves to .certs/supabase-ca.pem for DATABASE_CA_CERT configuration.
 */

import { connect } from 'tls';
import { writeFileSync } from 'fs';
import 'dotenv/config';

function extractCertificate() {
  console.log('🔐 Extracting Supabase Certificate\n');

  // Parse DATABASE_EXECUTOR_URL
  const url = process.env.DATABASE_EXECUTOR_URL;
  if (!url) {
    console.error('❌ DATABASE_EXECUTOR_URL not set');
    process.exit(1);
  }

  // Parse connection string
  // Format: postgresql://user:pass@host:port/database
  const match = url.match(/postgresql:\/\/[^@]+@([^:]+):(\d+)\//);
  if (!match) {
    console.error('❌ Cannot parse DATABASE_EXECUTOR_URL');
    console.error('   Expected format: postgresql://user:pass@host:port/database');
    process.exit(1);
  }

  const host = match[1];
  const port = parseInt(match[2], 10);

  console.log(`📡 Connecting to: ${host}:${port}`);
  console.log('   (This will accept any certificate to extract it)\n');

  // Connect with rejectUnauthorized: false ONLY to extract certificate
  const socket = connect({
    host,
    port,
    rejectUnauthorized: false, // Accept any cert to extract it
  });

  socket.on('secureConnect', () => {
    const cert = socket.getPeerCertificate(true);
    
    if (!cert || Object.keys(cert).length === 0) {
      console.error('❌ No certificate received from server');
      socket.end();
      process.exit(1);
    }

    console.log('✅ Certificate received\n');
    console.log('📋 Certificate Info:');
    console.log(`   Subject: ${cert.subject?.CN || 'N/A'}`);
    console.log(`   Issuer: ${cert.issuer?.CN || 'N/A'}`);
    console.log(`   Valid from: ${cert.valid_from}`);
    console.log(`   Valid to: ${cert.valid_to}`);
    console.log(`   Fingerprint: ${cert.fingerprint}\n`);

    // Extract certificate chain
    const certificates: string[] = [];
    let currentCert: any = cert;

    while (currentCert && currentCert.raw) {
      // Convert DER to PEM
      const der = currentCert.raw;
      const pem = 
        '-----BEGIN CERTIFICATE-----\n' +
        der.toString('base64').match(/.{1,64}/g)?.join('\n') +
        '\n-----END CERTIFICATE-----\n';
      
      certificates.push(pem);

      console.log(`📄 Certificate ${certificates.length}:`);
      console.log(`   Subject: ${currentCert.subject?.CN || 'N/A'}`);
      console.log(`   Issuer: ${currentCert.issuer?.CN || 'N/A'}`);

      // Move to issuer certificate
      if (currentCert.issuerCertificate && currentCert.issuerCertificate !== currentCert) {
        currentCert = currentCert.issuerCertificate;
      } else {
        break;
      }
    }

    console.log(`\n✅ Extracted ${certificates.length} certificate(s)\n`);

    // Save to file
    const certChain = certificates.join('\n');
    const outputPath = '.certs/supabase-ca.pem';
    
    try {
      writeFileSync(outputPath, certChain, 'utf8');
      console.log(`✅ Certificate chain saved to: ${outputPath}`);
      console.log(`\n📋 Next steps:`);
      console.log(`   1. Verify .env.local has: DATABASE_CA_CERT=D:\\Antigravity\\Projects\\BELLA SPA ERP\\.certs\\supabase-ca.pem`);
      console.log(`   2. Set environment: $env:DATABASE_CA_CERT="D:\\Antigravity\\Projects\\BELLA SPA ERP\\.certs\\supabase-ca.pem"`);
      console.log(`   3. Run adapter test: npx tsx test/phase4b3/test-direct-adapter.ts`);
      console.log(`   4. Expected: 8/8 PASS`);
    } catch (error) {
      console.error(`❌ Cannot write certificate file: ${error}`);
      process.exit(1);
    }

    socket.end();
    process.exit(0);
  });

  socket.on('error', (error) => {
    console.error(`❌ Connection error: ${error.message}`);
    process.exit(1);
  });

  setTimeout(() => {
    console.error('❌ Connection timeout');
    socket.end();
    process.exit(1);
  }, 10000);
}

extractCertificate();
