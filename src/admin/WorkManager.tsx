import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Search } from "lucide-react";
import type { WorkItem } from "../content/types";
import { missingWorkFields, moveItem } from "./draft";
import { ConfirmButton, Field, ImagePicker, Modal, StringList, TextArea, TextInput, Toggle } from "./ui";

const blankWork = (): WorkItem => ({
  id:
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `work-${Date.now().toString(36)}`,
  name: "",
  title: "",
  category: "هویت بصری",
  year: "۱۴۰۴",
  sector: "",
  role: "",
  description: "",
  intro: "",
  challenge: "",
  result: "",
  metrics: [{ value: "", label: "" }],
  deliverables: [],
  image: "",
  alt: "",
  published: true,
});

interface WorkManagerProps {
  items: WorkItem[];
  onChange: (items: WorkItem[]) => void;
  errors: Record<string, string>;
  disabled: boolean;
  media?: { name: string; url: string; at: string; size: number }[];
  createSignal?: number;
}

export function WorkManager({
  items,
  onChange,
  errors,
  disabled,
  media = [],
  createSignal = 0,
}: WorkManagerProps) {
  const [draft, setDraft] = useState<WorkItem | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "live" | "hidden">("all");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => (filter === "live" ? item.published : filter === "hidden" ? !item.published : true))
      .filter(({ item }) => {
        if (!needle) return true;
        return [item.name, item.title, item.category, item.sector, item.role]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      });
  }, [items, query, filter]);

  const publishedCount = items.filter((item) => item.published).length;

  const openNew = () => {
    setDraft(blankWork());
    setEditingIndex(null);
  };

  const openEdit = (index: number) => {
    setDraft({ ...items[index], metrics: [...items[index].metrics], deliverables: [...items[index].deliverables] });
    setEditingIndex(index);
  };

  useEffect(() => {
    if (createSignal > 0) {
      setDraft(blankWork());
      setEditingIndex(null);
    }
  }, [createSignal]);

  const patchDraft = (path: string, value: unknown) => {
    setDraft((current) => {
      if (!current) return current;
      const keys = path.split(".");
      const next = { ...current } as unknown as Record<string, unknown>;
      let cursor = next;
      keys.forEach((key, position) => {
        if (position === keys.length - 1) {
          cursor[key] = value;
          return;
        }
        const child = cursor[key];
        if (Array.isArray(child)) {
          cursor[key] = child.slice();
          cursor = cursor[key] as Record<string, unknown>;
        } else {
          cursor[key] = { ...(child as Record<string, unknown>) };
          cursor = cursor[key] as Record<string, unknown>;
        }
      });
      return next as unknown as WorkItem;
    });
  };

  const commit = () => {
    if (!draft) return;
    if (editingIndex === null) {
      onChange([...items, draft]);
    } else {
      onChange(items.map((item, index) => (index === editingIndex ? draft : item)));
    }
    setDraft(null);
    setEditingIndex(null);
  };

  const draftMissing = draft ? missingWorkFields(draft) : [];

  return (
    <div className="acard">
      <div className="acard__head">
        <div>
          <span className="aeyebrow" dir="ltr">
            WORK / PORTFOLIO
          </span>
          <h2>نمونه‌کارها</h2>
          <p>
            {publishedCount} نمونهٔ منتشرشده از {items.length} مورد. ترتیب همین فهرست، ترتیب نمایش در
            گالری است؛ موارد منتشرنشده روی سایت دیده نمی‌شوند.
          </p>
        </div>
        <button type="button" className="abtn abtn--primary" onClick={openNew} disabled={disabled}>
          <Plus />
          نمونه‌کار تازه
        </button>
      </div>

      <div className="atoolbar">
        <div className="asearch">
          <Search />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="جست‌وجوی نام، دسته یا صنعت…"
            aria-label="جست‌وجوی نمونه‌کارها"
          />
        </div>
        <div className="atabs" role="tablist" aria-label="فیلتر انتشار">
          {(
            [
              ["all", "همه"],
              ["live", "منتشرشده"],
              ["hidden", "پیش‌نویس"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              data-active={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {errors["work.items"] ? <p className="afield__error">{errors["work.items"]}</p> : null}

      <div className="aworks">
        {visible.map(({ item, index }) => (
          <article className="awork" key={item.id || index}>
            <div className="awork__thumb">
              {item.image ? (
                <img src={item.image} alt="" loading="lazy" />
              ) : (
                <span>بدون تصویر</span>
              )}
              <span className="awork__order" dir="ltr">
                {String(index + 1).padStart(2, "0")}
              </span>
            </div>

            <div className="awork__body">
              <div className="awork__title">
                <h3>{item.title || item.name || "بدون عنوان"}</h3>
                <span className={`abadge ${item.published ? "abadge--ok" : "abadge--muted"}`}>
                  {item.published ? "منتشرشده" : "پیش‌نویس"}
                </span>
              </div>
              <p className="awork__meta" dir="auto">
                <span>{item.name || "—"}</span>
                <span aria-hidden="true">/</span>
                <span>{item.category || "—"}</span>
                <span aria-hidden="true">/</span>
                <span>{item.year || "—"}</span>
              </p>
              <p className="awork__desc">{item.description || "توضیح کوتاه نوشته نشده است."}</p>
              {missingWorkFields(item).length > 0 ? (
                <p className="awork__missing">
                  برای انتشار کامل شود: {missingWorkFields(item).join("، ")}
                </p>
              ) : null}
              <div className="awork__tools">
                <button
                  type="button"
                  className="abtn abtn--ghost abtn--sm"
                  onClick={() => openEdit(index)}
                  disabled={disabled}
                >
                  <Pencil />
                  ویرایش
                </button>
                <button
                  type="button"
                  className="abtn abtn--ghost abtn--sm"
                  onClick={() =>
                    onChange(
                      items.map((entry, position) =>
                        position === index ? { ...entry, published: !entry.published } : entry
                      )
                    )
                  }
                  disabled={disabled}
                >
                  {item.published ? <EyeOff /> : <Eye />}
                  {item.published ? "پنهان کن" : "منتشر کن"}
                </button>
                <span className="awork__move">
                  <button
                    type="button"
                    className="abtn abtn--ghost abtn--icon abtn--sm"
                    aria-label="جابه‌جایی به بالا"
                    disabled={disabled || index === 0}
                    onClick={() => onChange(moveItem(items, index, index - 1))}
                  >
                    <ArrowUp />
                  </button>
                  <button
                    type="button"
                    className="abtn abtn--ghost abtn--icon abtn--sm"
                    aria-label="جابه‌جایی به پایین"
                    disabled={disabled || index === items.length - 1}
                    onClick={() => onChange(moveItem(items, index, index + 1))}
                  >
                    <ArrowDown />
                  </button>
                  <ConfirmButton
                    className="abtn abtn--danger abtn--icon abtn--sm"
                    label=""
                    confirmLabel="حذف قطعی"
                    ariaLabel="حذف نمونه‌کار"
                    onConfirm={() => onChange(items.filter((_, position) => position !== index))}
                    disabled={disabled}
                  />
                </span>
              </div>
            </div>
          </article>
        ))}

        {visible.length === 0 ? (
          <div className="aempty">
            <p>
              {items.length === 0
                ? "هنوز نمونه‌کاری ثبت نشده است. با دکمهٔ «نمونه‌کار تازه» شروع کنید."
                : "هیچ موردی با این فیلتر پیدا نشد."}
            </p>
          </div>
        ) : null}
      </div>

      <Modal
        open={draft !== null}
        wide
        title={editingIndex === null ? "نمونه‌کار تازه" : "ویرایش نمونه‌کار"}
        description="همهٔ این فیلدها روی کارت گالری و صفحهٔ جزئیات پروژه استفاده می‌شوند."
        onClose={() => {
          setDraft(null);
          setEditingIndex(null);
        }}
        footer={
          <>
            <button
              type="button"
              className="abtn abtn--ghost"
              onClick={() => {
                setDraft(null);
                setEditingIndex(null);
              }}
            >
              انصراف
            </button>
            <button type="button" className="abtn abtn--primary" onClick={commit}>
              {editingIndex === null ? "افزودن به گالری" : "ثبت تغییرات"}
            </button>
          </>
        }
      >
        {draft ? (
          <div className="agrid">
            <div className="agrid agrid--2">
              <Field label="نام کارفرما / برند" path="name" error={draftMissing.includes("نام برند") ? "این فیلد لازم است." : undefined}>
                <TextInput
                  value={draft.name}
                  onChange={(value) => patchDraft("name", value)}
                  placeholder="مثلاً سیروس"
                  error={draftMissing.includes("نام برند")}
                />
              </Field>
              <Field label="تیتر پروژه" path="title" error={draftMissing.includes("تیتر") ? "این فیلد لازم است." : undefined}>
                <TextInput
                  value={draft.title}
                  onChange={(value) => patchDraft("title", value)}
                  placeholder="مثلاً هویتی که نفس می‌کشد"
                  error={draftMissing.includes("تیتر")}
                />
              </Field>
            </div>

            <div className="agrid agrid--4">
              <Field label="دسته" path="category">
                <TextInput value={draft.category} onChange={(value) => patchDraft("category", value)} />
              </Field>
              <Field label="سال" path="year">
                <TextInput value={draft.year} onChange={(value) => patchDraft("year", value)} />
              </Field>
              <Field label="صنعت" path="sector">
                <TextInput value={draft.sector} onChange={(value) => patchDraft("sector", value)} />
              </Field>
              <Field label="نقش" path="role">
                <TextInput value={draft.role} onChange={(value) => patchDraft("role", value)} />
              </Field>
            </div>

            <Field
              label="توضیح کوتاه"
              path="description"
              hint="زیر تیتر کارت گالری نمایش داده می‌شود."
              error={draftMissing.includes("توضیح کوتاه") ? "برای انتشار، توضیح کوتاه لازم است." : undefined}
            >
              <TextArea
                value={draft.description}
                onChange={(value) => patchDraft("description", value)}
                rows={2}
              />
            </Field>

            <Field
              label="تصویر شاخص"
              path="image"
              error={draftMissing.includes("تصویر") ? "برای انتشار، تصویر لازم است." : undefined}
            >
              <ImagePicker
                label=""
                value={draft.image}
                onChange={(value) => patchDraft("image", value)}
                alt={draft.alt}
                aspect="4 / 3"
                hint={
                  media.length
                    ? `${media.length} تصویر در کتابخانه موجود است؛ می‌توانید نشانی آن را وارد کنید.`
                    : undefined
                }
              />
            </Field>

            <Field label="متن جایگزین تصویر" path="alt">
              <TextInput value={draft.alt} onChange={(value) => patchDraft("alt", value)} />
            </Field>

            <div className="agrid agrid--2">
              <Field label="معرفی پروژه" path="intro">
                <TextArea value={draft.intro} onChange={(value) => patchDraft("intro", value)} rows={3} />
              </Field>
              <Field label="چالش" path="challenge">
                <TextArea
                  value={draft.challenge}
                  onChange={(value) => patchDraft("challenge", value)}
                  rows={3}
                />
              </Field>
            </div>

            <Field label="نتیجه" path="result">
              <TextArea value={draft.result} onChange={(value) => patchDraft("result", value)} rows={3} />
            </Field>

            <div className="adivider" />
            <Field label="شاخص‌ها" path="metrics" hint="مثلاً «۳×» و «رشد تعامل».">
              <div className="alist">
                {draft.metrics.map((metric, index) => (
                  <div className="arow" key={index} style={{ gridTemplateColumns: "minmax(0,140px) minmax(0,1fr) auto" }}>
                    <TextInput
                      value={metric.value}
                      onChange={(value) => patchDraft(`metrics.${index}.value`, value)}
                      placeholder="مقدار"
                    />
                    <TextInput
                      value={metric.label}
                      onChange={(value) => patchDraft(`metrics.${index}.label`, value)}
                      placeholder="برچسب"
                    />
                    <button
                      type="button"
                      className="abtn abtn--ghost abtn--icon abtn--sm"
                      aria-label="حذف شاخص"
                      onClick={() =>
                        patchDraft(
                          "metrics",
                          draft.metrics.filter((_, position) => position !== index)
                        )
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="abtn abtn--sm"
                  style={{ justifySelf: "start" }}
                  onClick={() => patchDraft("metrics", [...draft.metrics, { value: "", label: "" }])}
                >
                  <Plus />
                  افزودن شاخص
                </button>
              </div>
            </Field>

            <Field label="تحویل‌دادنی‌ها" path="deliverables">
              <StringList
                items={draft.deliverables}
                onChange={(value) => patchDraft("deliverables", value)}
                addLabel="افزودن آیتم"
              />
            </Field>

            <div className="agrid agrid--2" style={{ alignItems: "end" }}>
              <Toggle
                checked={draft.published}
                onChange={(value) => patchDraft("published", value)}
                label="انتشار در گالری"
                hint="اگر خاموش باشد، فقط در پنل می‌ماند."
              />
              <p className="afield__hint">
                ترتیب این فهرست، ترتیب نمایش در گالری است؛ برای جابه‌جایی از دکمه‌های بالا و پایین روی
                کارت‌ها استفاده کنید.
              </p>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
