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

export interface IndustryFinanceAdapter<TDto, TVm> extends IndustryAdapter<TDto, TVm> {}
export interface IndustryPayrollAdapter<TDto, TVm> extends IndustryAdapter<TDto, TVm> {}
export interface IndustryAccountingAdapter<TDto, TVm> extends IndustryAdapter<TDto, TVm> {}
export interface IndustryReportingAdapter<TDto, TVm> extends IndustryAdapter<TDto, TVm> {}
