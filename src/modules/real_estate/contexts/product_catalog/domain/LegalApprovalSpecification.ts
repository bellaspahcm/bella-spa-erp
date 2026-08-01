import { Specification } from '@/platform/specification/specification';
import { ProductCatalogAggregate } from './ProductCatalogAggregate';

export class LegalApprovalSpecification extends Specification<ProductCatalogAggregate> {
  public isSatisfiedBy(candidate: ProductCatalogAggregate): boolean {
    const docs = (candidate.metadata as any)?.legalDocuments;
    if (!docs) return false;

    // Must have redBookApproved and constructionPermitApproved marked true
    return docs.redBookApproved === true && docs.constructionPermitApproved === true;
  }
}
