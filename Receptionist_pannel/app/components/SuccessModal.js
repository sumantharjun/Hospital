"use client";
export default function SuccessModal({ open, title = "Success", message, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-emerald-200 dark:border-emerald-800 max-w-md w-full p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{title}</h3>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
        >
          OK
        </button>
      </div>
    </div>
  );
}
