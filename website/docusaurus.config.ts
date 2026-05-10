import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Portage',
  tagline: 'AI-powered inventory and multi-marketplace seller platform',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://sdnydude.github.io',
  baseUrl: '/portage/',

  organizationName: 'sdnydude',
  projectName: 'portage',

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/sdnydude/portage/tree/main/website/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Portage',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          type: 'docSidebar',
          sidebarId: 'apiSidebar',
          position: 'left',
          label: 'API Reference',
        },
        {
          href: 'https://github.com/sdnydude/portage',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            { label: 'Getting Started', to: '/docs/getting-started' },
            { label: 'Architecture', to: '/docs/architecture/overview' },
            { label: 'Deployment', to: '/docs/deployment' },
          ],
        },
        {
          title: 'API',
          items: [
            { label: 'Authentication', to: '/docs/api/authentication' },
            { label: 'Items', to: '/docs/api/items' },
            { label: 'Listings', to: '/docs/api/listings' },
          ],
        },
        {
          title: 'Links',
          items: [
            { label: 'GitHub', href: 'https://github.com/sdnydude/portage' },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Digital Harmony Group. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'typescript'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
