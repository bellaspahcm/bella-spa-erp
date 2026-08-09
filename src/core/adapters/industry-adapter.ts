/**
 * Bella Platform Generic Industry Adapter Interfaces
 * 
 * These interfaces define standard mapping capabilities for industry-specific
 * presentation views, ensuring single responsibility (SOLID) and complete
 * decoupling of the core Platform calculations from vertical-specific representations.
 */

export interface IndustryAdapter<TSource, TTarget> {
  map(source: TSource): TTarget;
}

export type IndustryFinanceAdapter<TDto, TVm> = IndustryAdapter<TDto, TVm>;
export type IndustryPayrollAdapter<TDto, TVm> = IndustryAdapter<TDto, TVm>;
export type IndustryAccountingAdapter<TDto, TVm> = IndustryAdapter<TDto, TVm>;
export type IndustryReportingAdapter<TDto, TVm> = IndustryAdapter<TDto, TVm>;
