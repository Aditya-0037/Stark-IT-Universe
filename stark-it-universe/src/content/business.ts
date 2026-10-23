import { contact } from './contact';

// Public facts only. Add hours, coordinates and official profiles once verified.
export const business = {
  name: 'Stark IT Universe',
  shortName: 'SIU',
  origin: (import.meta.env.VITE_SITE_URL || 'https://starkituniverse.in').replace(/\/$/, ''),
  indexable: import.meta.env.VITE_SITE_INDEXABLE !== 'false',
  description: 'Stark IT Universe is a Ghaziabad-based smart classroom and IT service company offering installation, teacher training, repairs and AMC for schools in Delhi NCR and North India. Larger projects elsewhere in India are planned individually.',
  telephone: contact.phoneHref.replace('tel:', ''),
  email: contact.email,
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'KA-215, Pratap Vihar, Sector 12',
    addressLocality: 'Ghaziabad',
    addressRegion: 'Uttar Pradesh',
    postalCode: '201009',
    addressCountry: 'IN',
  },
  areas: ['Ghaziabad', 'Delhi NCR', 'North India'],
  officialProfiles: [] as string[],
};

export function whatsappLink(message = 'Hello SIU, I would like to discuss technology for our school.') {
  return `${contact.whatsappHref}?text=${encodeURIComponent(message)}`;
}

export const servicePaths = {
  smartclass: '/smart-class-setup/',
  ifp: '/interactive-flat-panel/',
  projector: '/projector-services/',
  laptop: '/computer-repair-amc/',
  network: '/school-networking/',
} as const;

// Actual preparation date of the initial guide copy; update only after review.
export const guidePrepared = '2026-10-23';
