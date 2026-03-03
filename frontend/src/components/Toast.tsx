import { useEffect } from "react";

export type ToastItem = {
  id: string;
  title: string;
  message?: string;
  kind?: "success" | "error" | "info";
};

type ToastStackProps = {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
};

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  useEffect(() => {
    if (!toasts.length) {
      return;
    }
    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        onDismiss(toast.id);
      }, 3500)
    );
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [toasts, onDismiss]);

  return (
    <div className="toast-root" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <article key={toast.id} className={`toast toast-${toast.kind ?? "info"}`}>
          <div className="toast-title">{toast.title}</div>
          {toast.message && <div className="toast-msg">{toast.message}</div>}
        </article>
      ))}
    </div>
  );
}
