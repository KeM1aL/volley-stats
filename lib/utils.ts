import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function chunk<T>(array: T[], chunkSize:number) {
  const length = Math.ceil(array.length / chunkSize)
  const chunks = new Array(length).fill(0);
  return chunks.map((_, index) => {
      const start = index * chunkSize;
      const end = (index + 1) * chunkSize;
      return array.slice(start, end);
  })
}