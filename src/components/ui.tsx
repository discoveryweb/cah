import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { ArrowUpLeft } from "lucide-react";
import cahenMark from "../assets/cahen-mark.png";
import { cn } from "../utils/cn";

/** The supplied CAHEN identity mark, keyed to a transparent raster asset. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <img
      src={cahenMark}
      alt=""
      aria-hidden="true"
      width={736}
      height={600}
      decoding="async"
      draggable={false}
      className={cn("brand__logo", className)}
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
      { threshold: 0.06, rootMargin: "0px 0px -6% 0px" }
    );
    observer.observe(element);

    // Content should remain available if an observer is throttled or unavailable.
    const safetyTimer = window.setTimeout(() => element.classList.add("is-visible"), 6000);
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
    <span className={cn("badge", className)}>
      <span className="badge__signal" aria-hidden="true" />
      {children}
    </span>
  );
}

export function SectionHead({
  badge,
  index,
  title,
  intro,
  id,
}: {
  badge: ReactNode;
  index: string;
  title: ReactNode;
  intro: ReactNode;
  id?: string;
}) {
  return (
    <div className="section-head">
      <span className="section-ghost" aria-hidden="true" dir="ltr">{index}</span>
      <div className="section-head__title-group">
        <div className="flex items-center gap-4">
          <SectionBadge>{badge}</SectionBadge>
          <span className="section-index" aria-hidden="true" dir="ltr">
            <strong>{index}</strong> / 05
          </span>
        </div>
        <h2 className="section-title" id={id}>{title}</h2>
      </div>
      <p className="section-intro">{intro}</p>
    </div>
  );
}

type ButtonProps = {
  children: ReactNode;
  variant?: "primary" | "ghost" | "quiet";
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
    "btn",
    variant === "primary" && "btn--primary",
    variant === "ghost" && "btn--ghost",
    variant === "quiet" && "btn--quiet",
    className
  );
  const content = (
    <>
      <span>{children}</span>
      {arrow && <ArrowUpLeft aria-hidden="true" />}
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

export function Marquee({
  items,
  duration = 46,
  reverse = false,
  className,
  itemClassName,
}: {
  items: readonly string[];
  duration?: number;
  reverse?: boolean;
  className?: string;
  itemClassName?: string;
}) {
  return (
    <div
      className={cn("marquee", reverse && "marquee--rtl", className)}
      style={{ "--marquee-duration": `${duration}s` } as CSSProperties}
      aria-hidden="true"
    >
      <div className="marquee__track">
        {[0, 1].map((group) => (
          <div className="marquee__group" key={group}>
            {items.map((item) => (
              <span key={`${group}-${item}`} className={cn("marquee__item", itemClassName)}>
                {item}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
