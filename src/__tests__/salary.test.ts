import { calcProRataBaseSalary } from '../services/salary-actions';

describe('calcProRataBaseSalary', () => {
  it('should calculate pro-rata salary correctly for a resignation mid-month (31 days)', async () => {
    const baseSalary = 6000000;
    const resignationDate = new Date('2026-05-15'); // 15 days worked
    const monthYear = new Date('2026-05-01');
    
    const result = await calcProRataBaseSalary(baseSalary, resignationDate, monthYear);
    
    // May has 31 days. 15 / 31 * 6,000,000 = 2,903,225.8... -> Round to 2,903,226
    expect(result).toBe(2903226);
  });

  it('should calculate full salary if resignation is at the end of the month (28 days in Feb)', async () => {
    const baseSalary = 5000000;
    const resignationDate = new Date('2026-02-28');
    const monthYear = new Date('2026-02-01');
    
    const result = await calcProRataBaseSalary(baseSalary, resignationDate, monthYear);
    
    expect(result).toBe(5000000);
  });

  it('should return 0 if resignation date is before the start of the month', async () => {
    const baseSalary = 6000000;
    const resignationDate = new Date('2026-04-30');
    const monthYear = new Date('2026-05-01');
    
    const result = await calcProRataBaseSalary(baseSalary, resignationDate, monthYear);
    
    expect(result).toBe(0);
  });
});
