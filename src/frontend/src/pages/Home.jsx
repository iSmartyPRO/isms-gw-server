import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Collapse } from 'antd';
import PublicLayout from '../layouts/PublicLayout';
import { MenuIcon } from '../components/icons/menuIcons';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { can } from '../lib/access';
import './home.css';

/*
 * The landing page of the SMS gateway (Settings → Site access → Home page =
 * «Landing»). Every text lives in locales/<lang>/landing.js; sections are
 * anchors (#features, #how, #api, #security, #faq) for the in-page menu.
 */

const SECTIONS = ['features', 'how', 'api', 'security', 'faq'];
const APP_URL = 'https://github.com/iSmartyPRO/isms-gw-android/releases/latest';

/** The hero picture: a phone with SIM cards, messages flying in from the API and out to people. */
function HeroArt({ landing }) {
  const art = landing.hero.art;
  return (
    <div className="hp-art" aria-hidden>
      <div className="hp-art__glow" />
      <div className="hp-art__api">
        <span className="hp-art__method">POST</span>
        <code>/api/v1/app/sms/messages</code>
        <span className="hp-art__ok">201</span>
      </div>
      <div className="hp-art__phone">
        <span className="hp-art__notch" />
        <div className="hp-art__screen">
          <div className="hp-art__status">
            <span className="hp-art__live" />
            {art.online}
          </div>
          <div className="hp-art__sims">
            <span className="hp-art__sim" style={{ '--c': '#00A3E0' }}>
              <i />
              SIM 1
            </span>
            <span className="hp-art__sim" style={{ '--c': '#7950F2' }}>
              <i />
              eSIM
            </span>
          </div>
          <div className="hp-art__bubbles">
            <span className="hp-art__bubble is-in">{art.incoming}</span>
            <span className="hp-art__bubble is-out">{art.outgoing}</span>
            <span className="hp-art__ticks">✓✓ {art.delivered}</span>
          </div>
        </div>
      </div>
      <div className="hp-art__card hp-art__card--a">
        <strong>98.6%</strong>
        <span>{art.rate}</span>
      </div>
      <div className="hp-art__card hp-art__card--b">
        <strong>webhook</strong>
        <span>sms.delivered</span>
      </div>
      <div className="hp-art__flight hp-art__flight--1" />
      <div className="hp-art__flight hp-art__flight--2" />
      <div className="hp-art__flight hp-art__flight--3" />
    </div>
  );
}

function SectionHead({ id, t, center = true }) {
  return (
    <header className={`lp-section__head${center ? '' : ' is-left'}`}>
      <p className="lp-kicker">{t(`landing.${id}.kicker`)}</p>
      <h2>{t(`landing.${id}.title`)}</h2>
      <p className="lp-section__lead">{t(`landing.${id}.lead`)}</p>
    </header>
  );
}

const CODE = {
  curl: `curl -X POST https://sms.example.com/api/v1/app/sms/messages \\
  -H "Authorization: Bearer $SMS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"to": ["+996555123456"], "text": "Your code: 4821"}'`,
  python: `import requests

requests.post(
    "https://sms.example.com/api/v1/app/sms/messages",
    headers={"Authorization": f"Bearer {TOKEN}"},
    json={"to": ["+996555123456"], "text": "Your code: 4821"},
)`,
  node: `await fetch('https://sms.example.com/api/v1/app/sms/messages', {
  method: 'POST',
  headers: { Authorization: \`Bearer \${TOKEN}\`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ to: ['+996555123456'], text: 'Your code: 4821' }),
});`,
  php: `$ch = curl_init('https://sms.example.com/api/v1/app/sms/messages');
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token, 'Content-Type: application/json'],
  CURLOPT_POSTFIELDS => json_encode(['to' => ['+996555123456'], 'text' => 'Your code: 4821']),
]);
curl_exec($ch);`,
};

export default function Home() {
  const { t, dict } = useLocale();
  const { user } = useAuth();
  const { hash } = useLocation();
  const [lang, setLang] = useState('curl');
  const landing = dict.landing;
  const origin = typeof window === 'undefined' ? 'https://sms.example.com' : window.location.origin;

  // A link to /#faq opens the page before its sections exist (lazy page, texts loading): scroll once they do.
  useEffect(() => {
    const id = decodeURIComponent(hash.slice(1));
    if (!id) return;
    document.getElementById(id)?.scrollIntoView({ block: 'start' });
  }, [hash]);

  const primary = user ? (
    <Link className="btn btn--primary hp-btn" to="/app/sms">
      {t('landing.ctaApp')}
    </Link>
  ) : (
    <Link className="btn btn--primary hp-btn" to="/login">
      {t('landing.ctaLogin')}
    </Link>
  );

  return (
    <PublicLayout>
      <div className="lp hp">
        <nav className="lp-nav" aria-label={t('landing.navLabel')}>
          {SECTIONS.map((id) => (
            <a key={id} href={`#${id}`}>
              {t(`landing.nav.${id}`)}
            </a>
          ))}
        </nav>

        <section className="hp-hero" id="top">
          <div className="hp-hero__text">
            <p className="hp-badge">
              <span className="hp-badge__dot" />
              {t('landing.kicker')}
            </p>
            <h1 className="hp-hero__title">
              {t('landing.hero.titleA')} <span className="hp-gradient">{t('landing.hero.titleB')}</span>
            </h1>
            <p className="hp-hero__lead">{t('landing.hero.lead')}</p>
            <div className="lp-hero__cta">
              {primary}
              <a className="btn btn--ghost hp-btn" href={APP_URL} target="_blank" rel="noreferrer">
                {t('landing.ctaApp2')}
              </a>
              {user && can(user, 'console.access') && (
                <Link className="btn btn--ghost hp-btn" to="/admin">
                  {t('landing.ctaAdmin')}
                </Link>
              )}
            </div>
            <ul className="hp-facts">
              {landing.facts.map((fact) => (
                <li key={fact.label}>
                  <strong>{fact.value}</strong>
                  <span>{fact.label}</span>
                </li>
              ))}
            </ul>
          </div>
          <HeroArt landing={landing} />
        </section>

        <div className="hp-strip">
          <span>{t('landing.strip.label')}</span>
          {landing.strip.items.map((item) => (
            <b key={item}>{item}</b>
          ))}
        </div>

        <section className="lp-section" id="features">
          <SectionHead id="features" t={t} />
          <div className="hp-features">
            {landing.features.items.map((item, index) => (
              <article className={`hp-feature${index === 0 ? ' is-wide' : ''}`} key={item.title}>
                <span className="hp-feature__icon">
                  <MenuIcon name={item.icon} />
                </span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-section" id="how">
          <SectionHead id="how" t={t} />
          <ol className="hp-steps">
            {landing.how.steps.map((step, index) => (
              <li key={step.title}>
                <span className="hp-steps__num">{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
                {step.note && <span className="hp-steps__note">{step.note}</span>}
              </li>
            ))}
          </ol>
        </section>

        <section className="lp-section hp-api" id="api">
          <div className="hp-api__text">
            <SectionHead id="api" t={t} center={false} />
            <ul className="hp-checks">
              {landing.api.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <div className="hp-events">
              {['sms.received', 'sms.sent', 'sms.delivered', 'sms.failed', 'device.online', 'device.offline'].map((event) => (
                <code key={event}>{event}</code>
              ))}
            </div>
          </div>
          <div className="hp-code">
            <div className="hp-code__bar">
              <span className="hp-code__dots">
                <i />
                <i />
                <i />
              </span>
              <div className="hp-code__tabs" role="tablist">
                {[
                  ['curl', 'cURL'],
                  ['python', 'Python'],
                  ['node', 'Node.js'],
                  ['php', 'PHP'],
                ].map(([key, label]) => (
                  <button key={key} type="button" role="tab" aria-selected={lang === key} className={lang === key ? 'is-active' : ''} onClick={() => setLang(key)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <pre>
              <code>{CODE[lang].replaceAll('https://sms.example.com', origin)}</code>
            </pre>
            <div className="hp-code__answer">
              <span>201 Created</span>
              <code>{'{ "status": "queued" } → sent → delivered ✓✓'}</code>
            </div>
          </div>
        </section>

        <section className="lp-section" id="cases">
          <SectionHead id="cases" t={t} />
          <div className="hp-cases">
            {landing.cases.items.map((item) => (
              <article key={item.title} className="hp-case">
                <span className="hp-case__emoji" aria-hidden>
                  {item.emoji}
                </span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                <span className="hp-case__sms">{item.sms}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-section" id="compare">
          <SectionHead id="compare" t={t} />
          <div className="hp-compare" role="table">
            <div className="hp-compare__row is-head" role="row">
              <span role="columnheader" />
              <span role="columnheader">{landing.compare.them}</span>
              <span role="columnheader" className="is-us">
                {landing.compare.us}
              </span>
            </div>
            {landing.compare.rows.map((row) => (
              <div className="hp-compare__row" role="row" key={row.label}>
                <span role="rowheader">{row.label}</span>
                <span role="cell">{row.them}</span>
                <span role="cell" className="is-us">
                  {row.us}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="lp-section hp-security" id="security">
          <SectionHead id="security" t={t} />
          <div className="hp-security__grid">
            {landing.security.items.map((item) => (
              <article key={item.title}>
                <MenuIcon name={item.icon} />
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-section" id="faq">
          <SectionHead id="faq" t={t} />
          <Collapse
            className="lp-faq"
            bordered={false}
            items={landing.faq.items.map((item, index) => ({ key: String(index), label: item.q, children: <p>{item.a}</p> }))}
          />
        </section>

        <section className="lp-section hp-cta" id="contact">
          <div className="hp-cta__glow" aria-hidden />
          <div className="hp-cta__text">
            <h2>{t('landing.contact.title')}</h2>
            <p>{t('landing.contact.text')}</p>
          </div>
          <div className="lp-contact__actions">
            {primary}
            {landing.contact.email && (
              <a className="btn btn--ghost hp-btn" href={`mailto:${landing.contact.email}`}>
                {landing.contact.email}
              </a>
            )}
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
