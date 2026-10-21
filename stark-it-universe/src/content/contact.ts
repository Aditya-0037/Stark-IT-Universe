/**
 * Contact details used everywhere on the page (header, hero, mobile bar,
 * quote section, footer). Change them here only.
 */
export const contact = {
  phoneDisplay: '+91 73024 79231',
  phoneHref: 'tel:+917302479231',
  whatsappHref: 'https://wa.me/917302479231',
  email: 'info@starkituniverse.in',
  emailHref: 'mailto:info@starkituniverse.in',
  addressLines: ['KA-215, Pratap Vihar, Sector 12', 'Ghaziabad, U.P. 201009'],
  mapsHref:
    'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent('KA-215, Pratap Vihar, Sector 12, Ghaziabad, Uttar Pradesh 201009'),
} as const;
