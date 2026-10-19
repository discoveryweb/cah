import { Asterisk } from "lucide-react";
import { Reveal } from "./ui";

export function Quote() {
  return (
    <section className="quote" data-invert aria-label="اصل کاری استودیو">
      <span className="quote__asterisk" aria-hidden="true">
        <Asterisk />
      </span>
      <div className="frame quote__inner">
        <Reveal>
          <p className="quote__text">
            کارِ خوب التماس نمی‌کند؛
            <br />
            <span className="quote__mark">دیده می‌شود.</span>
          </p>
        </Reveal>
        <Reveal delay={140} className="quote__meta">
          <span>CAHEN / PRINCIPLE NO. 01</span>
          <span>طراحی با فکر، ساختن با معنا</span>
        </Reveal>
      </div>
    </section>
  );
}
