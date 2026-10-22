import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, LoaderCircle, Search, Upload } from "lucide-react";
import type { MediaEntry, SiteContent } from "../content/types";
import { api, ApiFailure, prepareImage } from "./api";
import { formatBytes, formatDate } from "./draft";
import { ConfirmButton, useToast } from "./ui";

interface Props {
  media: MediaEntry[];
  content: SiteContent;
  onRefresh: () => Promise<void> | void;
  disabled: boolean;
  uploadSignal?: number;
}

export function MediaLibrary({ media, content, onRefresh, disabled, uploadSignal = 0 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (uploadSignal > 0 && !disabled) inputRef.current?.click();
  }, [uploadSignal, disabled]);

  const serialized = useMemo(() => JSON.stringify(content), [content]);

  const used = (name: string) => serialized.includes(`/media/${name}`);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? media.filter((entry) => entry.name.toLowerCase().includes(needle)) : media;
  }, [media, query]);

  const upload = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (list.length === 0) {
      toast("فقط فایل تصویری قابل بارگذاری است.", "error");
      return;
    }
    setBusy(true);
    let failures = 0;
    for (const file of list) {
      try {
        const prepared = await prepareImage(file);
        await api.upload(prepared, file.name.replace(/\.[^.]+$/, ""));
      } catch (error) {
        failures += 1;
        toast(error instanceof ApiFailure ? error.message : `بارگذاری ${file.name} انجام نشد.`, "error");
      }
    }
    setBusy(false);
    await onRefresh();
    if (failures === 0) toast(list.length === 1 ? "تصویر بارگذاری شد." : `${list.length} تصویر بارگذاری شد.`);
  };

  const remove = async (name: string) => {
    try {
      await api.deleteMedia(name);
      await onRefresh();
      toast("تصویر حذف شد.");
    } catch (error) {
      toast(error instanceof ApiFailure ? error.message : "حذف انجام نشد.", "error");
    }
  };

  const copy = async (name: string) => {
    const url = `${window.location.origin}/media/${name}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(name);
      window.setTimeout(() => setCopied((current) => (current === name ? null : current)), 1800);
      toast("نشانی تصویر کپی شد.");
    } catch {
      toast("کپی خودکار ممکن نشد؛ نشانی را دستی بردارید.", "error");
    }
  };

  return (
    <div className="acard">
      <div className="acard__head">
        <div>
          <span className="aeyebrow" dir="ltr">
            MEDIA / LIBRARY
          </span>
          <h2>کتابخانهٔ تصاویر</h2>
          <p>
            تصاویر پیش از بارگذاری به WebP تبدیل و کوچک می‌شوند. {media.length} فایل در کتابخانه است.
          </p>
        </div>
        <button
          type="button"
          className="abtn abtn--primary"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || busy}
        >
          {busy ? <LoaderCircle style={{ animation: "spin 1s linear infinite" }} /> : <Upload />}
          بارگذاری
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          multiple
          hidden
          onChange={(event) => {
            if (event.target.files) void upload(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      <div
        className="adropzone"
        data-dragging={dragging}
        onDragOver={(event) => {
          if (disabled) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (disabled) return;
          if (event.dataTransfer.files?.length) void upload(event.dataTransfer.files);
        }}
      >
        <Upload />
        <span>تصاویر را اینجا رها کنید — چند فایل هم‌زمان مجاز است.</span>
      </div>

      <div className="atoolbar">
        <div className="asearch">
          <Search />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="جست‌وجوی نام فایل…"
            aria-label="جست‌وجوی تصویر"
          />
        </div>
        <span className="afield__count" dir="ltr">
          {filtered.length} / {media.length}
        </span>
      </div>

      <div className="amgrid">
        {filtered.map((entry) => (
          <figure className="amcard" key={entry.name}>
            <div className="amcard__shot">
              <img src={`/media/${entry.name}`} alt={entry.name} loading="lazy" />
              {used(entry.name) ? (
                <span className="abadge abadge--ok" style={{ position: "absolute", top: 8, insetInlineStart: 8 }}>
                  در حال استفاده
                </span>
              ) : null}
            </div>
            <figcaption>
              <span className="amcard__name" dir="ltr" title={entry.name}>
                {entry.name}
              </span>
              <span className="amcard__meta" dir="ltr">
                {formatBytes(entry.size)} · {entry.type.replace("image/", "").toUpperCase()}
              </span>
              <span className="amcard__meta">
                {formatDate(entry.at)} — {entry.by}
              </span>
              <span className="amcard__tools">
                <button
                  type="button"
                  className="abtn abtn--ghost abtn--icon abtn--sm"
                  aria-label="کپی نشانی"
                  onClick={() => void copy(entry.name)}
                >
                  {copied === entry.name ? <Check /> : <Copy />}
                </button>
                <ConfirmButton
                  className="abtn abtn--ghost abtn--sm"
                  label="حذف"
                  confirmLabel="مطمئنید؟"
                  onConfirm={() => void remove(entry.name)}
                  disabled={disabled}
                />
              </span>
            </figcaption>
          </figure>
        ))}

        {filtered.length === 0 ? (
          <div className="aempty">
            <p>{media.length === 0 ? "هنوز تصویری بارگذاری نشده است." : "تصویری با این نام پیدا نشد."}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
