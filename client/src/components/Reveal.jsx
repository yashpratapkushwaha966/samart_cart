import { motion } from 'framer-motion';

// Fades and slides its content in the first time it scrolls into view.
export default function Reveal({ children, delay = 0, y = 24, className = '' }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.5, delay, ease: 'easeOut' }}>
      {children}
    </motion.div>
  );
}
