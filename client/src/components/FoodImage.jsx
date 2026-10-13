import { useState } from 'react';

// Shows the product photo. If there is no photo yet (or it fails to load) a warm placeholder is shown,
// so the layout never breaks. Add real photos in Admin > Menu.
export default function FoodImage({ src, alt, className = '' }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-brand-100 via-saffron/30 to-brand-200 ${className}`} role="img" aria-label={alt}>
        <span className="select-none text-5xl drop-shadow-sm" aria-hidden="true">🥟</span>
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setBroken(true)} className={`object-cover ${className}`} />;
}
