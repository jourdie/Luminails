import Link from 'next/link';
import { SiteNavigation } from '../../components/site-navigation';

export const metadata = {
  title: 'Studio education | Luminails',
  description: 'Practical notes for nail artists, home studios, and salons.',
};

const notes = [
  ['01', 'Build a better prep tray', 'Prep, base, colour, and finish: the calm order behind a consistent service.'],
  ['02', 'Cost per service, not bottle price', 'A simple way to make package decisions with your studio economics in mind.'],
  ['03', 'The monthly restock note', 'How to keep high-rotation essentials ready without overbuying.'],
];

export default function EducationPage() {
  return <><SiteNavigation /><main className="education-page"><section className="education-hero"><div className="education-shell"><p className="brand-eyebrow">Luminails / studio education</p><h1>Know your system.<br /><em>Work with confidence.</em></h1><p>Practical notes for artists and salon owners. No noise, just useful decisions for the table, the shelf, and the next order.</p></div></section><section className="education-list"><div className="education-shell"><div className="brand-section-head"><span className="brand-section-index">Notes for working studios</span><div><h2>Learn something.<br /><em>Use it tomorrow.</em></h2><p>Education akan berkembang menjadi content hub Luminails untuk tutorial, product knowledge, dan salon business notes.</p></div></div><div className="education-grid">{notes.map(([index, title, copy]) => <article key={index} className="education-card"><span>{index}</span><h3>{title}</h3><p>{copy}</p><Link href="/packages">See related packages <span>-&gt;</span></Link></article>)}</div></div></section></main></>;
}
