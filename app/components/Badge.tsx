import type { BadgeTone } from "@/lib/badge-tones";

const TONE_CLASSES: Record<BadgeTone, string> = {
  critical: "bg-red-50 text-red-700 border-red-200",
  serious: "bg-orange-50 text-orange-700 border-orange-200",
  warning: "bg-amber-50 text-amber-800 border-amber-200",
  managed: "bg-blue-50 text-blue-700 border-blue-200",
  good: "bg-green-50 text-green-700 border-green-200",
  neutral: "bg-slate-100 text-slate-600 border-slate-200",
};

export function Badge({ text, tone }: { text: string; tone: BadgeTone }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${TONE_CLASSES[tone]}`}
    >
      {text}
    </span>
  );
}
