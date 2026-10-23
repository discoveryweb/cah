import { useState } from "react";
import { ArrowUpLeft, Plus, Sparkles, Trash2 } from "lucide-react";
import type { SiteContent } from "../content/types";
import { Field, ImagePicker, StringList, TextArea, TextInput } from "./ui";

export type Update = (path: string, value: unknown) => void;

interface EditorProps {
  content: SiteContent;
  update: Update;
  errors: Record<string, string>;
  disabled: boolean;
}

const TABS = [
  { id: "hero", label: "هیرو" },
  { id: "about", label: "درباره" },
  { id: "work", label: "کارها" },
  { id: "services", label: "توانمندی‌ها" },
  { id: "studio", label: "استودیو" },
  { id: "contact", label: "تماس" },
  { id: "footer", label: "پابرگ" },
  { id: "order", label: "فرم سفارش" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ContentEditor({ content, update, errors, disabled }: EditorProps) {
  const [tab, setTab] = useState<TabId>("hero");

  return (
    <div className="acard">
      <div className="acard__head">
        <div>
          <span className="aeyebrow" dir="ltr">
            CONTENT / SITE COPY
          </span>
          <h2>متن‌های سایت</h2>
          <p>
            هرچه اینجا می‌نویسید، بعد از ذخیره روی سایت زنده اعمال می‌شود. برای تأکید روی یک واژه، آن را
            بین دو ستاره بگذارید: <code dir="ltr">*این‌طور*</code>
          </p>
        </div>
      </div>

      <div className="atabs" role="tablist" aria-label="بخش‌های محتوا" style={{ marginTop: 14 }}>
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            data-active={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="acard__body" style={{ marginTop: 16 }}>
        {tab === "hero" ? <HeroFields {...{ content, update, errors, disabled }} /> : null}
        {tab === "about" ? <AboutFields {...{ content, update, errors, disabled }} /> : null}
        {tab === "work" ? <WorkFields {...{ content, update, errors, disabled }} /> : null}
        {tab === "services" ? <ServicesFields {...{ content, update, errors, disabled }} /> : null}
        {tab === "studio" ? <StudioFields {...{ content, update, errors, disabled }} /> : null}
        {tab === "contact" ? <ContactFields {...{ content, update, errors, disabled }} /> : null}
        {tab === "footer" ? <FooterFields {...{ content, update, errors, disabled }} /> : null}
        {tab === "order" ? <OrderFields {...{ content, update, errors, disabled }} /> : null}
      </div>
    </div>
  );
}

/* --------------------------------- Hero --------------------------------- */

function HeroFields({ content, update, errors, disabled }: EditorProps) {
  const hero = content.hero;
  return (
    <>
      <div className="agrid agrid--2">
        <Field label="برچسب وضعیت" path="hero.status" hint="بالای هیرو، کنار نقطهٔ چشمک‌زن">
          <TextInput
            value={hero.status}
            onChange={(value) => update("hero.status", value)}
            disabled={disabled}
          />
        </Field>
        <Field label="مختصات (لاتین)" path="hero.coordinates">
          <TextInput
            value={hero.coordinates}
            onChange={(value) => update("hero.coordinates", value)}
            ltr
            disabled={disabled}
          />
        </Field>
      </div>

      <div className="agrid agrid--2">
        <Field label="خط اول تیتر" path="hero.lines.0" error={errors["hero.lines.0"]}>
          <TextInput
            value={hero.lines[0]}
            onChange={(value) => update("hero.lines.0", value)}
            error={Boolean(errors["hero.lines.0"])}
            disabled={disabled}
          />
        </Field>
        <Field
          label="خط دوم تیتر"
          path="hero.lines.1"
          error={errors["hero.lines.1"]}
          hint="ستاره‌دارها با رنگ بنفش برجسته می‌شوند."
        >
          <TextInput
            value={hero.lines[1]}
            onChange={(value) => update("hero.lines.1", value)}
            error={Boolean(errors["hero.lines.1"])}
            disabled={disabled}
          />
        </Field>
      </div>

      <div className="agrid agrid--2">
        <Field label="ترجمهٔ لاتین" path="hero.translation">
          <TextInput
            value={hero.translation}
            onChange={(value) => update("hero.translation", value)}
            ltr
            disabled={disabled}
          />
        </Field>
        <Field label="برچسب زیر ترجمه" path="hero.translationLabel">
          <TextInput
            value={hero.translationLabel}
            onChange={(value) => update("hero.translationLabel", value)}
            ltr
            disabled={disabled}
          />
        </Field>
      </div>

      <Field label="یادداشت حاشیه" path="hero.annotation" hint="متن کوچک کنار تیتر، در حاشیهٔ صفحه.">
        <TextInput
          value={hero.annotation}
          onChange={(value) => update("hero.annotation", value)}
          disabled={disabled}
        />
      </Field>

      <Field label="متن معرفی" path="hero.lede" hint="*متن* برای برجسته‌سازی و **متن** برای ضخیم.">
        <TextArea
          value={hero.lede}
          onChange={(value) => update("hero.lede", value)}
          rows={4}
          disabled={disabled}
        />
      </Field>

      <div className="agrid agrid--2">
        <Field label="دکمهٔ اصلی" path="hero.primaryCta">
          <TextInput
            value={hero.primaryCta}
            onChange={(value) => update("hero.primaryCta", value)}
            disabled={disabled}
          />
        </Field>
        <Field label="دکمهٔ دوم" path="hero.secondaryCta">
          <TextInput
            value={hero.secondaryCta}
            onChange={(value) => update("hero.secondaryCta", value)}
            disabled={disabled}
          />
        </Field>
      </div>

      <div className="adivider" />
      <Field label="نوار متحرک هیرو" path="hero.ticker" hint="هر خط، یک عبارت در نوار متحرک است.">
        <StringList
          items={hero.ticker}
          onChange={(items) => update("hero.ticker", items)}
          addLabel="افزودن عبارت"
          disabled={disabled}
        />
      </Field>
    </>
  );
}

/* --------------------------------- About -------------------------------- */

function AboutFields({ content, update, errors, disabled }: EditorProps) {
  const about = content.about;
  return (
    <>
      <Field label="تیتر بخش" path="about.title" error={errors["about.title"]}>
        <TextInput
          value={about.title}
          onChange={(value) => update("about.title", value)}
          error={Boolean(errors["about.title"])}
          disabled={disabled}
        />
      </Field>
      <Field label="توضیح زیر تیتر" path="about.note">
        <TextArea
          value={about.note}
          onChange={(value) => update("about.note", value)}
          rows={3}
          disabled={disabled}
        />
      </Field>

      <Field label="کپشن پلیت نشان" path="about.identityCaption">
        <TextInput
          value={about.identityCaption}
          onChange={(value) => update("about.identityCaption", value)}
          disabled={disabled}
        />
      </Field>

      <div className="adivider" />
      <Field label="خطوط جملهٔ محوری" path="about.statementLines" hint="هر خط با انیمیشن جداگانه ظاهر می‌شود.">
        <StringList
          items={about.statementLines}
          onChange={(items) => update("about.statementLines", items)}
          addLabel="افزودن خط"
          disabled={disabled}
        />
      </Field>

      <Field label="پاراگراف‌های متن" path="about.copy">
        <StringList
          items={about.copy}
          onChange={(items) => update("about.copy", items)}
          addLabel="افزودن پاراگراف"
          disabled={disabled}
        />
      </Field>

      <div className="agrid agrid--2">
        <Field label="متن پیوند" path="about.ctaLabel">
          <TextInput
            value={about.ctaLabel}
            onChange={(value) => update("about.ctaLabel", value)}
            disabled={disabled}
          />
        </Field>
        <Field label="کپشن تصویر دفتر" path="about.portrait.caption">
          <TextInput
            value={about.portrait.caption}
            onChange={(value) => update("about.portrait.caption", value)}
            disabled={disabled}
          />
        </Field>
      </div>

      <div className="agrid agrid--2">
        <ImagePicker
          label="تصویر دفتر"
          value={about.portrait.image}
          onChange={(value) => update("about.portrait.image", value)}
          alt={about.portrait.alt}
          disabled={disabled}
          aspect="6 / 5"
        />
        <Field label="متن جایگزین تصویر" path="about.portrait.alt">
          <TextArea
            value={about.portrait.alt}
            onChange={(value) => update("about.portrait.alt", value)}
            rows={3}
            disabled={disabled}
          />
        </Field>
      </div>

      <div className="adivider" />
      <span className="aeyebrow" dir="ltr">
        PRINCIPLES — ABOUT &amp; STUDIO
      </span>
      <div className="alist">
        {content.principles.map((principle, index) => (
          <div
            key={index}
            style={{
              display: "grid",
              gap: 10,
              padding: 12,
              border: "1px solid var(--card-line)",
              borderRadius: 14,
            }}
          >
            <div className="agrid agrid--2">
              <Field label={`اصل ${index + 1}`} path={`principles.${index}.title`}>
                <TextInput
                  value={principle.title}
                  onChange={(value) => update(`principles.${index}.title`, value)}
                  disabled={disabled}
                />
              </Field>
              <button
                type="button"
                className="abtn abtn--ghost abtn--sm"
                style={{ alignSelf: "end", justifySelf: "start" }}
                disabled={disabled || content.principles.length <= 1}
                onClick={() =>
                  update(
                    "principles",
                    content.principles.filter((_, position) => position !== index)
                  )
                }
              >
                <Trash2 />
                حذف اصل
              </button>
            </div>
            <Field label="توضیح" path={`principles.${index}.text`}>
              <TextArea
                value={principle.text}
                onChange={(value) => update(`principles.${index}.text`, value)}
                rows={2}
                disabled={disabled}
              />
            </Field>
          </div>
        ))}
        <button
          type="button"
          className="abtn abtn--sm"
          style={{ justifySelf: "start" }}
          disabled={disabled}
          onClick={() => update("principles", [...content.principles, { title: "اصل تازه", text: "" }])}
        >
          <Plus />
          افزودن اصل
        </button>
      </div>
    </>
  );
}

/* --------------------------------- Work -------------------------------- */

function WorkFields({ content, update, errors, disabled }: EditorProps) {
  const work = content.work;
  return (
    <>
      <div className="anote">
        <Sparkles />
        <span>
          برای افزودن یا ویرایش پروژه‌ها، از بخش «نمونه‌کارها» استفاده کنید؛ اینجا فقط متن‌های سرِ بخش
          و پابرگ آن است.
        </span>
      </div>

      <Field label="تیتر بخش" path="work.title">
        <TextInput
          value={work.title}
          onChange={(value) => update("work.title", value)}
          disabled={disabled}
        />
      </Field>
      <Field label="توضیح بخش" path="work.note">
        <TextArea value={work.note} onChange={(value) => update("work.note", value)} rows={3} disabled={disabled} />
      </Field>
      <div className="agrid agrid--3">
        <Field label="برچسب لاتین" path="work.eyebrow">
          <TextInput
            value={work.eyebrow}
            onChange={(value) => update("work.eyebrow", value)}
            ltr
            disabled={disabled}
          />
        </Field>
        <Field label="راهنمای گالری" path="work.hint">
          <TextInput
            value={work.hint}
            onChange={(value) => update("work.hint", value)}
            disabled={disabled}
          />
        </Field>
        <Field label="دکمهٔ آرشیو" path="work.archiveCta">
          <TextInput
            value={work.archiveCta}
            onChange={(value) => update("work.archiveCta", value)}
            disabled={disabled}
          />
        </Field>
      </div>
      <Field
        label="یادداشت پایین گالری"
        path="work.footNote"
        hint="از {count} برای شمارش خودکار پروژه‌ها استفاده کنید."
        error={errors["work.items"]}
      >
        <TextInput
          value={work.footNote}
          onChange={(value) => update("work.footNote", value)}
          disabled={disabled}
        />
      </Field>
    </>
  );
}

/* ------------------------------- Services ------------------------------- */

function ServicesFields({ content, update, errors, disabled }: EditorProps) {
  const services = content.services;
  const [open, setOpen] = useState<number | null>(0);

  return (
    <>
      <Field label="تیتر بخش" path="services.title">
        <TextInput
          value={services.title}
          onChange={(value) => update("services.title", value)}
          disabled={disabled}
        />
      </Field>
      <Field label="توضیح بخش" path="services.note">
        <TextArea
          value={services.note}
          onChange={(value) => update("services.note", value)}
          rows={3}
          disabled={disabled}
        />
      </Field>
      <div className="agrid agrid--2">
        <Field label="متن دکمهٔ هر خدمت" path="services.ctaLabel">
          <TextInput
            value={services.ctaLabel}
            onChange={(value) => update("services.ctaLabel", value)}
            disabled={disabled}
          />
        </Field>
        <Field label="جملهٔ پایانی" path="services.foot">
          <TextInput
            value={services.foot}
            onChange={(value) => update("services.foot", value)}
            disabled={disabled}
          />
        </Field>
      </div>

      <div className="adivider" />
      <span className="aeyebrow" dir="ltr">
        SERVICE ITEMS
      </span>

      <div className="alist">
        {services.items.map((service, index) => {
          const expanded = open === index;
          return (
            <div
              key={index}
              style={{
                border: "1px solid var(--card-line)",
                borderRadius: 14,
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                }}
              >
                <span dir="ltr" style={{ fontFamily: "var(--font-serif)", color: "var(--vermilion)" }}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : index)}
                  style={{ flex: 1, textAlign: "start", fontSize: 12.5 }}
                  aria-expanded={expanded}
                >
                  {service.title || "خدمت بدون نام"}
                  <span
                    dir="ltr"
                    style={{
                      display: "block",
                      color: "rgba(214,198,255,0.35)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 7.5,
                      letterSpacing: "0.16em",
                    }}
                  >
                    {service.latin}
                  </span>
                </button>
                <span className="awork__tools">
                  <button
                    type="button"
                    className="abtn abtn--ghost abtn--icon abtn--sm"
                    aria-label="بالا"
                    disabled={disabled || index === 0}
                    onClick={() => {
                      const next = services.items.slice();
                      [next[index - 1], next[index]] = [next[index], next[index - 1]];
                      update("services.items", next);
                    }}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="abtn abtn--ghost abtn--icon abtn--sm"
                    aria-label="پایین"
                    disabled={disabled || index === services.items.length - 1}
                    onClick={() => {
                      const next = services.items.slice();
                      [next[index + 1], next[index]] = [next[index], next[index + 1]];
                      update("services.items", next);
                    }}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="abtn abtn--ghost abtn--icon abtn--sm"
                    aria-label="حذف خدمت"
                    disabled={disabled || services.items.length <= 1}
                    onClick={() =>
                      update(
                        "services.items",
                        services.items.filter((_, position) => position !== index)
                      )
                    }
                  >
                    <Trash2 />
                  </button>
                </span>
              </div>

              {expanded ? (
                <div className="agrid" style={{ padding: "0 12px 14px" }}>
                  <div className="agrid agrid--2">
                    <Field label="عنوان" path={`services.items.${index}.title`} error={errors[`services.items.${index}.title`]}>
                      <TextInput
                        value={service.title}
                        onChange={(value) => update(`services.items.${index}.title`, value)}
                        disabled={disabled}
                      />
                    </Field>
                    <Field label="برچسب لاتین" path={`services.items.${index}.latin`}>
                      <TextInput
                        value={service.latin}
                        onChange={(value) => update(`services.items.${index}.latin`, value)}
                        ltr
                        disabled={disabled}
                      />
                    </Field>
                  </div>
                  <Field label="توضیح" path={`services.items.${index}.text`}>
                    <TextArea
                      value={service.text}
                      onChange={(value) => update(`services.items.${index}.text`, value)}
                      rows={3}
                      disabled={disabled}
                    />
                  </Field>
                  <div className="agrid agrid--2">
                    <Field label="زمان تقریبی" path={`services.items.${index}.duration`}>
                      <TextInput
                        value={service.duration}
                        onChange={(value) => update(`services.items.${index}.duration`, value)}
                        disabled={disabled}
                      />
                    </Field>
                    <Field label="مناسب برای" path={`services.items.${index}.suited`}>
                      <TextInput
                        value={service.suited}
                        onChange={(value) => update(`services.items.${index}.suited`, value)}
                        disabled={disabled}
                      />
                    </Field>
                  </div>
                  <Field
                    label="تحویل‌دادنی‌ها"
                    path={`services.items.${index}.deliverables`}
                    hint="هر خط یک آیتم فهرست است."
                  >
                    <StringList
                      items={service.deliverables}
                      onChange={(items) => update(`services.items.${index}.deliverables`, items)}
                      addLabel="افزودن آیتم"
                      disabled={disabled}
                    />
                  </Field>
                  <Field
                    label="گزینهٔ فرم سفارش"
                    path={`services.items.${index}.option`}
                    hint="همین عنوان در فرم سفارش نمایش داده می‌شود."
                  >
                    <TextInput
                      value={service.option}
                      onChange={(value) => update(`services.items.${index}.option`, value)}
                      disabled={disabled}
                    />
                  </Field>
                </div>
              ) : null}
            </div>
          );
        })}
        <button
          type="button"
          className="abtn abtn--sm"
          style={{ justifySelf: "start" }}
          disabled={disabled}
          onClick={() =>
            update("services.items", [
              ...services.items,
              {
                title: "خدمت تازه",
                latin: "NEW SERVICE",
                text: "",
                deliverables: [],
                duration: "",
                suited: "",
                option: "خدمت تازه",
              },
            ])
          }
        >
          <Plus />
          افزودن خدمت
        </button>
      </div>
    </>
  );
}

/* -------------------------------- Studio -------------------------------- */

function StudioFields({ content, update, errors, disabled }: EditorProps) {
  const studio = content.studio;
  return (
    <>
      <Field label="تیتر بخش" path="studio.title" error={errors["studio.title"]}>
        <TextInput value={studio.title} onChange={(value) => update("studio.title", value)} disabled={disabled} />
      </Field>
      <Field label="توضیح زیر تیتر" path="studio.note">
        <TextArea value={studio.note} onChange={(value) => update("studio.note", value)} rows={3} disabled={disabled} />
      </Field>

      <Field label="خطوط جملهٔ محوری" path="studio.statementLines">
        <StringList
          items={studio.statementLines}
          onChange={(items) => update("studio.statementLines", items)}
          addLabel="افزودن خط"
          disabled={disabled}
        />
      </Field>

      <Field label="پاراگراف‌ها" path="studio.copy">
        <StringList
          items={studio.copy}
          onChange={(items) => update("studio.copy", items)}
          addLabel="افزودن پاراگراف"
          disabled={disabled}
        />
      </Field>

      <div className="agrid agrid--2">
        <Field label="متن پیوند به کارها" path="studio.linkLabel">
          <TextInput
            value={studio.linkLabel}
            onChange={(value) => update("studio.linkLabel", value)}
            disabled={disabled}
          />
        </Field>
        <Field label="دکمهٔ تماس" path="studio.ctaLabel">
          <TextInput
            value={studio.ctaLabel}
            onChange={(value) => update("studio.ctaLabel", value)}
            disabled={disabled}
          />
        </Field>
      </div>
      <Field label="جملهٔ پایانی" path="studio.ctaText">
        <TextArea
          value={studio.ctaText}
          onChange={(value) => update("studio.ctaText", value)}
          rows={2}
          disabled={disabled}
        />
      </Field>

      <div className="adivider" />
      <span className="aeyebrow" dir="ltr">
        LEDGER FACTS
      </span>
      <div className="alist">
        {studio.facts.map((fact, index) => (
          <div className="arow" key={index} style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) auto" }}>
            <TextInput
              value={fact.label}
              onChange={(value) => update(`studio.facts.${index}.label`, value)}
              placeholder="برچسب"
              disabled={disabled}
            />
            <TextInput
              value={fact.value}
              onChange={(value) => update(`studio.facts.${index}.value`, value)}
              placeholder="مقدار"
              disabled={disabled}
            />
            <TextInput
              value={fact.latin}
              onChange={(value) => update(`studio.facts.${index}.latin`, value)}
              placeholder="LATIN"
              ltr
              disabled={disabled}
            />
            <button
              type="button"
              className="abtn abtn--ghost abtn--icon abtn--sm"
              aria-label="حذف"
              disabled={disabled}
              onClick={() => update("studio.facts", studio.facts.filter((_, i) => i !== index))}
            >
              <Trash2 />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="abtn abtn--sm"
          style={{ justifySelf: "start" }}
          disabled={disabled}
          onClick={() => update("studio.facts", [...studio.facts, { label: "", value: "", latin: "" }])}
        >
          <Plus />
          افزودن ردیف
        </button>
      </div>

      <div className="adivider" />
      <Field label="نوار متحرک پایانی" path="studio.marquee">
        <StringList
          items={studio.marquee}
          onChange={(items) => update("studio.marquee", items)}
          addLabel="افزودن عبارت"
          disabled={disabled}
        />
      </Field>
    </>
  );
}

/* -------------------------------- Contact -------------------------------- */

function ContactFields({ content, update, disabled }: EditorProps) {
  const contact = content.contactSection;
  return (
    <>
      <div className="agrid agrid--2">
        <Field label="برچسب بالای بخش" path="contactSection.availability">
          <TextInput
            value={contact.availability}
            onChange={(value) => update("contactSection.availability", value)}
            disabled={disabled}
          />
        </Field>
        <Field label="تیتر اصلی" path="contactSection.headline">
          <TextInput
            value={contact.headline}
            onChange={(value) => update("contactSection.headline", value)}
            disabled={disabled}
          />
        </Field>
      </div>
      <Field label="متن معرفی" path="contactSection.lead">
        <TextArea
          value={contact.lead}
          onChange={(value) => update("contactSection.lead", value)}
          rows={3}
          disabled={disabled}
        />
      </Field>
      <div className="agrid agrid--3">
        <Field label="دکمهٔ گفت‌وگو" path="contactSection.ctaLabel">
          <TextInput
            value={contact.ctaLabel}
            onChange={(value) => update("contactSection.ctaLabel", value)}
            disabled={disabled}
          />
        </Field>
        <Field label="برچسب تلگرام" path="contactSection.telegramLabel">
          <TextInput
            value={contact.telegramLabel}
            onChange={(value) => update("contactSection.telegramLabel", value)}
            disabled={disabled}
          />
        </Field>
        <Field label="برچسب پاسخ‌گویی" path="contactSection.responseLabel">
          <TextInput
            value={contact.responseLabel}
            onChange={(value) => update("contactSection.responseLabel", value)}
            disabled={disabled}
          />
        </Field>
      </div>

      <div className="adivider" />
      <span className="aeyebrow" dir="ltr">
        SOCIAL PANEL
      </span>
      <div className="agrid agrid--2">
        <Field label="برچسب لاتین" path="contactSection.socialEyebrow">
          <TextInput
            value={contact.socialEyebrow}
            onChange={(value) => update("contactSection.socialEyebrow", value)}
            ltr
            disabled={disabled}
          />
        </Field>
        <Field label="تیتر" path="contactSection.socialTitle">
          <TextInput
            value={contact.socialTitle}
            onChange={(value) => update("contactSection.socialTitle", value)}
            disabled={disabled}
          />
        </Field>
      </div>
      <div className="agrid agrid--2">
        <Field label="بخش برجستهٔ تیتر" path="contactSection.socialTitleAccent">
          <TextInput
            value={contact.socialTitleAccent}
            onChange={(value) => update("contactSection.socialTitleAccent", value)}
            disabled={disabled}
          />
        </Field>
        <Field label="توضیح کانال‌ها" path="contactSection.socialText">
          <TextArea
            value={contact.socialText}
            onChange={(value) => update("contactSection.socialText", value)}
            rows={2}
            disabled={disabled}
          />
        </Field>
      </div>
    </>
  );
}

/* --------------------------------- Footer -------------------------------- */

function FooterFields({ content, update, disabled }: EditorProps) {
  const footer = content.footer;
  return (
    <>
      <Field label="دربارهٔ استودیو در پابرگ" path="footer.statement">
        <TextArea
          value={footer.statement}
          onChange={(value) => update("footer.statement", value)}
          rows={3}
          disabled={disabled}
        />
      </Field>
      <div className="agrid agrid--3">
        <Field label="عنوان ستون نقشه" path="footer.sitemapLabel">
          <TextInput
            value={footer.sitemapLabel}
            onChange={(value) => update("footer.sitemapLabel", value)}
            ltr
            disabled={disabled}
          />
        </Field>
        <Field label="عنوان ستون کانال‌ها" path="footer.elsewhereLabel">
          <TextInput
            value={footer.elsewhereLabel}
            onChange={(value) => update("footer.elsewhereLabel", value)}
            ltr
            disabled={disabled}
          />
        </Field>
        <Field label="عنوان ستون تماس" path="footer.directLabel">
          <TextInput
            value={footer.directLabel}
            onChange={(value) => update("footer.directLabel", value)}
            ltr
            disabled={disabled}
          />
        </Field>
      </div>
      <div className="agrid agrid--2">
        <Field label="اعتبار سازنده" path="footer.credit">
          <TextInput
            value={footer.credit}
            onChange={(value) => update("footer.credit", value)}
            ltr
            disabled={disabled}
          />
        </Field>
        <Field label="خط حقوق" path="footer.rights">
          <TextInput
            value={footer.rights}
            onChange={(value) => update("footer.rights", value)}
            disabled={disabled}
          />
        </Field>
      </div>
      <div className="anote">
        <ArrowUpLeft />
        <span>ایمیل، تلفن، شهر و شبکه‌های اجتماعی در بخش «لینک‌ها و کانال‌ها» ویرایش می‌شوند.</span>
      </div>
    </>
  );
}

/* ------------------------------- Order form ------------------------------- */

function OrderFields({ content, update, disabled }: EditorProps) {
  const order = content.order;
  return (
    <>
      <Field label="تیتر فرم" path="order.title">
        <TextInput value={order.title} onChange={(value) => update("order.title", value)} disabled={disabled} />
      </Field>
      <Field label="توضیح فرم" path="order.description">
        <TextArea
          value={order.description}
          onChange={(value) => update("order.description", value)}
          rows={3}
          disabled={disabled}
        />
      </Field>
      <Field label="متن دکمهٔ ارسال" path="order.submitLabel">
        <TextInput
          value={order.submitLabel}
          onChange={(value) => update("order.submitLabel", value)}
          disabled={disabled}
        />
      </Field>
      <div className="anote">
        <ArrowUpLeft />
        <span>گزینه‌های انتخاب خدمت، از فهرست «توانمندی‌ها» خوانده می‌شوند.</span>
      </div>
    </>
  );
}
