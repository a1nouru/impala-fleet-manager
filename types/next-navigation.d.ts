declare module 'next/navigation' {
  import { NextRouter } from 'next/router';
  export function useRouter(): NextRouter;
  export function usePathname(): string;
  export function useSearchParams(): URLSearchParams;
  // Add other exports as needed
} 