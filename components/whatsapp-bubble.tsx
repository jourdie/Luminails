'use client';

import { useEffect, useState } from 'react';

const normalizePhone = (value: string) => value.replace(/\D/g, '');
const fallback = {
  phone: '6289501086888',
  message: 'Halo Luminails, saya mau konsultasi package dan order.',
};

export function WhatsAppBubble() {
  const [settings, setSettings] = useState(fallback);

  useEffect(() => {
    let active = true;
    fetch('/api/settings/whatsapp', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((value: { phone?: string; message?: string } | null) => {
        if (active && value) setSettings({ phone: value.phone || fallback.phone, message: value.message || fallback.message });
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const phone = normalizePhone(settings.phone);
  const message = encodeURIComponent(settings.message);

  return (
    <a className="whatsapp-bubble" href={`https://wa.me/${phone}?text=${message}`} target="_blank" rel="noreferrer" aria-label="Chat dengan Luminails melalui WhatsApp">
      <span className="whatsapp-bubble-icon" aria-hidden="true">
        <svg viewBox="0 0 48 48" role="presentation">
          <path d="M24 7.5a16.5 16.5 0 0 0-14.2 25L7 40.5l8.4-2.7A16.5 16.5 0 1 0 24 7.5Z" />
          <path d="M17.8 16.8c.4-.5.8-.5 1.2-.5h1c.4 0 .7.2.9.7l1.4 3.3c.2.4.1.8-.2 1.1l-1.1 1.2c-.2.2-.2.5 0 .8.5.9 1.8 2.8 4.7 4.1.4.2.7.1.9-.1l1.4-1.7c.2-.3.6-.4 1-.2l3.2 1.5c.4.2.6.5.5.9-.1 1.1-.6 2.2-1.5 2.8-.8.6-2 .8-3.3.4-1.7-.5-4.1-1.8-6.5-4.2-2.4-2.4-3.8-4.8-4.3-6.5-.4-1.4-.2-2.6.7-3.6Z" />
        </svg>
      </span>
      <span className="whatsapp-bubble-label">Chat via WhatsApp</span>
    </a>
  );
}
