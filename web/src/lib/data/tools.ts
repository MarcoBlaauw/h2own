export type ToolLink = {
  /** Machine readable identifier */
  slug: string;
  /** Display label for the link */
  title: string;
  /** Target href for the tool */
  href: string;
  /** Optional short description shown in menus */
  description?: string;
  /** Optional badge text such as "New" */
  badge?: string;
};

export type ToolCategory = {
  /** Machine readable identifier */
  slug: string;
  /** Human readable category label */
  title: string;
  /** Short helper copy for the category */
  description?: string;
  /** Collection of tools that belong to the category */
  links: ToolLink[];
};

/**
 * Structured catalogue of tools surfaced in navigation menus and quick actions.
 * Keeping this centralised ensures the header menu and front page stay in sync.
 */
export const toolCategories: ToolCategory[] = [
  {
    slug: 'dns',
    title: 'DNS',
    description: 'Domain health and resolver diagnostics',
    links: [
      {
        slug: 'propagation-checker',
        title: 'DNS Propagation Checker',
        href: '/tools/dns/propagation-checker',
        description: 'Track DNS record changes across global resolvers in near real-time.',
        badge: 'New',
      },
      {
        slug: 'dnssec-sanity-check',
        title: 'DNSSEC Sanity Check',
        href: '/tools/dns/dnssec-sanity-check',
        description: 'Validate DNSSEC chains of trust and spot signing or rollover issues.',
        badge: 'New',
      },
      {
        slug: 'record-lookup',
        title: 'DNS Record Lookup',
        href: '/tools/dns/record-lookup',
        description: 'Inspect A, AAAA, CNAME, MX and TXT records from authoritative sources.',
      },
    ],
  },
  {
    slug: 'performance',
    title: 'Performance',
    description: 'Latency and availability checks',
    links: [
      {
        slug: 'http-status',
        title: 'HTTP Status Inspector',
        href: '/tools/performance/http-status',
        description: 'Fetch an endpoint to review status codes, headers and response timing.',
      },
      {
        slug: 'global-ping',
        title: 'Global Ping Test',
        href: '/tools/performance/global-ping',
        description: 'Measure round-trip latency from multiple geographic regions.',
      },
    ],
  },
  {
    slug: 'security',
    title: 'Security',
    description: 'TLS and application hardening helpers',
    links: [
      {
        slug: 'tls-audit',
        title: 'TLS Certificate Audit',
        href: '/tools/security/tls-audit',
        description: 'Review certificate chains, expiry windows and supported cipher suites.',
      },
      {
        slug: 'headers-check',
        title: 'Security Headers Check',
        href: '/tools/security/headers-check',
        description: 'Analyse HTTP response headers for best-practice security coverage.',
      },
    ],
  },
];

/** Flattened list of every tool, useful for quick action displays. */
export const allTools = toolCategories.flatMap((category) =>
  category.links.map((link) => ({
    ...link,
    category: category.title,
  }))
);
