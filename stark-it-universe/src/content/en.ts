/**
 * All English copy for the homepage.
 *
 * Conventions
 * - *word*  inside headings renders as the heavy weight (Unbounded 800).
 * - [text]  anywhere renders as a visible placeholder chip. Replace these
 *           with confirmed facts before launch, or delete them.
 * - Keys under `ui` have Hindi versions in hi.ts. Everything else is English
 *   only for this demo.
 */
import type { ServiceId } from './services';

export const en = {
  ui: {
    navServices: 'Services',
    navHow: 'How we work',
    navProjects: 'Projects',
    navBuild: 'Build a classroom',
    navFaq: 'FAQ',
    heroTitle: 'Smart *Classrooms* & IT Solutions for Schools in *Delhi-NCR*',
    heroPrimary: 'Get a School Quote',
    heroSecondary: 'Explore the Universe',
    quoteCta: 'Get a School Quote',
    mobileQuote: 'Get Quote',
  },

  a11y: {
    skip: 'Skip to main content',
    home: ', back to the top',
    mainNav: 'Main',
    sectionIndex: 'Page sections',
    quickContact: 'Quick contact',
    newTab: '(opens in a new tab)',
  },

  header: {
    language: 'Language',
    lite: 'Lite mode',
    liteHint: 'Lighter 2D version with no 3D',
    menuOpen: 'Menu',
    menuClose: 'Close menu',
  },

  index: [
    { id: 'space', label: 'Space' },
    { id: 'planets', label: 'Planets' },
    { id: 'route', label: 'Route' },
    { id: 'classroom', label: 'Classroom' },
    { id: 'build', label: 'Build' },
    { id: 'proof', label: 'Proof' },
    { id: 'quote', label: 'Contact' },
  ],

  mobileBar: {
    call: 'Call',
    whatsapp: 'WhatsApp',
  },

  intro: {
    skip: 'Skip intro',
    loading: 'Entering the Stark IT Universe',
  },

  hero: {
    eyebrow: 'Enter the Stark IT Universe',
    sub: "Plan your school's next technology upgrade with Stark IT Universe. Smart classes, interactive panels, projectors, laptops and CAT-6 networking, set up, maintained and repaired from our base in Ghaziabad.",
    trust: ['50+ schools', '60,000+ students', 'Based in Ghaziabad'],
    emblemAlt: 'The Stark IT Universe emblem: a golden SIU star with five service planets in orbit',
  },

  planets: {
    eyebrow: '01 · Five services',
    title: 'Five planets, five *services*',
    intro: "Each planet in our universe is one service. Flip a card to see what's included.",
    tabsLabel: 'Jump to a service',
    flipToBack: "What's included",
    flipToFront: 'Flip back',
    flipToBackLabel: (name: string) => `Show what's included in ${name}`,
    flipToFrontLabel: (name: string) => `Show the front of the ${name} card`,
    included: "What's included",
    quoteThis: 'Get a quote for this',
    swipeHint: 'Swipe for more services',
  },

  route: {
    eyebrow: '02 · How we work',
    title: 'The orbit *route*',
    intro: 'Five stations, from the first conversation to everyday support.',
    stationsLabel: 'Stations on the route',
    stations: [
      { code: '01', name: 'Consult', text: 'Tell us your rooms, what you already have and when you want it ready.' },
      { code: '02', name: 'Demo', text: 'See the setup working before you decide. [confirm demo offer]' },
      { code: '03', name: 'Install', text: 'We set up, connect and test everything on site.' },
      { code: '04', name: 'Train', text: 'Teachers learn the everyday basics. [confirm what training includes]' },
      { code: '05', name: 'Support', text: 'Repairs and AMC whenever something needs attention.' },
    ],
  },

  descent: {
    eyebrow: '03 · Landing',
    title: 'Down to your *campus*',
    text: 'Every service lands in the same place: your classrooms.',
  },

  classroom: {
    eyebrow: '04 · Inside the classroom',
    title: 'A smart *classroom*, up close',
    intro: 'Choose a numbered point to see what each device does and how we look after it.',
    hotspotsLabel: 'Devices in the classroom',
    accentLabel: 'Scene colour',
    accentNames: {
      smartclass: 'Violet',
      ifp: 'Cyan',
      projector: 'Pink',
      laptop: 'Blue',
      network: 'Green',
    } as Record<ServiceId, string>,
    quote: 'Get a quote',
    imageAlt:
      'An illustrated classroom: an interactive flat panel on the front wall, a ceiling projector with a pull-down screen, desks with laptops, a desktop on the teacher’s table and a network rack with CAT-6 cables along the walls.',
    hotspots: [
      {
        id: 'ifp',
        service: 'ifp' as ServiceId,
        title: 'Interactive flat panel',
        lines: [
          'A large touch screen on the front wall for writing, videos and lessons.',
          'We install it, connect it and repair it when needed.',
        ],
      },
      {
        id: 'projector',
        service: 'projector' as ServiceId,
        title: 'Projector and pull-down screen',
        lines: [
          'A ceiling projector with a screen that rolls down when you need it.',
          'Set up in your room, given on rent, or repaired.',
        ],
      },
      {
        id: 'laptops',
        service: 'laptop' as ServiceId,
        title: 'Student laptops',
        lines: ['Laptops on the desks for lessons and practice.', 'Repairs and AMC keep them ready for class.'],
      },
      {
        id: 'desktop',
        service: 'laptop' as ServiceId,
        title: 'Teacher’s desktop',
        lines: ['A desktop at the teacher’s table to run the class.', 'Repaired and looked after under AMC.'],
      },
      {
        id: 'network',
        service: 'network' as ServiceId,
        title: 'Network rack and CAT-6',
        lines: [
          'A small rack with CAT-6 cables running along the walls to every device.',
          'Laid, connected and tested on site.',
        ],
      },
    ],
  },

  switchOn: {
    eyebrow: '05 · Power up',
    title: 'Switch on the *classroom*',
    intro: 'The room is dark. Drag the dial to power it up: smart board, projector, lights, then the lesson.',
    slider: 'Drag to switch on',
    sliderName: 'Classroom power',
    play: 'Switch on',
    off: 'Switch off',
    stages: ['Room is dark', 'Smart board on', 'Projector on', 'Lights on', 'Lesson ready'],
    ticks: ['Board', 'Projector', 'Lights', 'Lesson'],
    keyHint: 'Use the arrow keys to move between steps.',
    dayNight: 'Light outside',
    day: 'Day',
    night: 'Night',
    slideTitle: 'Our Solar System',
    slideSub: 'Lesson 1 · Science',
    imageAlt: 'The illustrated classroom. Its lights and screens change as you power it up.',
  },

  build: {
    eyebrow: '06 · Configure',
    title: 'Build your *classroom*',
    intro: 'Choose what you need. The room updates as you go, and you can send the setup to us for a quote.',
    classrooms: 'Number of classrooms',
    display: 'Display type',
    displayOptions: [
      { value: 'ifp', label: 'IFP', long: 'Interactive flat panel' },
      { value: 'projector', label: 'Projector', long: 'Projector and screen' },
      { value: 'both', label: 'Both', long: 'IFP and projector' },
    ],
    laptops: 'Laptops',
    desktops: 'Desktops',
    devicesHint: 'Total for the school',
    networking: 'CAT-6 networking',
    amc: 'AMC (annual maintenance)',
    yes: 'Yes',
    no: 'No',
    decrease: (label: string) => `Fewer: ${label}`,
    increase: (label: string) => `More: ${label}`,
    previewTitle: 'Your classroom',
    summaryTitle: 'Your setup',
    noPrice: 'No prices here: we prepare an itemised quote for your rooms.',
    send: 'Send this setup for a quote',
    messageIntro: 'Classroom setup from the website:',
    rooms: (n: number) => `${n} classroom${n === 1 ? '' : 's'}`,
    roomsChip: (n: number) => (n === 1 ? 'classroom' : 'classrooms'),
    laptopsCount: (n: number) => `${n} laptop${n === 1 ? '' : 's'}`,
    desktopsCount: (n: number) => `${n} desktop${n === 1 ? '' : 's'}`,
  },

  proof: {
    eyebrow: '07 · Proof',
    title: 'Our work in *schools*',
    stats: [
      { value: '50+', label: 'schools served' },
      { value: '60,000+', label: 'students reached' },
    ],
    projectsTitle: 'Projects',
    // To use a real photo: put the file in /public/photos and set `image`
    // (e.g. '/photos/dps-ghaziabad.jpg') and `alt` (what the photo shows).
    // Replace the bracketed school and detail text at the same time.
    projects: [
      {
        image: null as string | null,
        alt: '',
        photo: '[Photo: real installation]',
        school: '[School name, City]',
        detail: '[Rooms and equipment · Month Year]',
      },
      {
        image: null as string | null,
        alt: '',
        photo: '[Photo: real installation]',
        school: '[School name, City]',
        detail: '[Rooms and equipment · Month Year]',
      },
      {
        image: null as string | null,
        alt: '',
        photo: '[Photo: real installation]',
        school: '[School name, City]',
        detail: '[Rooms and equipment · Month Year]',
      },
    ],
    testimonialsTitle: 'What schools say',
    testimonials: [
      {
        quote:
          'Stark IT Universe has been a reliable technology partner for our school. Their smart classroom solutions and prompt technical support have made a real difference in our day-to-day operations.',
        name: 'Rajiv Sharma',
        role: 'Principal, Gurgaon',
        initials: 'RS',
      },
      {
        quote:
          'The team provided excellent support for our Interactive Flat Panels, networking, and IT infrastructure. Their service has been professional and responsive.',
        name: 'Anita Verma',
        role: 'School Administrator, Delhi',
        initials: 'AV',
      },
    ],
    faqTitle: 'Questions schools ask',
    faq: [
      {
        q: 'Which is better for our classrooms: an interactive flat panel or a projector?',
        a: 'It depends on room size, lighting, how teachers will use it and your budget. After a short consultation we suggest the right option for each room.',
      },
      {
        q: 'How much does a smart classroom cost?',
        a: 'Smart class setups start from ₹70,000 + taxes. [What the starting package includes.] We prepare an itemised quote for your rooms.',
      },
      {
        q: 'Can we rent a projector?',
        a: 'Yes, projectors are available on rent. [Rental period, deposit and delivery terms.]',
      },
      {
        q: 'What does your AMC cover?',
        a: 'AMC is available for smart classes, laptops and desktops. [Visits per year, parts, response time.]',
      },
      {
        q: 'Do you lay CAT-6 networking across the campus?',
        a: 'Yes, we install CAT-6 networking for schools. [Scope and how the site survey works.]',
      },
      {
        q: 'Where are you based?',
        a: 'KA-215, Pratap Vihar, Sector 12, Ghaziabad, Uttar Pradesh 201009. We work with schools across North India.',
      },
    ],
  },

  quote: {
    eyebrow: '08 · Get in touch',
    title: 'Tell us what your school *needs*.',
    intro:
      'Share your school, city and requirement. Our team will contact you to discuss suitable options and prepare the next step.',
    required: 'Fields marked * are required.',
    fields: {
      name: 'Your name',
      school: 'School or institution',
      mobile: 'Mobile number',
      mobileHint: '10 digits. You can add +91 and spaces.',
      city: 'City',
      service: 'Service needed',
      serviceEmpty: 'Choose a service',
      email: 'Email',
      optional: '(optional)',
      message: 'Message',
      whatsapp: 'Send me updates on WhatsApp',
    },
    errors: {
      name: 'Please enter your name.',
      school: 'Please enter your school or institution.',
      mobile: 'Please enter a 10-digit mobile number, with or without +91.',
      city: 'Please enter your city.',
      service: 'Please choose a service, or pick “I’m not sure yet”.',
      email: 'Please check the email address, or leave it empty.',
      summary: (n: number) => `Please fix ${n} field${n === 1 ? '' : 's'} marked below.`,
    },
    submit: 'Request My School Quote',
    sending: 'Sending…',
    success:
      'Thanks! This is a design demo, so nothing was sent. On the live site our team will reply on your mobile number.',
    successTitle: 'Request received',
    privacy: 'We use these details only to reply to your enquiry.',
    privacyLink: '[Privacy policy link]',
    direct: 'Talk to us directly',
    call: 'Call',
    whatsapp: 'WhatsApp',
    emailLabel: 'Email',
    visit: 'Visit',
  },

  footer: {
    tagline: 'Smart classrooms and IT solutions for schools in Delhi-NCR and North India.',
    services: 'Services',
    contact: 'Contact',
    copyright: '© 2026 Stark IT Universe',
    privacy: '[Privacy policy]',
    terms: '[Terms]',
  },
};

export type Copy = typeof en;
export type UiKey = keyof typeof en.ui;
