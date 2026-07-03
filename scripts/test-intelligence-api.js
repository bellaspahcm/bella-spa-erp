/**
 * Test Intelligence API endpoints to diagnose errors
 * Usage: node scripts/test-intelligence-api.js
 */

const TENANT_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6'; // Replace with actual tenant ID
const BASE_URL = 'http://localhost:3000';
const PERIOD = 'month';

async function testEndpoint(name, url) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing: ${name}`);
  console.log(`URL: ${url}`);
  console.log('='.repeat(80));

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (response.ok) {
      console.log('✅ SUCCESS');
      console.log('Response:', JSON.stringify(data, null, 2));
    } else {
      console.log('❌ ERROR');
      console.log('Status:', response.status);
      console.log('Error:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.log('❌ FETCH ERROR');
    console.error('Error:', error.message);
  }
}

async function main() {
  console.log('Testing Executive Intelligence APIs...\n');
  console.log(`Tenant ID: ${TENANT_ID}`);
  console.log(`Period: ${PERIOD}\n`);

  const endpoints = [
    {
      name: 'Monthly Revenue Summary',
      url: `${BASE_URL}/api/intelligence/executive/monthly-revenue-summary?tenantId=${TENANT_ID}&period=${PERIOD}`,
    },
    {
      name: 'Operational Efficiency',
      url: `${BASE_URL}/api/intelligence/executive/operational-efficiency?tenantId=${TENANT_ID}&period=${PERIOD}`,
    },
    {
      name: 'Customer Metrics',
      url: `${BASE_URL}/api/intelligence/executive/customer-metrics?tenantId=${TENANT_ID}&period=${PERIOD}`,
    },
    {
      name: 'Financial Health',
      url: `${BASE_URL}/api/intelligence/executive/financial-health?tenantId=${TENANT_ID}&period=${PERIOD}`,
    },
    {
      name: 'Growth Indicators',
      url: `${BASE_URL}/api/intelligence/executive/growth-indicators?tenantId=${TENANT_ID}&period=${PERIOD}`,
    },
  ];

  for (const endpoint of endpoints) {
    await testEndpoint(endpoint.name, endpoint.url);
    await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms between requests
  }

  console.log('\n\nTest completed!');
}

main();
