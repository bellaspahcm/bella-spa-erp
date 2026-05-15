import { getFinancialOverview, getMonthlyPnL, getServicePerformance } from '../src/services/finance-actions';

async function debugFinance() {
  console.log('Testing getFinancialOverview...');
  try {
    const overview = await getFinancialOverview();
    console.log('Overview success:', !!overview);
  } catch (err) {
    console.error('Overview failed:', err);
  }

  console.log('Testing getMonthlyPnL...');
  try {
    const pnl = await getMonthlyPnL();
    console.log('PnL success:', !!pnl);
  } catch (err) {
    console.error('PnL failed:', err);
  }

  console.log('Testing getServicePerformance...');
  try {
    const perf = await getServicePerformance();
    console.log('Performance success:', !!perf);
  } catch (err) {
    console.error('Performance failed:', err);
  }
}

debugFinance();
