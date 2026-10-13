import { useRef, useState } from 'react';

// Background for the home hero: a muted video that plays one clip after another.
//  - Put your clips in  client/public/  named  hero-family.mp4  and  hero-students.mp4  (see README-hero-video.txt there).
//  - Or set VITE_HERO_VIDEOS in client/.env to your own list, e.g. /a.mp4,/b.mp4
//  - A missing clip is skipped. If none play (or the phone is on Data Saver), a warm animated gradient is shown instead.
const LIST = (import.meta.env.VITE_HERO_VIDEOS || '/hero-family.mp4,/hero-students.mp4,/hero.mp4').split(',').map((s) => s.trim()).filter(Boolean);
const DOTS = [[6, 0], [18, 5], [30, 2], [44, 8], [58, 3], [70, 10], [82, 6], [92, 1]];
const skipVideo = () => typeof navigator !== 'undefined'
  && (navigator.connection?.saveData || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

export default function HeroBackdrop() {
  const bad = useRef(new Set());
  const [idx, setIdx] = useState(0);
  const [none, setNone] = useState(skipVideo());
  const next = (from) => { for (let k = 1; k <= LIST.length; k += 1) { const j = (from + k) % LIST.length; if (!bad.current.has(j)) return j; } return null; };
  const onError = () => { bad.current.add(idx); const n = next(idx); if (n === null) setNone(true); else setIdx(n); };
  const onEnded = () => { const n = next(idx); if (n !== null) setIdx(n); };
  const single = LIST.length - bad.current.size <= 1;

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 animate-gradient bg-[linear-gradient(120deg,#702714,#d44410,#8a2c14,#201915)] bg-[length:300%_300%]" />
      {!none && <video key={idx} className="absolute inset-0 h-full w-full object-cover" src={LIST[idx]} autoPlay muted loop={single} playsInline preload="metadata" onError={onError} onEnded={onEnded} />}
      {none && DOTS.map(([left, delay], i) => (
        <span key={i} className="absolute bottom-[-3rem] animate-floaty select-none text-4xl sm:text-5xl" style={{ left: `${left}%`, animationDelay: `-${delay}s`, animationDuration: `${12 + (i % 4) * 3}s` }}>🥟</span>
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/30" />
    </div>
  );
}
