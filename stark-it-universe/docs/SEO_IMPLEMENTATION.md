# SIU website implementation

Implemented 23 October 2026 in the local React project. The live WordPress installation, business accounts and hosting configuration have not been changed or published.

## What is implemented

- 24 prerendered routes plus a separate 404 document. Service scope, AMC, solutions, location and buying-guide content is present in the HTML before JavaScript runs.
- Services hub and dedicated smart class setup, panel installation, panel repair, projector, computer repair/AMC and CAT-6 networking pages, plus the AMC hub.
- Private-school, government ICT and CSR project briefs; coverage hub and one factual Ghaziabad page, rather than speculative branch pages.
- Four guides: classroom cost planning, panel/projector comparison, AMC checklist and panel-size selection. Guides show SIU as the organisational author and the actual preparation date. Add a qualified named reviewer when one is supplied.
- Unique titles, descriptions and H1s; canonical URLs; Open Graph metadata; generated robots.txt and sitemap.xml; one linked LocalBusiness/WebSite/WebPage graph, service nodes, guide Article nodes and breadcrumbs. No self-review rating markup, fake profile links or unconfirmed opening hours/coordinates.
- Connected navigation, prefilled WhatsApp links, real telephone/email links, contact and site-visit enquiry paths, privacy notice and website terms.
- Five required enquiry fields plus optional email, message and discovery source. ChatGPT, Google AI/Gemini, Google Maps and WhatsApp are source options. Validation keeps values and focuses the first error. The form creates a draft; the visitor sends it in WhatsApp or their email app. No fake receipt or hidden backend submission.
- Budget calculator with buyer-entered equipment, installation, AMC and tax rates, alongside the static scope table. No competitor price is represented as SIU's own rate.
- Ungated two-page sample AMC scope worksheet in PDF and editable text. All commercial and SLA fields require agreement; the worksheet is not a completed contract.
- Unsupported counters removed from output. The homepage Proof section always shows the project cards and the school testimonials from `src/content/en.ts` (the owner's decision; do not hide or filter them). Project cards show visible placeholders until a real photo and the school and detail text are filled in. The reference-request page remains `noindex` and is excluded from the sitemap until real case studies are ready.
- Real HTTP 404 and canonical trailing-slash redirects in the local production preview. `public/_redirects` contains the legacy about/contact mappings and retirement of default WordPress content for hosts supporting that format.

The implementation follows the crawlable HTML and metadata approach described in [Google's JavaScript SEO documentation](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics). The entity graph uses [Google's LocalBusiness documentation](https://developers.google.com/search/docs/appearance/structured-data/local-business); it does not represent a ranking guarantee. Google's [generative AI optimisation guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) emphasises normal SEO and useful, attributable content.

## Verify and preview

```powershell
npm.cmd run build
npm.cmd run check:seo
npm.cmd run check:browser
npm.cmd run preview
```

Open `http://localhost:4173`. The static check covers all 25 documents, schema JSON, unique metadata, one H1, DOM IDs, sitemap eligibility and internal page/anchor/download targets. The browser check covers direct routes, hydration, 1440/768/390px layouts, form errors and focus, query prefills, attribution, calculator arithmetic, PDF availability, redirects and no-JavaScript pages. It does not send enquiries. Screenshots are saved in `docs/seo-preview/`.

The PDF source is `scripts/create-amc-sample.py`; the delivered copy is `public/downloads/siu-amc-scope-sample.pdf`, mirrored in `output/pdf/`. PDF generation needs ReportLab, pypdf and PyMuPDF; these are authoring tools, not website dependencies. The document has been rendered and visually checked on both pages.

## Publish configuration

1. Set `VITE_SITE_URL` to the final HTTPS origin. Set `VITE_SITE_INDEXABLE=false` for staging; production defaults to indexing. These are build-time values.
2. Build and upload the entire `dist` directory. Serve each route's directory `index.html`, preserve query strings on redirects and return HTTP 404 with `404.html` for unknown URLs. Do not use a blanket homepage fallback. Verify this on the actual host; `_redirects` is not an Apache or IIS configuration.
3. On the current WordPress installation, retire the default post and author sitemap, preserve necessary legacy URL redirects, and replace the site only as part of the intended hosting migration. A static React site does not need a WordPress SEO plugin.
4. Submit the deployed sitemap to Search Console and Bing Webmaster Tools using the business's verified accounts. Check canonical URL, rendered HTML, crawl access and real response codes after deployment.
5. Check the CDN/firewall separately. A permissive robots file does not override bot challenges or hosting access restrictions. This project cannot change those account settings.

## Business inputs still needed

| Input | Where it belongs |
|---|---|
| Approved package prices, equipment/model, units, GST treatment and scope | Service pages, cost table and eventual SIU-rate calculator defaults |
| AMC rates, actual visits, support window, distance bands, response/resolution, parts, loaner and escalation | AMC page and an approved completed sample agreement |
| Accurate staffed hours, entrance photos, coordinates and verified official profile URLs | Contact/coverage pages, business identity and LocalBusiness graph |
| Owner/co-founder names, roles and reviewed guide copy | About/team content and guide author/reviewer records |
| Written permission for school name, photos, figures and quotations | Case studies and customer proof; remove `/projects/` noindex only after evidence is published |
| Documentary OEM authorisations and actual GeM/Udyam credentials | Verified certifications and procurement capability statements |
| Approved privacy/business retention practices | Review privacy notice and terms against real operations before production |
| Analytics property or GTM configuration | Connect the event hooks below; update the privacy notice if a tracker is added |

The current content explicitly requests a quote where those facts are unknown. No guaranteed response time, authorised-partner badge, exact inventory, registration or school result has been invented.

## Analytics integration

`src/lib/analytics.ts` emits `siu:analytics` CustomEvents and also pushes to an existing `window.dataLayer` if one is configured by the host. It does not load GA4 or GTM by itself. No name, phone, email, school or free-text enquiry is included in these events.

| Event | Meaning |
|---|---|
| `contact_call` | Visitor selected a telephone link |
| `contact_whatsapp` | Visitor selected a WhatsApp link; not proof of a sent message |
| `site_visit_request` | Visitor selected the site-visit enquiry link; not a booking confirmation |
| `quote_draft_prepared` | Valid enquiry draft prepared locally, with service and optional discovery source |
| `amc_sample_download` | Visitor selected the sample PDF download |

Map selected events to the actual analytics property after configuration. Count qualified leads from received enquiries; link clicks and prepared drafts are not received leads.

## Account work outside this project

Google Business Profile verification, directory listings, genuine review requests, OEM partner applications, Search Console/Bing verification, actual customer evidence, video publication and third-party mentions require the business's accounts and facts. They have not been performed as website code changes. Hindi URLs and additional city pages are intentionally deferred until reviewed translations, search demand and genuine delivery evidence exist.
