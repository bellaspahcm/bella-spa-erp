import { Specification } from '@/platform/specification/specification';
import { ProductCatalogAggregate } from './ProductCatalogAggregate';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class LegalApprovalSpecification extends Specification<ProductCatalogAggregate> {
  public isSatisfiedBy(candidate: ProductCatalogAggregate): boolean {
    const docs = candidate.metadata?.legalDocuments;
    if (!isRecord(docs)) return false;

    // Must have redBookApproved and constructionPermitApproved marked true
    return docs.redBookApproved === true && docs.constructionPermitApproved === true;
  }
}
