'use client';

import { FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[calc(100vh-200px)] items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-md">
        {/* Icon - 64px, muted color */}
        <div className="flex justify-center text-muted-foreground">
          <FileQuestion className="h-16 w-16" />
        </div>

        {/* Title - responsive sizing */}
        <h1 className="text-3xl md:text-4xl font-bold">Page Not Found</h1>

        {/* Description - muted, larger text */}
        <p className="text-muted-foreground text-lg">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Let&apos;s get you back on track.
        </p>

        {/* Navigation buttons - responsive layout */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg">
            <Link href="/">Go to Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
