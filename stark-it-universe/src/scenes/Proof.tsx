import { en } from '../content/en';
import { Icon } from '../components/Icons';
import { Ph, Rich } from '../components/Placeholder';
import { Scene, SceneTitle } from '../components/Scene';

const AVATAR_COLORS = ['var(--planet-ifp)', 'var(--planet-projector)'];

/**
 * Scene 8: proof. Huge outlined "ghost" numbers sit behind the content.
 * Project cards are glass cards with visible placeholders (no invented
 * schools or results). The two testimonials are the existing quotes from
 * the brief. The FAQ uses native <details>/<summary>.
 */
export function Proof() {
  const p = en.proof;
  return (
    <Scene id="proof" theme="dark" index="proof">
      <div className="proof__ghosts" aria-hidden="true">
        {p.stats.map((s) => (
          <span key={s.value} className="ghost-number">
            {s.value}
          </span>
        ))}
      </div>

      <div className="container proof">
        <SceneTitle id="proof" eyebrow={p.eyebrow} title={p.title} />

        <ul className="proof__stats">
          {p.stats.map((s) => (
            <li key={s.value}>
              <strong>{s.value}</strong>
              <span>{s.label}</span>
            </li>
          ))}
        </ul>

        <h3 className="h3 proof__subhead">{p.projectsTitle}</h3>
        <ul className="projects">
          {p.projects.map((proj, i) => (
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

        <h3 className="h3 proof__subhead">{p.testimonialsTitle}</h3>
        <div className="testimonials">
          {p.testimonials.map((t, i) => (
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
