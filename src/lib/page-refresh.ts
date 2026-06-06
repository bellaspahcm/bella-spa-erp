export const BELLA_PAGE_REFRESH_EVENT = 'bella:refresh-page';

export type BellaPageRefreshSource = 'mobile-header' | 'page-toolbar';

export type BellaPageRefreshEventDetail = {
  handled: boolean;
  source: BellaPageRefreshSource;
  done?: Promise<void>;
};

export type BellaPageRefreshEvent = CustomEvent<BellaPageRefreshEventDetail>;

export function createPageRefreshEvent(source: BellaPageRefreshSource): BellaPageRefreshEvent {
  return new CustomEvent<BellaPageRefreshEventDetail>(BELLA_PAGE_REFRESH_EVENT, {
    detail: {
      handled: false,
      source,
    },
  });
}
