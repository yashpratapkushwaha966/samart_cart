import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useMenu } from '../../context/MenuContext.jsx';

// The printed QR code opens /c/<cart-slug>. We remember the cart and go straight to its menu.
export default function QrEntry() {
  const { slug } = useParams();
  const { setSlug } = useMenu();
  useEffect(() => { setSlug(slug.toLowerCase()); }, [slug, setSlug]);
  return <Navigate to="/menu" replace />;
}
