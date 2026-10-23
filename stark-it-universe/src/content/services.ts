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
    name: 'Smart class setup',
    shortName: 'SmartClass',
    line: 'Smart class setups for your rooms, with AMC to keep them running.',
    included: [
      'Display and room requirements',
      'Installation and teacher handover scope',
      'An itemised quote and support discussion',
    ],
    price: 'Itemised quote per classroom',
    colorVar: '--planet-smartclass',
    color: '#8B5CF6',
  },
  {
    id: 'ifp',
    number: '02',
    name: 'Interactive flat panels',
    shortName: 'IFP',
    line: 'Interactive flat panels installed, connected and repaired.',
    included: [
      'Model and classroom compatibility',
      'Mounting and connection requirements',
      'Repair assessment for existing panels',
    ],
    price: 'Quote by model and scope',
    colorVar: '--planet-ifp',
    color: '#06B6D4',
  },
  {
    id: 'projector',
    number: '03',
    name: 'Projector setup, rental & repair',
    shortName: 'Projector',
    line: 'Projectors set up in your rooms, given on rent, or repaired.',
    included: [
      'Classroom or event requirements',
      'Rental period and delivery discussion',
      'Diagnosis and repair quotation',
    ],
    price: 'Quote by room, event or repair',
    colorVar: '--planet-projector',
    color: '#EC4899',
  },
  {
    id: 'laptop',
    number: '04',
    name: 'Computer repair & AMC',
    shortName: 'Laptop',
    line: 'Laptops and desktops for your school, with repairs and AMC.',
    included: [
      'Laptop and desktop diagnosis',
      'Parts approved before replacement',
      'AMC scope against your asset list',
    ],
    price: 'Quote per device and agreed work',
    colorVar: '--planet-laptop',
    color: '#3B82F6',
  },
  {
    id: 'network',
    number: '05',
    name: 'School CAT-6 networking',
    shortName: 'CAT-6',
    line: 'CAT-6 cabling that connects every classroom device.',
    included: [
      'Campus points and cable-route planning',
      'Cabling and equipment scope',
      'Testing and handover requirements',
    ],
    price: 'Quote against the site scope',
    colorVar: '--planet-network',
    color: '#10B981',
  },
];

export const NOT_SURE = "I'm not sure yet";

export const serviceById = (id: ServiceId) => services.find((s) => s.id === id)!;
