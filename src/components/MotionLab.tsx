import { useEffect, useRef, useState } from "react";
import { Aperture, Orbit, Waves } from "lucide-react";
import { LogoMark, Reveal } from "./ui";

const STUDIES = [
  { id: "orbit", title: "مدار", label: "ORBIT", text: "حرکتی پیوسته برای روایت‌هایی که مسیر دارند.", icon: Orbit },
  { id: "wave", title: "موج", label: "WAVE", text: "بازخوردی نرم و زنده برای هر تعامل.", icon: Waves },
  { id: "pulse", title: "تپش", label: "PULSE", text: "نور و ریتم، در خدمت جزئیات تجربه.", icon: Aperture },
] as const;

/** A small interactive motion study, not a carousel or a fake portfolio item. */
export function MotionLab() {
  const [selected, setSelected] = useState<(typeof STUDIES)[number]>(STUDIES[0]);
  const visualRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const visual = visualRef.current;
    if (!visual) return;
    if (typeof IntersectionObserver === "undefined") { visual.dataset.visible = "true"; return; }
    const observer = new IntersectionObserver(([entry]) => { visual.dataset.visible = String(Boolean(entry?.isIntersecting)); });
    observer.observe(visual);
    return () => observer.disconnect();
  }, []);
  return (
    <section id="animations" className="motion-lab section" aria-labelledby="motion-lab-title">
      <div className="frame motion-lab__grid">
        <Reveal className="motion-lab__copy">
          <span className="motion-lab__eyebrow" dir="ltr">MOTION STUDIES <i /> 04 / INTERACTION</span>
          <h2 id="motion-lab-title">حرکت، جزئی از <em>داستان</em> است.</h2>
          <p>از بازخوردهای کوچک تا روایت‌های تعاملی، حرکت به تجربه جان می‌دهد. یکی از حالت‌ها را انتخاب کنید.</p>
          <div className="motion-lab__controls" aria-label="انتخاب مطالعهٔ حرکت">
            {STUDIES.map((study) => <button key={study.id} type="button" aria-pressed={selected.id === study.id} onClick={() => setSelected(study)}><study.icon aria-hidden="true" /><span>{study.title}</span></button>)}
          </div>
        </Reveal>
        <Reveal className="motion-lab__plate" variant="scale">
          <div className="motion-lab__plate-top" dir="ltr"><span>CAHEN / PLAYGROUND</span><span>LIVE STUDY</span></div>
          <div ref={visualRef} className="motion-lab__visual" data-mode={selected.id} aria-hidden="true"><i /><i /><i /><b><LogoMark className="motion-lab__mark" /></b></div>
          <div className="motion-lab__caption"><div><span dir="ltr">{selected.label} / MOTION</span><strong>{selected.title}</strong></div><p>{selected.text}</p></div>
        </Reveal>
      </div>
    </section>
  );
}
