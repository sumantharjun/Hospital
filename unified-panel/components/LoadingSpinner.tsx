interface SpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  white?: boolean;
}

export default function LoadingSpinner({ className = "", size = "md", white }: SpinnerProps) {
  const sizeClasses: Record<string, string> = {
    sm: "w-5 h-5 border-2",
    md: "w-8 h-8 border-2",
    lg: "w-12 h-12 border-[3px]",
  };
  const colorClasses = white
    ? "border-white/30 border-t-white"
    : "border-zinc-300 border-t-[#0ea5a4]";
  return (
    <div
      className={`animate-spin rounded-full border-solid ${sizeClasses[size]} ${colorClasses} ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

export function LoadingOverlay({ text = "Loading…" }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <LoadingSpinner size="lg" />
      <p className="text-sm text-zinc-500">{text}</p>
    </div>
  );
}
