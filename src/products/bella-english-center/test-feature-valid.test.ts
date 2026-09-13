// Test Case 2: Valid single-scope test
import { testFeatureValid, validateTestFeature } from './test-feature-valid';

describe('Test Feature Valid', () => {
  it('should be true', () => {
    expect(testFeatureValid).toBe(true);
  });

  it('should validate correctly', () => {
    expect(validateTestFeature()).toBe(true);
  });
});
