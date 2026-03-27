/** The structure of the infrastructure section in the i18n dictionary */
export interface InfraPageType {
  hero: {
    brand: string;
    title: string;
    description: string;
  };
  controls: {
    search_placeholder: string;
    expand_all: string;
    collapse_all: string;
    auto_collapse: string;
    results_one: string;
    results_many: string;
    no_results: string;
  };
  layers: Record<string, {
    number: string;
    title: string;
    subtitle: string;
    description: string;
    items: Record<string, {
      title: string;
      description: string;
    }>;
  }>;
}
