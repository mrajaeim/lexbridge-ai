'use client';

import { Shell } from '../../components/shell';
import { ReactNode } from 'react';

export default function AppLayout({ children }: { children: ReactNode }) {
  return <Shell>{children}</Shell>;
}
