// Builds a standard UPI payment link: works as a QR payload and as a tap-to-pay link on phones.
export function buildUpiUri({ vpa, payeeName, amountPaise, note, reference }) {
  const params = new URLSearchParams();
  params.set('pa', vpa);
  params.set('pn', payeeName || 'Smart Momos');
  params.set('am', (amountPaise / 100).toFixed(2));
  params.set('cu', 'INR');
  if (note) params.set('tn', note);
  if (reference) params.set('tr', reference);
  return `upi://pay?${params.toString()}`;
}
