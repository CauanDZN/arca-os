"use client";

import { useFormStatus } from "react-dom";

type Props = {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
};

/**
 * Drop-in replacement for <button type="submit">. useFormStatus() only
 * reports the nearest ancestor <form>'s pending state to descendants that
 * are themselves Client Components — a plain button in a Server Component
 * page has no way to know a Server Action is in flight, which is why every
 * submit across the app used to give zero feedback while Gemini/DB calls ran.
 */
export function SubmitButton({ children, pendingText, className = "" }: Props) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`inline-flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-wait transition-opacity ${className}`}
    >
      {pending && (
        <svg className="h-3.5 w-3.5 animate-spin shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}
