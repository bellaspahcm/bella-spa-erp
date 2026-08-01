import { Specification } from './Specification';

interface TestUser {
  age: number;
  active: boolean;
}

class MinAgeSpecification extends Specification<TestUser> {
  constructor(private readonly minAge: number) {
    super();
  }

  isSatisfiedBy(candidate: TestUser): boolean {
    return candidate.age >= this.minAge;
  }
}

class IsActiveSpecification extends Specification<TestUser> {
  isSatisfiedBy(candidate: TestUser): boolean {
    return candidate.active;
  }
}

describe('Specification', () => {
  const isAdult = new MinAgeSpecification(18);
  const isActive = new IsActiveSpecification();

  it('should satisfy individual specification rules', () => {
    expect(isAdult.isSatisfiedBy({ age: 20, active: true })).toBe(true);
    expect(isAdult.isSatisfiedBy({ age: 15, active: true })).toBe(false);
  });

  it('should support AND logic combining two specs', () => {
    const adultAndActive = isAdult.and(isActive);

    expect(adultAndActive.isSatisfiedBy({ age: 20, active: true })).toBe(true);
    expect(adultAndActive.isSatisfiedBy({ age: 20, active: false })).toBe(false);
    expect(adultAndActive.isSatisfiedBy({ age: 15, active: true })).toBe(false);
  });

  it('should support OR logic combining two specs', () => {
    const adultOrActive = isAdult.or(isActive);

    expect(adultOrActive.isSatisfiedBy({ age: 20, active: false })).toBe(true);
    expect(adultOrActive.isSatisfiedBy({ age: 15, active: true })).toBe(true);
    expect(adultOrActive.isSatisfiedBy({ age: 15, active: false })).toBe(false);
  });

  it('should support NOT logic on specs', () => {
    const isUnderage = isAdult.not();

    expect(isUnderage.isSatisfiedBy({ age: 15, active: true })).toBe(true);
    expect(isUnderage.isSatisfiedBy({ age: 20, active: true })).toBe(false);
  });

  it('should support multi-layered nested compositions', () => {
    // Age >= 18 AND (Active OR Age >= 60)
    const complexSpec = isAdult.and(isActive.or(new MinAgeSpecification(60)));

    expect(complexSpec.isSatisfiedBy({ age: 65, active: false })).toBe(true);
    expect(complexSpec.isSatisfiedBy({ age: 20, active: true })).toBe(true);
    expect(complexSpec.isSatisfiedBy({ age: 15, active: true })).toBe(false);
  });
});
