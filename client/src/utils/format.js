export const rupees = (paise = 0) =>
  `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
export const toPaise = (rupeeText) => Math.round(Number(rupeeText) * 100);
export const toRupeeText = (paise = 0) => String(paise / 100);

export const timeOf = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
export const dateTime = (d) => new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
export const minutesAgo = (d) => Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 60000));

// randomUUID only exists on https/localhost; a phone opening the dev site over Wi-Fi needs the fallback.
export const uuid = () => {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  const b = new Uint8Array(16);
  (globalThis.crypto || { getRandomValues: (a) => a.forEach((_, i) => { a[i] = Math.floor(Math.random() * 256); }) }).getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
};

export const SERVICE_LABEL = { dine_in: 'Dine in', takeaway: 'Take away' };
export const METHOD_LABEL = { cash: 'Cash', upi: 'UPI QR', online: 'Online' };
export const loadScript = (src) =>
  new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('Could not load payment window. Check your internet.'));
    document.body.appendChild(s);
    return undefined;
  });
export const safeStorage = {
  get: (k, fallback) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked: ignore */ } },
};
