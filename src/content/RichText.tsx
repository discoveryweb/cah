import { Fragment, type ElementType } from "react";

/**
 * Tiny inline markup for editable copy: *accent* and **strong**.
 * Keeps admins away from raw HTML while still allowing the designed emphasis.
 */
const TOKEN = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;

export function renderRichText(text: string) {
  return text.split(TOKEN).map((chunk, index) => {
    if (chunk.startsWith("**") && chunk.endsWith("**") && chunk.length > 4) {
      return <strong key={index}>{chunk.slice(2, -2)}</strong>;
    }
    if (chunk.startsWith("*") && chunk.endsWith("*") && chunk.length > 2) {
      return (
        <span className="accent" key={index}>
          {chunk.slice(1, -1)}
        </span>
      );
    }
    return <Fragment key={index}>{chunk}</Fragment>;
  });
}

export function RichText({
  text,
  as: Tag = "span",
  className,
}: {
  text: string;
  as?: ElementType;
  className?: string;
}) {
  return <Tag className={className}>{renderRichText(text)}</Tag>;
}

/** Strip the inline markup for places that cannot render JSX (meta, aria). */
export const plainText = (text: string) => text.replace(/\*\*/g, "").replace(/\*/g, "");
