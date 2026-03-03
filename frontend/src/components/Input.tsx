import { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
};

export function Input({ label, hint, className = "", ...props }: InputProps) {
  return (
    <label className="field">
      {label && <span className="field-label">{label}</span>}
      <input className={`input ${className}`.trim()} {...props} />
      {hint && <span className="muted-text">{hint}</span>}
    </label>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
};

export function Textarea({ label, hint, className = "", ...props }: TextareaProps) {
  return (
    <label className="field">
      {label && <span className="field-label">{label}</span>}
      <textarea className={`textarea ${className}`.trim()} {...props} />
      {hint && <span className="muted-text">{hint}</span>}
    </label>
  );
}
