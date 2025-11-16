import { ReactNode } from 'react';

export default function LiveMatchLayout({
  children,
}: {
  children: ReactNode;
}) {
  // This layout uses fixed positioning to completely break out of the parent's scroll context
  // The navigation header is h-14 (56px), so we offset by top-14
  return (
    <div className="fixed inset-0 top-14 bg-background overflow-hidden">
      <div className="h-full px-2 py-1">
        {children}
      </div>
    </div>
  );
}
