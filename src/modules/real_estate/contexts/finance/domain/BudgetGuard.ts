export interface BudgetProps {
  readonly projectId: string;
  readonly category: 'marketing' | 'construction' | 'operations';
  readonly allocatedCap: number;
  spentAmount: number;
}

export class BudgetGuard {
  constructor(private readonly budget: BudgetProps) {
    if (budget.allocatedCap <= 0) throw new Error('Allocated budget cap must be greater than zero');
    if (budget.spentAmount < 0) throw new Error('Spent budget amount cannot be negative');
  }

  public get projectId(): string {
    return this.budget.projectId;
  }

  public get category(): string {
    return this.budget.category;
  }

  public get allocatedCap(): number {
    return this.budget.allocatedCap;
  }

  public get spentAmount(): number {
    return this.budget.spentAmount;
  }

  /**
   * Check if a proposed expense would exceed the cap and throws an error if it does
   */
  public verifyExpense(amount: number): void {
    if (amount <= 0) {
      throw new Error('Expense amount must be greater than zero');
    }
    if (this.budget.spentAmount + amount > this.budget.allocatedCap) {
      throw new Error(
        `Budget limit exceeded. Allocated: ${this.budget.allocatedCap.toLocaleString()} VND. Proposed total: ${(
          this.budget.spentAmount + amount
        ).toLocaleString()} VND.`
      );
    }
  }

  /**
   * Record the expense after check passes
   */
  public recordExpense(amount: number): void {
    this.verifyExpense(amount);
    this.budget.spentAmount += amount;
  }
}
