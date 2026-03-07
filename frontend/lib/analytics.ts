// Analytics tracking helpers
declare global {
  interface Window {
    gtag: (command: string, targetId: string, config?: Record<string, unknown>) => void;
  }
}

export const analytics = {
  // Track property searches
  trackSearch: (params: {
    city?: string;
    zipCode?: string;
    beds?: number;
    maxPrice?: number;
    propertyType?: string;
  }) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'search', {
        search_term: params.city || params.zipCode || '',
        custom_map: params
      });
    }
  },

  // Track property view
  trackPropertyView: (propertyId: number) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'view_item', {
        item_id: propertyId.toString()
      });
    }
  },

  // Track property comparison
  trackCompare: (propertyIds: number[]) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'compare_properties', {
        items_count: propertyIds.length
      });
    }
  },

  // Track site navigation
  trackPageView: (url: string) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('config', 'G-XXXXXXXXXX', {
        page_location: url
      });
    }
  }
};