import {
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { ArrowUpLeft } from "lucide-react";
import cahenMark from "../assets/cahen-mark.webp";
import { cn } from "../utils/cn";
import { toRoman } from "../utils/roman";

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
      className={cn("brand__mark", className)}
    />
  );
}

export function Brand({ sub = "DIGITAL STUDIO" }: { sub?: string }) {
  return (
    <>
      <LogoMark />
      <span className="brand__type">
        <span className="brand__word" dir="ltr">
          CAHEN
        </span>
        <span className="brand__sub" dir="ltr">
          {sub}
        </span>
      </span>
    </>
  );
}

type RevealVariant = "up" | "mask" | "scale";

export function Reveal({
  children,
  className,
  delay = 0,
  variant = "up",
  as: Tag = "div",
  threshold = 0.08,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  variant?: RevealVariant;
  as?: "div" | "section" | "li" | "article" | "span" | "figure" | "header";
  threshold?: number;
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const timers: number[] = [];

    /**
     * `will-change` is a promise to the compositor that a layer is worth
     * keeping. Once the reveal has played out the promise is worthless, and
     * every element that keeps it holds a full-size GPU texture for the rest of
     * the session — dozens of them across this page. `reveal--settled` hands
     * it back.
     */
    const revealNow = (target: HTMLElement) => {
      target.classList.add("reveal--visible");
      timers.push(window.setTimeout(() => target.classList.add("reveal--settled"), 1200));
    };

    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      revealNow(element);
      return () => timers.forEach((timer) => window.clearTimeout(timer));
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            revealNow(entry.target as HTMLElement);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold, rootMargin: "0px 0px -6% 0px" }
    );
    observer.observe(element);

    // Content must remain available if an observer is throttled or unavailable.
    timers.push(window.setTimeout(() => revealNow(element), 6000));
    return () => {
      observer.disconnect();
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [threshold]);

  const style = { "--reveal-delay": `${delay}ms` } as CSSProperties;
  const Component = Tag as "div";
  return (
    <Component
      ref={ref as RefObject<HTMLDivElement>}
      className={cn("reveal", className)}
      data-variant={variant}
      style={style}
    >
      {children}
    </Component>
  );
}

/** Word-by-word entrance used on the studio statement. */
export function SplitText({
  text,
  className,
  stagger = 26,
}: {
  text: string;
  className?: string;
  stagger?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      element.classList.add("split--visible");
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          element.classList.add("split--visible");
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(element);
    const timer = window.setTimeout(() => element.classList.add("split--visible"), 6000);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <span ref={ref} className={cn("split", className)}>
      {text.split(" ").map((word, index) => (
        <span className="split__word" key={`${word}-${index}`}>
          <span style={{ "--word-delay": `${index * stagger}ms` } as CSSProperties}>{word}</span>
          {" "}
        </span>
      ))}
    </span>
  );
}

/** Roman numeral used for section and item indices across the site. */
export function Numeral({
  value,
  className,
  suffix,
}: {
  value: string | number;
  className?: string;
  suffix?: string;
}) {
  return (
    <span className={cn("numeral", className)} dir="ltr">
      {toRoman(value)}
      {suffix ? <span className="numeral__suffix">{suffix}</span> : null}
    </span>
  );
}

export function SectionHead({
  index,
  label,
  latin,
  title,
  note,
  id,
  className,
}: {
  index: string;
  label: string;
  latin: string;
  title: ReactNode;
  note?: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <Reveal className={cn("section-head", className)} as="header">
      <div className="section-head__aside">
        <span className="section-head__index">
          <Numeral value={index} className="numeral--section" />
          <span className="section-head__rule" aria-hidden="true" />
          <span className="section-head__label">{label}</span>
        </span>
        <span className="label label--plain" dir="ltr">
          {latin}
        </span>
      </div>
      <div>
        <h2 className="section-head__title" id={id}>
          {title}
        </h2>
        {note ? <p className="section-head__note">{note}</p> : null}
      </div>
    </Reveal>
  );
}

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
}: {
  children: ReactNode;
  variant?: "primary" | "light";
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  className?: string;
  arrow?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const classes = cn("btn", variant === "light" && "btn--light", className);
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

/** Slight magnetic pull toward the pointer — used on primary calls to action. */
export function Magnetic({
  children,
  strength = 10,
  className,
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  const onMove = useCallback(
    (event: ReactPointerEvent<HTMLSpanElement>) => {
      const node = ref.current;
      if (!node) return;
      if (window.matchMedia("(hover: none)").matches) return;
      const rect = node.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      node.style.transform = `translate(${(x * strength).toFixed(2)}px, ${(y * strength).toFixed(2)}px)`;
    },
    [strength]
  );

  const reset = useCallback(() => {
    const node = ref.current;
    if (node) node.style.transform = "";
  }, []);

  return (
    <span
      ref={ref}
      className={cn("magnetic", className)}
      onPointerMove={onMove}
      onPointerLeave={reset}
      onBlur={reset}
    >
      {children}
    </span>
  );
}

export function Marquee({
  items,
  speed = 44,
  reverse = false,
  className,
}: {
  items: readonly string[];
  speed?: number;
  reverse?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn("marquee", className)}
      style={{ "--speed": `${speed}s` } as CSSProperties}
      aria-hidden="true"
    >
      <div
        className="marquee__track"
        style={reverse ? { animationDirection: "reverse" } : undefined}
      >
        {[0, 1].map((group) => (
          <div className="marquee__group" key={group}>
            {items.map((item) => (
              <span key={`${group}-${item}`} className="marquee__item">
                {item}
                <img
                  className="marquee__sep"
                  src={cahenMark}
                  alt=""
                  width={736}
                  height={600}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ArrowLabel({ children }: { children: ReactNode }) {
  return (
    <span className="link-arrow">
      <span>{children}</span>
      <ArrowUpLeft aria-hidden="true" />
    </span>
  );
}
