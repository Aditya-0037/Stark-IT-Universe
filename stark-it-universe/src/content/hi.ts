/**
 * Hindi copy for the demo. Only the header links, hero H1, hero buttons and
 * the quote buttons are translated; everything else falls back to English.
 * Every string here must be checked by a fluent Hindi speaker before launch.
 */
import type { UiKey } from './en';

export const hi: Partial<Record<UiKey, string>> = {
  navServices: 'सेवाएं', // needs human review
  navHow: 'हम कैसे काम करते हैं', // needs human review
  navProjects: 'AMC और सहायता', // needs human review
  navBuild: 'क्लासरूम बनाएं', // needs human review
  navFaq: 'सवाल-जवाब', // needs human review
  heroTitle: '*दिल्ली-एनसीआर* के स्कूलों के लिए *स्मार्ट क्लासरूम* और आईटी समाधान', // needs human review
  heroPrimary: 'स्कूल के लिए कोटेशन पाएं', // needs human review
  heroSecondary: 'यूनिवर्स एक्सप्लोर करें', // needs human review
  quoteCta: 'स्कूल के लिए कोटेशन पाएं', // needs human review
  mobileQuote: 'कोटेशन पाएं', // needs human review
};
