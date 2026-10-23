import { en } from '../content/en';
import { Icon } from '../components/Icons';
import { Ph, Rich } from '../components/Placeholder';
import { Scene, SceneTitle } from '../components/Scene';

const AVATAR_COLORS = ['var(--planet-ifp)', 'var(--planet-projector)'];

const CHECKS = [
  { title: 'Equipment and installation', text: 'Ask for the model, quantities, commissioning checklist and warranty route.' },
  { title: 'Teacher handover', text: 'Agree the training language, attendees, session count and materials.' },
  { title: 'Support in writing', text: 'Confirm covered assets, visits, response targets, parts and escalation.' },
];

/**
 * Buyer checks, then the school projects (glass cards with visible
 * placeholders until real photos and school names are set in en.ts) and the
 * school testimonials. Both are always shown (the owner's decision).
 */
export function Proof() {
  const p = en.proof;
  const projects = p.projects;
  const testimonials = p.testimonials;
  return (
    <Scene id="proof" theme="dark" index="proof">
      <div className="container proof">
        <SceneTitle id="proof" eyebrow="07 · Before you decide" title="Know what your school is *getting*" intro="Use these checks to compare the complete installation and the support after it." />
        <ul className="projects">
          {CHECKS.map((proj, i) => (
            <li key={i} className="project-card glass-card">
              <h3 className="project-card__school">
                {proj.title}
              </h3>
              <p className="project-card__detail">
                {proj.text}
              </p>
            </li>
          ))}
        </ul>
        <p style={{ marginTop: 28 }}><a href="/contact-us/">Ask about a comparable school installation</a> and the available reference documents.</p>

        {projects.length > 0 && <>
        <h3 className="h3 proof__subhead">{p.projectsTitle}</h3>
        <ul className="projects">
          {projects.map((proj, i) => (
            <li key={i} className="project-card glass-card">
              {proj.image ? (
                <img
                  className="project-card__img"
                  src={proj.image}
                  alt={proj.alt}
                  width={800}
                  height={600}
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="project-card__photo">
                  <Icon name="school" size={28} />
                  <Ph>{proj.photo}</Ph>
                </div>
              )}
              <h4 className="project-card__school">
                <Rich text={proj.school} />
              </h4>
              <p className="project-card__detail">
                <Rich text={proj.detail} />
              </p>
            </li>
          ))}
        </ul>
        </>}

        {testimonials.length > 0 && <>
        <h3 className="h3 proof__subhead">{p.testimonialsTitle}</h3>
        <div className="testimonials">
          {testimonials.map((t, i) => (
            <figure key={t.name} className="testimonial">
              <span className="testimonial__mark" aria-hidden="true">
                “
              </span>
              <blockquote>
                <p>{t.quote}</p>
              </blockquote>
              <figcaption>
                <span className="avatar" style={{ background: AVATAR_COLORS[i % 2] }} aria-hidden="true">
                  {t.initials}
                </span>
                <span>
                  <span className="testimonial__name">{t.name}</span>
                  <span className="testimonial__role">{t.role}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
        </>}

        <div id="faq" className="faq">
          <h3 className="h3 proof__subhead" tabIndex={-1} data-focus-target>
            {p.faqTitle}
          </h3>
          <div className="faq__list">
            {p.faq.map((item) => (
              <details key={item.q} className="faq__item">
                <summary>
                  <span>{item.q}</span>
                  <span className="faq__icon" aria-hidden="true" />
                </summary>
                <p>
                  <Rich text={item.a} />
                </p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </Scene>
  );
}
