import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { ArrowUpLeft } from "lucide-react";
import cahenMark from "../assets/cahen-mark.png";
import { cn } from "../utils/cn";

/** The supplied CAHEN identity mark, keyed to a transparent raster asset. */
export function LogoMark({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <img
      src={cahenMark}
      alt=""
      aria-hidden="true"
      width={736}
      height={600}
      decoding="async"
      draggable={false}
      className={cn("brand-logo shrink-0 select-none object-contain", className)}
    />
  );
}

export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "li" | "article";
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (typeof IntersectionObserver === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      element.classList.add("is-visible");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -4% 0px" }
    );
    observer.observe(element);

    // Content should remain available if an observer is throttled or unavailable.
    const safetyTimer = window.setTimeout(() => element.classList.add("is-visible"), 5000);
    return () => {
      observer.disconnect();
      window.clearTimeout(safetyTimer);
    };
  }, []);

  const style = { "--d": `${delay}ms` } as CSSProperties;
  const Component = Tag as "div";
  return (
    <Component ref={ref as React.RefObject<HTMLDivElement>} className={cn("reveal", className)} style={style}>
      {children}
    </Component>
  );
}

export function SectionBadge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("section-badge", className)}>
      <span className="section-badge__dot" aria-hidden="true" />
      {children}
    </span>
  );
}

type ButtonProps = {
  children: ReactNode;
  variant?: "primary" | "outline" | "quiet";
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  className?: string;
  arrow?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
};

export function Button({
  children,
  variant = "primary",
  href,
  onClick,
  type = "button",
  className,
  arrow = true,
  disabled,
  ariaLabel,
}: ButtonProps) {
  const classes = cn(
    "action-button group inline-flex min-h-12 items-center justify-center gap-2.5 rounded-2xl px-6 text-sm font-semibold transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60",
    variant === "primary" && "action-button--primary",
    variant === "outline" && "action-button--outline",
    variant === "quiet" && "action-button--quiet",
    className
  );
  const content = (
    <>
      <span>{children}</span>
      {arrow && <ArrowUpLeft className="action-button__arrow h-4 w-4 transition-transform duration-300" aria-hidden="true" />}
    </>
  );

  if (href) {
    return (
      <a href={href} onClick={onClick} className={classes} aria-label={ariaLabel}>
        {content}
      </a>
    );
  }

  return (
    <button type={type} onClick={onClick} className={classes} disabled={disabled} aria-label={ariaLabel}>
      {content}
    </button>
  );
}
