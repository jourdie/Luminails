'use client';

import { useState, type InputHTMLAttributes } from 'react';

type IdrInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'defaultValue' | 'onChange'> & {
  name: string;
  defaultValue?: number | string | null;
};

function formatIDR(value: number | string | null | undefined) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits ? new Intl.NumberFormat('id-ID').format(Number(digits)) : '';
}

export function IdrInput({ defaultValue, ...props }: IdrInputProps) {
  const [value, setValue] = useState(() => formatIDR(defaultValue));
  return <input {...props} type="text" inputMode="numeric" value={value} onChange={(event) => setValue(formatIDR(event.target.value))} />;
}