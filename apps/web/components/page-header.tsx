import { ReactNode } from 'react';

export function PageHeader({
  kicker,
  title,
  description,
  children,
}: {
  kicker?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-header">
      {kicker && <p className="kicker">{kicker}</p>}
      <h1>{title}</h1>
      {description && <p className="page-desc">{description}</p>}
      {children}
    </header>
  );
}
