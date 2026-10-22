import { ArrowDown, ArrowUp, AtSign, Link2, Plus, Trash2 } from "lucide-react";
import type { SocialIcon, SiteContent } from "../content/types";
import type { Update } from "./ContentEditor";
import { Field, TextArea, TextInput } from "./ui";

const SOCIAL_ICONS: { value: SocialIcon; label: string }[] = [
  { value: "telegram", label: "تلگرام" },
  { value: "instagram", label: "اینستاگرام" },
  { value: "whatsapp", label: "واتس‌اپ" },
  { value: "link", label: "پیوند عمومی" },
];

interface Props {
  content: SiteContent;
  update: Update;
  errors: Record<string, string>;
  disabled: boolean;
}

export function LinksPanel({ content, update, errors, disabled }: Props) {
  const moveNav = (index: number, direction: -1 | 1) => {
    const next = content.nav.slice();
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[target], next[index]] = [next[index], next[target]];
    update("nav", next);
  };

  return (
    <>
      <div className="acard">
        <div className="acard__head">
          <div>
            <span className="aeyebrow" dir="ltr">
              IDENTITY / SEO
            </span>
            <h2>هویت و سئو</h2>
            <p>نام برند در نوار بالای سایت، پابرگ و عنوان مرورگر استفاده می‌شود.</p>
          </div>
        </div>
        <div className="acard__body">
          <div className="agrid agrid--2">
            <Field label="نام برند" path="meta.brand" error={errors["meta.brand"]}>
              <TextInput
                value={content.meta.brand}
                onChange={(value) => update("meta.brand", value)}
                error={Boolean(errors["meta.brand"])}
                disabled={disabled}
              />
            </Field>
            <Field label="شعار کوتاه" path="meta.tagline">
              <TextInput
                value={content.meta.tagline}
                onChange={(value) => update("meta.tagline", value)}
                disabled={disabled}
              />
            </Field>
          </div>
          <Field label="عنوان سئو" path="meta.seoTitle" error={errors["meta.seoTitle"]}>
            <TextInput
              value={content.meta.seoTitle}
              onChange={(value) => update("meta.seoTitle", value)}
              error={Boolean(errors["meta.seoTitle"])}
              disabled={disabled}
              autoComplete="off"
            />
          </Field>
          <Field label="توضیح سئو" path="meta.seoDescription" hint="حدود ۱۵۰ نویسه؛ در نتایج جست‌وجو دیده می‌شود.">
            <TextArea
              value={content.meta.seoDescription}
              onChange={(value) => update("meta.seoDescription", value)}
              rows={3}
              maxLength={220}
              disabled={disabled}
            />
          </Field>
        </div>
      </div>

      <div className="acard">
        <div className="acard__head">
          <div>
            <span className="aeyebrow" dir="ltr">
              CONTACT DETAILS
            </span>
            <h2>اطلاعات تماس</h2>
            <p>این اطلاعات در پایان صفحه و پابرگ نمایش داده می‌شوند.</p>
          </div>
        </div>
        <div className="acard__body">
          <div className="agrid agrid--2">
            <Field label="ایمیل" path="contact.email" error={errors["contact.email"]}>
              <TextInput
                value={content.contact.email}
                onChange={(value) => update("contact.email", value)}
                ltr
                type="email"
                error={Boolean(errors["contact.email"])}
                disabled={disabled}
              />
            </Field>
            <Field label="تلفن" path="contact.phone" hint="اگر خالی باشد، پیوند تماس در پابرگ ساخته نمی‌شود.">
              <TextInput
                value={content.contact.phone}
                onChange={(value) => update("contact.phone", value)}
                ltr
                disabled={disabled}
              />
            </Field>
          </div>
          <div className="agrid agrid--2">
            <Field label="شناسهٔ شبکه‌های اجتماعی" path="contact.handle">
              <TextInput
                value={content.contact.handle}
                onChange={(value) => update("contact.handle", value)}
                ltr
                disabled={disabled}
              />
            </Field>
            <Field label="شهر" path="contact.city">
              <TextInput
                value={content.contact.city}
                onChange={(value) => update("contact.city", value)}
                disabled={disabled}
              />
            </Field>
          </div>
          <div className="agrid agrid--2">
            <Field label="نام لاتین شهر" path="contact.latinCity">
              <TextInput
                value={content.contact.latinCity}
                onChange={(value) => update("contact.latinCity", value)}
                ltr
                disabled={disabled}
              />
            </Field>
            <Field label="زمان پاسخ‌گویی" path="contact.responseTime">
              <TextInput
                value={content.contact.responseTime}
                onChange={(value) => update("contact.responseTime", value)}
                disabled={disabled}
              />
            </Field>
          </div>
        </div>
      </div>

      <div className="acard">
        <div className="acard__head">
          <div>
            <span className="aeyebrow" dir="ltr">
              SOCIAL CHANNELS
            </span>
            <h2>کانال‌های ارتباطی</h2>
            <p>آیکون هر کانال در بخش تماس سه‌بعدی رندر می‌شود؛ ترتیب همین فهرست است.</p>
          </div>
          <button
            type="button"
            className="abtn abtn--sm"
            disabled={disabled}
            onClick={() =>
              update("socials", [
                ...content.socials,
                { name: "کانال تازه", platform: "Telegram", href: "https://", color: "#7fd0ff", icon: "link" },
              ])
            }
          >
            <Plus />
            افزودن کانال
          </button>
        </div>
        <div className="acard__body">
          {content.socials.map((social, index) => (
            <div className="asocial" key={index}>
              <div className="agrid agrid--2">
                <Field
                  label="نام کانال"
                  path={`socials.${index}.name`}
                  error={errors[`socials.${index}.name`]}
                >
                  <TextInput
                    value={social.name}
                    onChange={(value) => update(`socials.${index}.name`, value)}
                    error={Boolean(errors[`socials.${index}.name`])}
                    disabled={disabled}
                  />
                </Field>
                <Field label="پلتفرم (لاتین)" path={`socials.${index}.platform`}>
                  <TextInput
                    value={social.platform}
                    onChange={(value) => update(`socials.${index}.platform`, value)}
                    ltr
                    disabled={disabled}
                  />
                </Field>
              </div>
              <Field
                label="نشانی"
                path={`socials.${index}.href`}
                error={errors[`socials.${index}.href`]}
                hint="با https:// شروع شود."
              >
                <TextInput
                  value={social.href}
                  onChange={(value) => update(`socials.${index}.href`, value)}
                  ltr
                  error={Boolean(errors[`socials.${index}.href`])}
                  disabled={disabled}
                />
              </Field>
              <div className="asocial__row">
                <Field label="آیکون" path={`socials.${index}.icon`}>
                  <select
                    className="aselect"
                    value={social.icon}
                    disabled={disabled}
                    onChange={(event) => update(`socials.${index}.icon`, event.target.value)}
                  >
                    {SOCIAL_ICONS.map((icon) => (
                      <option key={icon.value} value={icon.value}>
                        {icon.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="رنگ درخشش" path={`socials.${index}.color`}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      className="ainput"
                      dir="ltr"
                      value={social.color}
                      onChange={(event) => update(`socials.${index}.color`, event.target.value)}
                      disabled={disabled}
                    />
                    <input
                      type="color"
                      value={/^#[0-9a-f]{6}$/i.test(social.color) ? social.color : "#7fd0ff"}
                      onChange={(event) => update(`socials.${index}.color`, event.target.value)}
                      disabled={disabled}
                      aria-label="انتخاب رنگ"
                      style={{
                        width: 42,
                        borderRadius: 10,
                        border: "1px solid var(--card-line)",
                        background: "transparent",
                      }}
                    />
                  </div>
                </Field>
                <span className="asocial__tools">
                  <button
                    type="button"
                    className="abtn abtn--ghost abtn--icon abtn--sm"
                    aria-label="بالا"
                    disabled={disabled || index === 0}
                    onClick={() => {
                      const next = content.socials.slice();
                      [next[index - 1], next[index]] = [next[index], next[index - 1]];
                      update("socials", next);
                    }}
                  >
                    <ArrowUp />
                  </button>
                  <button
                    type="button"
                    className="abtn abtn--ghost abtn--icon abtn--sm"
                    aria-label="پایین"
                    disabled={disabled || index === content.socials.length - 1}
                    onClick={() => {
                      const next = content.socials.slice();
                      [next[index + 1], next[index]] = [next[index], next[index + 1]];
                      update("socials", next);
                    }}
                  >
                    <ArrowDown />
                  </button>
                  <button
                    type="button"
                    className="abtn abtn--ghost abtn--icon abtn--sm"
                    aria-label="حذف کانال"
                    disabled={disabled || content.socials.length <= 1}
                    onClick={() =>
                      update(
                        "socials",
                        content.socials.filter((_, position) => position !== index)
                      )
                    }
                  >
                    <Trash2 />
                  </button>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="acard">
        <div className="acard__head">
          <div>
            <span className="aeyebrow" dir="ltr">
              NAVIGATION
            </span>
            <h2>منوی سایت</h2>
            <p>
              شناسهٔ هر آیتم باید با شناسهٔ بخش در صفحه یکی باشد (مثل <code dir="ltr">#work</code>) وگرنه
              پیوند کار نمی‌کند.
            </p>
          </div>
        </div>
        <div className="acard__body">
          <div className="alist">
            {content.nav.map((item, index) => (
              <div
                className="arow"
                key={index}
                style={{ gridTemplateColumns: "minmax(0,110px) minmax(0,1fr) minmax(0,150px) auto" }}
              >
                <TextInput
                  value={item.id}
                  onChange={(value) => update(`nav.${index}.id`, value)}
                  ltr
                  disabled={disabled}
                />
                <TextInput
                  value={item.label}
                  onChange={(value) => update(`nav.${index}.label`, value)}
                  disabled={disabled}
                />
                <TextInput
                  value={item.latin}
                  onChange={(value) => update(`nav.${index}.latin`, value)}
                  ltr
                  disabled={disabled}
                />
                <span className="arow__tools">
                  <button
                    type="button"
                    className="abtn abtn--ghost abtn--icon abtn--sm"
                    aria-label="بالا"
                    disabled={disabled || index === 0}
                    onClick={() => moveNav(index, -1)}
                  >
                    <ArrowUp />
                  </button>
                  <button
                    type="button"
                    className="abtn abtn--ghost abtn--icon abtn--sm"
                    aria-label="پایین"
                    disabled={disabled || index === content.nav.length - 1}
                    onClick={() => moveNav(index, 1)}
                  >
                    <ArrowDown />
                  </button>
                  <button
                    type="button"
                    className="abtn abtn--ghost abtn--icon abtn--sm"
                    aria-label="حذف آیتم"
                    disabled={disabled}
                    onClick={() =>
                      update(
                        "nav",
                        content.nav.filter((_, position) => position !== index)
                      )
                    }
                  >
                    <Trash2 />
                  </button>
                </span>
              </div>
            ))}
            <button
              type="button"
              className="abtn abtn--sm"
              style={{ justifySelf: "start" }}
              disabled={disabled}
              onClick={() => update("nav", [...content.nav, { id: "section", label: "بخش تازه", latin: "NEW" }])}
            >
              <Link2 />
              افزودن آیتم منو
            </button>
          </div>

          <div className="anote" style={{ marginTop: 14 }}>
            <AtSign />
            <span>
              پیوندهای هر بخش از بخش «متن‌های سایت» و همین‌جا مدیریت می‌شوند. تغییر شناسه‌ها ممکن است
              پیوندهای قدیمی را از کار بیندازد.
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
