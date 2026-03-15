import { describe, expect, it } from 'vitest';
import {
  extractHomeDepotProductId,
  parseHomeDepotProductDocument,
  parseHomeDepotSerpApiProductResponse,
  parseHomeDepotSerpApiSearchResponse,
  selectBestHomeDepotSearchCandidate,
} from './vendor-price-sync.js';

describe('parseHomeDepotProductDocument', () => {
  it('extracts price and metadata from ld+json product data', () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Product",
              "name": "HDX 18 in. Deluxe Pool Brush",
              "sku": "HDX-18-BRUSH",
              "brand": { "@type": "Brand", "name": "HDX" },
              "url": "https://www.homedepot.com/p/example-product",
              "offers": {
                "@type": "Offer",
                "priceCurrency": "USD",
                "price": "24.98"
              }
            }
          </script>
        </head>
      </html>
    `;

    expect(parseHomeDepotProductDocument(html)).toEqual({
      name: 'HDX 18 in. Deluxe Pool Brush',
      brand: 'HDX',
      sku: 'HDX-18-BRUSH',
      url: 'https://www.homedepot.com/p/example-product',
      price: 24.98,
      currency: 'USD',
    });
  });

  it('falls back to inline price extraction when ld+json is absent', () => {
    const html = '<html><body>{"currentPrice":"79.00"}</body></html>';

    expect(parseHomeDepotProductDocument(html)).toEqual({
      price: 79,
      currency: 'USD',
    });
  });

  it('extracts a Home Depot product id from a product URL', () => {
    expect(
      extractHomeDepotProductId(
        'https://www.homedepot.com/p/Champion-1-Gallon-Muriatic-Acid-2-Pack-CH518/334625012',
      ),
    ).toBe('334625012');
  });

  it('parses SerpApi Home Depot search results', () => {
    const payload = {
      products: [
        {
          product_id: '334625012',
          title: 'Champion 1 Gallon Muriatic Acid (2-Pack)',
          brand: 'Champion',
          model_number: 'CH518',
          link: 'https://www.homedepot.com/p/Champion-1-Gallon-Muriatic-Acid-2-Pack-CH518/334625012',
          price: '19.98',
        },
      ],
    };

    expect(parseHomeDepotSerpApiSearchResponse(payload)).toEqual([
      {
        productId: '334625012',
        name: 'Champion 1 Gallon Muriatic Acid (2-Pack)',
        brand: 'Champion',
        sku: 'CH518',
        url: 'https://www.homedepot.com/p/Champion-1-Gallon-Muriatic-Acid-2-Pack-CH518/334625012',
        price: 19.98,
        currency: 'USD',
      },
    ]);
  });

  it('parses SerpApi Home Depot product results', () => {
    const payload = {
      product_results: {
        title: 'Champion 1 Gallon Muriatic Acid (2-Pack)',
        brand: 'Champion',
        model_number: 'CH518',
        product_url: 'https://www.homedepot.com/p/Champion-1-Gallon-Muriatic-Acid-2-Pack-CH518/334625012',
        current_price: '19.98',
        price_currency: 'USD',
      },
    };

    expect(parseHomeDepotSerpApiProductResponse(payload)).toEqual({
      name: 'Champion 1 Gallon Muriatic Acid (2-Pack)',
      brand: 'Champion',
      sku: 'CH518',
      url: 'https://www.homedepot.com/p/Champion-1-Gallon-Muriatic-Acid-2-Pack-CH518/334625012',
      price: 19.98,
      currency: 'USD',
    });
  });

  it('selects the best matching Home Depot search candidate', () => {
    const match = selectBestHomeDepotSearchCandidate(
      [
        {
          productId: '334625012',
          name: 'Champion 1 Gallon Muriatic Acid (2-Pack)',
          brand: 'Champion',
          sku: 'CH518',
          url: 'https://www.homedepot.com/p/Champion-1-Gallon-Muriatic-Acid-2-Pack-CH518/334625012',
          price: 19.98,
          currency: 'USD',
        },
        {
          productId: '202690263',
          name: 'Klean-Strip Green 1 Gal. Green Muriatic Acid',
          brand: 'Klean-Strip',
          sku: 'GKGM75006',
          url: 'https://www.homedepot.com/p/Klean-Strip-Green-1-Gal-Green-Muriatic-Acid-GKGM75006/202690263',
          price: 10.48,
          currency: 'USD',
        },
      ],
      {
        productName: 'Champion Muriatic Acid',
        productBrand: 'Champion',
        vendorSku: 'CH518',
      },
    );

    expect(match?.productId).toBe('334625012');
  });
});
