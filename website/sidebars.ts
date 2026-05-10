import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'getting-started',
    {
      type: 'category',
      label: 'Architecture',
      items: ['architecture/overview', 'architecture/database', 'architecture/ai-pipeline', 'architecture/marketplace-adapters'],
    },
    {
      type: 'category',
      label: 'Frontend',
      items: ['frontend/app-structure', 'frontend/design-system', 'frontend/listing-flow', 'frontend/scan-flow'],
    },
    {
      type: 'category',
      label: 'Operations',
      items: ['deployment', 'environment-variables', 'monitoring'],
    },
    {
      type: 'category',
      label: 'Development',
      items: ['development/history', 'development/memory-system'],
    },
  ],
  apiSidebar: [
    'api/overview',
    'api/authentication',
    {
      type: 'category',
      label: 'Endpoints',
      items: [
        'api/items',
        'api/images',
        'api/scan',
        'api/listings',
        'api/orders',
        'api/drafts',
        'api/shipping',
        'api/marketplace',
        'api/porter',
        'api/admin',
      ],
    },
    'api/error-handling',
  ],
};

export default sidebars;
