'use client';

import { useActionState } from 'react';
import { cancelCheckoutOrder, type CheckoutActionState } from '../app/checkout/actions';

const initialState: CheckoutActionState = { ok: false, message: '' };

export function CancelOrderForm({ orderId }: { orderId: string }) {
  const [state, formAction, pending] = useActionState(cancelCheckoutOrder, initialState);
  return <form action={formAction} onSubmit={(event) => { if (!window.confirm('Batalkan order ini? Tindakan ini tidak dapat dibatalkan.')) event.preventDefault(); }}><input type="hidden" name="order_id" value={orderId} /><button className="underlined-link" type="submit" disabled={pending}>{pending ? 'Membatalkan...' : 'Batalkan order'}</button>{state.message && <small className={state.ok ? 'action-success' : 'action-error'} role="status" aria-live="polite">{state.message}</small>}</form>;
}
