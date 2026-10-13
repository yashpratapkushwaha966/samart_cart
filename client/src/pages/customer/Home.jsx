import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiClock, FiArrowRight, FiSmartphone, FiShoppingBag, FiCheckCircle } from 'react-icons/fi';
import { useMenu } from '../../context/MenuContext.jsx';
import HeroBackdrop from '../../components/HeroBackdrop.jsx';
import Marquee from '../../components/Marquee.jsx';
import Reveal from '../../components/Reveal.jsx';
import FeedbackSection from '../../components/FeedbackSection.jsx';
import ProductCard, { ProductSheet } from '../../components/ProductCard.jsx';
import { ErrorBox, PageLoader } from '../../components/ui.jsx';
import { rupees } from '../../utils/format.js';

const offerText = (o) => (o.type === 'percent' ? `${o.value}% OFF` : `${rupees(o.value)} OFF`);
const container = { hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } } };
const item = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } } };

export default function Home() {
  const { menu, loading, error, reload } = useMenu();
  const [open, setOpen] = useState(null);
  if (loading && !menu) return <div className="mx-auto max-w-5xl px-4 py-5"><PageLoader label="Heating up the steamer…" /></div>;
  if (error && !menu) return <div className="mx-auto max-w-5xl px-4 py-5"><ErrorBox error={error} onRetry={reload} /></div>;

  const available = menu.products.filter((p) => p.isAvailable);
  const featured = menu.products.filter((p) => p.isFeatured && p.isAvailable);
  const popular = (featured.length ? featured : available).slice(0, 4);

  return (
    <>
      {/* Full-width hero: video in the background, animated text on top */}
      <section className="relative flex min-h-[72vh] items-end overflow-hidden text-white sm:min-h-[60vh]">
        <HeroBackdrop />
        <motion.div variants={container} initial="hidden" animate="show" className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-10 pt-24 sm:pb-14">
          <motion.span variants={item} className={`badge ${menu.outlet.isOpen ? 'bg-white/20' : 'bg-black/40'} text-white backdrop-blur`}><FiClock className="mr-1" />{menu.outlet.isOpen ? 'Open now' : 'Closed right now'}</motion.span>
          <motion.h1 variants={item} className="mt-3 max-w-2xl text-5xl font-bold leading-[1.05] sm:text-7xl">{menu.business.name}</motion.h1>
          <motion.p variants={item} className="mt-3 max-w-md font-display text-lg italic text-white/90 sm:text-xl">{menu.business.tagline}</motion.p>
          {menu.outlet.address && <motion.p variants={item} className="mt-1 text-sm text-white/80">📍 {menu.outlet.address}</motion.p>}
          <motion.div variants={item}>
            <Link to="/menu" className="btn btn-lg relative mt-6 overflow-hidden bg-white text-night hover:bg-white/90">
              <span className="pointer-events-none absolute inset-y-0 left-0 w-1/4 animate-shine bg-white/60 blur-sm" aria-hidden="true" />
              Order now <FiArrowRight className="animate-bob" />
            </Link>
          </motion.div>
        </motion.div>
      </section>
      <Marquee items={['Fresh & hot', 'Steamed to order', 'Made in front of you', 'Dine in or take away']} />

      <div className="mx-auto max-w-5xl space-y-10 px-4 py-8">
        {menu.offers.length > 0 && (
          <Reveal>
            <section aria-label="Offers">
              <h2 className="mb-3 text-2xl font-bold">Offers for you</h2>
              <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
                {menu.offers.map((o) => (
                  <motion.div key={o.code} whileHover={{ y: -4 }} className="card min-w-[250px] border-l-4 border-saffron p-4">
                    <p className="text-xl font-bold text-brand-600">{offerText(o)}</p>
                    <p className="text-sm font-semibold">{o.title}</p>
                    {o.description && <p className="text-xs text-ink-soft">{o.description}</p>}
                    <p className="mt-2 inline-block rounded-md border border-dashed border-ink/30 px-2 py-0.5 font-mono text-sm font-bold tracking-wider">{o.code}</p>
                  </motion.div>
                ))}
              </div>
            </section>
          </Reveal>
        )}

        <section aria-label="Popular momos">
          <Reveal><div className="mb-3 flex items-end justify-between"><h2 className="text-2xl font-bold">Popular momos</h2><Link to="/menu" className="text-sm font-semibold text-brand-600">See full menu</Link></div></Reveal>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {popular.map((p, i) => <Reveal key={p.id} delay={i * 0.08}><motion.div whileHover={{ y: -4 }} className="h-full"><ProductCard product={p} onOpen={setOpen} /></motion.div></Reveal>)}
          </div>
        </section>

        <section aria-label="How it works" className="grid gap-3 sm:grid-cols-3">
          {[[FiSmartphone, 'Scan & choose', 'Scan the QR at the cart and pick your momos.'], [FiShoppingBag, 'Order & pay', 'Pay with cash, UPI or online. Your PIN is on the order page.'], [FiCheckCircle, 'Collect', 'Watch the status live. Tell the staff your PIN when it is Ready.']].map(([Icon, t, d], i) => (
            <Reveal key={t} delay={i * 0.1}>
              <div className="card flex h-full gap-3 p-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-600"><Icon /></span><div><p className="font-semibold">{t}</p><p className="text-sm text-ink-soft">{d}</p></div></div>
            </Reveal>
          ))}
        </section>

        <Reveal><FeedbackSection /></Reveal>
      </div>
      <ProductSheet product={open} onClose={() => setOpen(null)} />
    </>
  );
}
