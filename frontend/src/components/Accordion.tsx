import { ReactNode, useState } from "react";

type AccordionProps = {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  right?: ReactNode;
};

export function Accordion({ title, children, defaultOpen = false, right }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="accordion">
      <button
        type="button"
        className="accordion-btn"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <span>{title}</span>
        <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          {right}
          <span aria-hidden="true">{open ? "-" : "+"}</span>
        </span>
      </button>
      {open && <div className="accordion-content">{children}</div>}
    </section>
  );
}
