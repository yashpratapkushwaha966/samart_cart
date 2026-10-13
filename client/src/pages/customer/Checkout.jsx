import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { FiTag, FiCreditCard, FiSmartphone, FiDollarSign, FiCoffee, FiShoppingBag } from 'react-icons/fi';
import { api } from '../../services/api.js';
import { useCart } from '../../context/CartContext.jsx';
import { useMenu } from '../../context/MenuContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Field, PageLoader, Skeleton, Spinner } from '../../components/ui.jsx';
import { rupees, uuid } from '../../utils/format.js';

const METHODS = {
  cash: { label: 'Cash', hint: 'Pay at the cart when you collect', icon: FiDollarSign },
  upi: { label: 'UPI QR', hint: 'Scan a QR. Staff confirm once they see the payment', icon: FiSmartphone },
  online: { label: 'Pay online', hint: 'Cards, UPI, netbanking and wallets', icon: FiCreditCard },
};

const SERVICE = {
  dine_in: { label: 'Dine in', hint: 'Eat here at the cart', icon: FiCoffee },
  takeaway: { label: 'Take away', hint: 'Carry it home', icon: FiShoppingBag },
};

export default function Checkout() {
  const { user } = useAuth();
  const [serviceType, setServiceType] = useState('');
  const cart = useCart();
  const { menu, loading, slug } = useMenu();
  const toast = useToast();
  const nav = useNavigate();
  const [offerInput, setOfferInput] = useState('');
  const [offerCode, setOfferCode] = useState('');
  const [offerError, setOfferError] = useState('');
  const [method, setMethod] = useState('');
  const [instructions, setInstructions] = useState('');
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState('');
  const [busy, setBusy] = useState(false);
  const idemKey = useRef(uuid());

  const items = useMemo(() => cart.items.map((i) => ({ productId: i.productId, quantity: i.quantity })), [cart.items]);
  // A new key whenever the order content changes, so a retry after an edit is never mistaken for a duplicate.
  useEffect(() => { idemKey.current = uuid(); }, [items, method, offerCode, instructions, serviceType]);

  useEffect(() => {
    if (!menu || items.length === 0) return undefined;
    let stale = false;
    setQuote(null); setQuoteError('');
    api.post('/orders/quote', { outletSlug: menu.outlet.slug, items, offerCode: offerCode || undefined })
      .then((q) => { if (!stale) { setQuote(q); setOfferError(''); } })
      .catch((e) => {
        if (stale) return;
        if (e.code === 'OFFER_INVALID' && offerCode) { setOfferError(e.message); setOfferCode(''); } else setQuoteError(e.message);
      });
    return () => { stale = true; };
  }, [menu, items, offerCode]);

  useEffect(() => { if (quote && !quote.paymentMethods.includes(method)) setMethod(quote.paymentMethods[0] || ''); }, [quote, method]);

  if (loading && !menu) return <PageLoader />;
  if (items.length === 0) return <Navigate to="/cart" replace />;
  if (user && (!user.name || !user.phone)) return <Navigate to="/account/edit?next=/checkout" replace />; // name + contact number are compulsory

  const place = async () => {
    setBusy(true);
    try {
      const { order } = await api.post('/orders', { outletSlug: menu.outlet.slug || slug, items, serviceType, paymentMethod: method, offerCode: offerCode || undefined, instructions: instructions.trim() || undefined, idempotencyKey: idemKey.current });
      cart.clear();
      nav(`/order/${order.id}${method === 'online' ? '?pay=1' : ''}`, { replace: true, state: { justPlaced: true } });
    } catch (e) {
      if (e.code === 'PROFILE_INCOMPLETE') nav('/account/edit?next=/checkout'); else toast.error(e.message);
    } finally { setBusy(false); }
  };

  const bill = quote?.bill;
  const closed = quote && !quote.isOpen;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-3xl font-bold">Checkout</h1>
      {closed && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800" role="alert">This cart is not taking orders right now.</p>}
      {quoteError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{quoteError} <Link to="/cart" className="font-semibold underline">Back to cart</Link></p>}

      <section className="card space-y-3 p-4" aria-label="Order summary">
        <h2 className="text-lg font-bold">Order summary</h2>
        {!bill ? <div className="space-y-2"><Skeleton className="h-5" /><Skeleton className="h-5" /><Skeleton className="h-8" /></div> : (
          <>
            {bill.lines.map((l) => <div key={l.productId} className="flex justify-between text-sm"><span>{l.quantity} × {l.name}</span><span>{rupees(l.lineTotalPaise)}</span></div>)}
            <hr className="border-ink/10" />
            <div className="flex justify-between text-sm"><span>Subtotal</span><span>{rupees(bill.subtotalPaise)}</span></div>
            {bill.discountPaise > 0 && <div className="flex justify-between text-sm font-semibold text-leaf"><span>Offer {bill.offerCode}</span><span>− {rupees(bill.discountPaise)}</span></div>}
            {bill.feePaise > 0 && <div className="flex justify-between text-sm"><span>Packaging</span><span>{rupees(bill.feePaise)}</span></div>}
            {bill.taxPaise > 0 && <div className="flex justify-between text-sm"><span>{bill.taxLabel}</span><span>{rupees(bill.taxPaise)}</span></div>}
            <div className="flex justify-between border-t border-ink/10 pt-2 text-lg font-bold"><span>Total</span><span>{rupees(bill.totalPaise)}</span></div>
          </>
        )}
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-lg font-bold">How would you like your order?</h2>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Dine in or take away">
          {Object.entries(SERVICE).map(([k, v]) => (
            <button key={k} role="radio" aria-checked={serviceType === k} onClick={() => setServiceType(k)}
              className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-center transition ${serviceType === k ? 'border-brand-500 bg-brand-50' : 'border-ink/10'}`}>
              <v.icon className="h-6 w-6 text-brand-600" /><span className="font-semibold">{v.label}</span><span className="text-xs text-ink-soft">{v.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="flex items-center gap-2 text-lg font-bold"><FiTag /> Offer code</h2>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setOfferError(''); setOfferCode(offerInput.trim().toUpperCase()); }}>
          <input className="input uppercase" placeholder="e.g. WELCOME10" value={offerInput} onChange={(e) => setOfferInput(e.target.value)} aria-label="Offer code" />
          <button className="btn btn-dark" type="submit" disabled={!offerInput.trim()}>Apply</button>
        </form>
        {offerError && <p className="text-sm text-red-600" role="alert">{offerError}</p>}
        {offerCode && bill?.offerCode && <p className="text-sm text-leaf">Offer applied. <button className="font-semibold underline" onClick={() => { setOfferCode(''); setOfferInput(''); }}>Remove</button></p>}
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-lg font-bold">Payment method</h2>
        <div className="grid gap-2" role="radiogroup" aria-label="Payment method">
          {(quote?.paymentMethods || []).map((m) => {
            const I = METHODS[m].icon;
            return (
              <button key={m} role="radio" aria-checked={method === m} onClick={() => setMethod(m)}
                className={`flex items-center gap-3 rounded-xl border-2 p-3 text-left transition ${method === m ? 'border-brand-500 bg-brand-50' : 'border-ink/10'}`}>
                <I className="h-5 w-5 text-brand-600" /><span><span className="block font-semibold">{METHODS[m].label}</span><span className="block text-xs text-ink-soft">{METHODS[m].hint}</span></span>
              </button>
            );
          })}
          {quote?.upiComingSoon && (
            <div className="flex items-center gap-3 rounded-xl border-2 border-dashed border-ink/15 p-3 text-left opacity-60" aria-disabled="true">
              <FiSmartphone className="h-5 w-5 text-ink-mute" /><span><span className="block font-semibold">UPI <span className="badge ml-1 bg-ink/10 text-ink-soft">Coming soon</span></span><span className="block text-xs text-ink-soft">Pay with any UPI app. Not switched on yet</span></span>
            </div>
          )}
        </div>
        <Field label="Special instructions (optional)"><textarea className="input" rows={2} maxLength={200} placeholder="Less spicy, extra chutney…" value={instructions} onChange={(e) => setInstructions(e.target.value)} /></Field>
      </section>

      <button className="btn btn-primary btn-lg w-full" disabled={!bill || !method || !serviceType || busy || closed} onClick={place}>
        {busy ? <Spinner /> : !serviceType ? 'Choose dine in or take away' : bill ? `Place order · ${rupees(bill.totalPaise)}` : 'Calculating…'}
      </button>
    </div>
  );
}
