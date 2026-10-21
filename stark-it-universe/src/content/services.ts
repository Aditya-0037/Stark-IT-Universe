/**
 * The five services, in orbit order (inner planet first).
 * Names are fixed by the brief. Square-bracket text is a visible placeholder
 * the team must confirm before launch.
 */
export type ServiceId = 'smartclass' | 'ifp' | 'projector' | 'laptop' | 'network';

export interface Service {
  id: ServiceId;
  number: string;
  /** Exact service name, also used as the form <option> value. */
  name: string;
  /** Short label for tabs and small UI. */
  shortName: string;
  /** One line for the front of the service card. */
  line: string;
  /** "What's included" bullets on the back of the card. */
  included: [string, string, string];
  /** Price line on the back of the card. */
  price: string;
  /** CSS variable holding the planet colour. */
  colorVar: string;
  /** Raw hex, for SVG and 3D materials. */
  color: string;
}

export const services: Service[] = [
  {
    id: 'smartclass',
    number: '01',
    name: 'SmartClass Solution / AMC',
    shortName: 'SmartClass',
    line: 'Smart class setups for your rooms, with AMC to keep them running.',
    included: [
      '[Hardware in the starting package: confirm]',
      '[Installation and teacher training: confirm]',
      '[AMC visits and coverage: confirm]',
    ],
    price: 'From ₹70,000 + taxes',
    colorVar: '--planet-smartclass',
    color: '#8B5CF6',
  },
  {
    id: 'ifp',
    number: '02',
    name: 'Interactive Flat Panel (IFP) Setup / Repair',
    shortName: 'IFP',
    line: 'Interactive flat panels installed, connected and repaired.',
    included: [
      '[Panel sizes you supply: confirm]',
      '[Wall or stand mounting: confirm]',
      '[Repair scope: confirm]',
    ],
    price: '[Price on request]',
    colorVar: '--planet-ifp',
    color: '#06B6D4',
  },
  {
    id: 'projector',
    number: '03',
    name: 'Projector Setup / On Rent / Repair',
    shortName: 'Projector',
    line: 'Projectors set up in your rooms, given on rent, or repaired.',
    included: [
      '[Ceiling mount and screen: confirm]',
      '[Rental period and deposit: confirm]',
      '[Repair scope: confirm]',
    ],
    price: '[Price on request]',
    colorVar: '--planet-projector',
    color: '#EC4899',
  },
  {
    id: 'laptop',
    number: '04',
    name: 'Laptop / Desktop / Repair / AMC',
    shortName: 'Laptop',
    line: 'Laptops and desktops for your school, with repairs and AMC.',
    included: [
      '[Brands and models you service: confirm]',
      '[Repair scope: confirm]',
      '[AMC coverage: confirm]',
    ],
    price: '[Price on request]',
    colorVar: '--planet-laptop',
    color: '#3B82F6',
  },
  {
    id: 'network',
    number: '05',
    name: 'Networking CAT-6',
    shortName: 'CAT-6',
    line: 'CAT-6 cabling that connects every classroom device.',
    included: [
      '[Site survey: confirm]',
      '[Cabling, racks and switches: confirm]',
      '[Testing and handover: confirm]',
    ],
    price: '[Price on request]',
    colorVar: '--planet-network',
    color: '#10B981',
  },
];

export const NOT_SURE = "I'm not sure yet";

export const serviceById = (id: ServiceId) => services.find((s) => s.id === id)!;
