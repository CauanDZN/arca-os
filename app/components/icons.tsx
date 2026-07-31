type IconProps = { className?: string };

export function FolderIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.5 7a2 2 0 0 1 2-2h4.379a2 2 0 0 1 1.414.586L12.914 7H18.5a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V7Z"
      />
    </svg>
  );
}

export function DocumentIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 3.5h7l3.5 3.5V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3.5V7h3.5" />
    </svg>
  );
}

export function TrendingUpIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 16.5 9 11l4 4 7.5-7.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 7h5.5v5.5" />
    </svg>
  );
}

export function SparklesIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11 3.5 12.4 8l4.6 1.3-4.6 1.3L11 15l-1.3-4.4L5 9.3l4.7-1.3L11 3.5Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 14.5l.8 2.4 2.4.8-2.4.8-.8 2.4-.8-2.4-2.4-.8 2.4-.8.8-2.4Z" />
    </svg>
  );
}

export function PlugIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3.5v4M15 3.5v4" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.5 7.5h11V11a5.5 5.5 0 0 1-5.5 5.5v0A5.5 5.5 0 0 1 6.5 11V7.5Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V21" />
    </svg>
  );
}

export function SearchIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <circle cx="10.5" cy="10.5" r="6.5" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 20l-4.5-4.5" />
    </svg>
  );
}

export function ListChecksIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6.5l1.5 1.5L8 5.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 13.5l1.5 1.5L8 12.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 6.5h9M11 13.5h9M11 19.5h9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 19.5l1.5 1.5L8 18.5" />
    </svg>
  );
}

export function PlayCircleIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.2 9v6l5-3-5-3Z" />
    </svg>
  );
}

export function BuildingIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <rect x="5" y="3.5" width="10" height="17" rx="1" />
      <path strokeLinecap="round" d="M9 7h2M9 10.5h2M9 14h2M15 10.5h4v10H5" />
    </svg>
  );
}

export function UsersIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <circle cx="9" cy="8" r="3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.5 6.2a3 3 0 0 1 0 5.6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 14.2a5.5 5.5 0 0 1 4 5.3" />
    </svg>
  );
}

export function DragHandleIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}

export function EmptyBoxIcon({ className = "w-10 h-10" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.5 8.5 12 4l8.5 4.5L12 13 3.5 8.5Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 8.5V16l8.5 4.5 8.5-4.5V8.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 13v7.5" />
    </svg>
  );
}

export function DashboardIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 13h6V4H4v9Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 20h6v-9h-6v9Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 20h6v-4H4v4Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 4v4h6V4h-6Z" />
    </svg>
  );
}

export function PortalIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-7.5l-3.5 2.5V19.5H6a2 2 0 0 1-2-2v-11Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 13.5h5" />
    </svg>
  );
}
