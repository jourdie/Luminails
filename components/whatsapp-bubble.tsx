const normalizePhone = (value: string) => value.replace(/\D/g, '');

export function WhatsAppBubble() {
  const phone = normalizePhone(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '');
  if (!phone) return null;

  const message = encodeURIComponent(process.env.NEXT_PUBLIC_WHATSAPP_MESSAGE ?? 'Halo Luminails, saya mau konsultasi produk dan order.');
  return <a className="whatsapp-bubble" href={`https://wa.me/${phone}?text=${message}`} target="_blank" rel="noreferrer" aria-label="Chat dengan Luminails melalui WhatsApp"><span className="whatsapp-bubble-icon" aria-hidden="true">WA</span><span className="whatsapp-bubble-label">Chat WhatsApp</span></a>;
}
