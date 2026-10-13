import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiCheck, FiSend, FiStar } from 'react-icons/fi';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Field, Spinner } from './ui.jsx';

const WORDS = ['', 'Poor', 'Could be better', 'Good', 'Very good', 'Loved it!'];

export default function FeedbackSection() {
  const { user } = useAuth();
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const shown = hover || rating;

  const send = async (e) => {
    e.preventDefault();
    if (!rating) return toast.error('Please tap a star rating');
    setBusy(true);
    try {
      await api.post('/public/feedback', { rating, message: message.trim(), name: name.trim() || undefined });
      setDone(true); setRating(0); setMessage('');
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  return (
    <section aria-label="Feedback" className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 p-5 text-white sm:p-8">
      <div className="mx-auto max-w-xl">
        <h2 className="text-2xl font-bold sm:text-3xl">How was your momo experience?</h2>
        <p className="mt-1 text-sm text-white/85">Tell us what we did well and what we can do better. We read every message.</p>
        <AnimatePresence mode="wait">
          {done ? (
            <motion.div key="thanks" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="mt-6 rounded-2xl bg-white/15 p-6 text-center">
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 12 }} className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-white text-brand-600"><FiCheck className="h-7 w-7" /></motion.span>
              <p className="text-lg font-bold">Thank you!</p><p className="text-sm text-white/85">Your feedback reached the team.</p>
              <button className="btn mt-4 bg-white/20 text-white hover:bg-white/30" onClick={() => setDone(false)}>Send another</button>
            </motion.div>
          ) : (
            <motion.form key="form" onSubmit={send} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-5 space-y-4">
              <div className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label="Rating out of 5" onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <motion.button type="button" key={n} role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`}
                    whileHover={{ scale: 1.2, rotate: -6 }} whileTap={{ scale: 0.85 }} onMouseEnter={() => setHover(n)} onClick={() => setRating(n)} className="p-1">
                    <FiStar className={`h-9 w-9 transition ${n <= shown ? 'fill-saffron text-saffron' : 'text-white/60'}`} />
                  </motion.button>
                ))}
                <span className="ml-2 text-sm font-semibold" aria-live="polite">{WORDS[shown]}</span>
              </div>
              <Field label={<span className="text-white/90">Your feedback</span>}>
                <textarea className="input min-h-[96px] resize-y" required minLength={3} maxLength={1000} placeholder="What did you like? What can we improve?" value={message} onChange={(e) => setMessage(e.target.value)} />
              </Field>
              {!user && <Field label={<span className="text-white/90">Your name (optional)</span>}><input className="input" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></Field>}
              <button className="btn btn-lg w-full bg-white text-night hover:bg-white/90 sm:w-auto" disabled={busy}>{busy ? <Spinner /> : <><FiSend /> Send feedback</>}</button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
