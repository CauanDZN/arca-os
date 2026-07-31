"use client";

import { useFormStatus } from "react-dom";

/**
 * Submit button com confirmação via confirm() nativo — usado em ações
 * destrutivas (excluir usuário, excluir empresa). O onClick roda antes do
 * submit; se o usuário cancelar, o preventDefault aborta o envio.
 */
export function ConfirmButton({
  children,
  confirmText,
  pendingText = "Excluindo...",
  className = "",
}: {
  children: React.ReactNode;
  confirmText: string;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      onClick={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
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
      {pending ? pendingText : children}
    </button>
  );
}
