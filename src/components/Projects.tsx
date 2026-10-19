import { PROJECTS } from "../data";
import { CircularGallery } from "./CircularGallery";
import { Reveal, SectionHead } from "./ui";

export function Projects({ onOrder }: { onOrder: () => void }) {
  return (
    <section id="projects" className="section projects">
      <div className="container">
        <Reveal>
          <SectionHead
            badge="پروژه‌های منتخب"
            index="01"
            title={
              <>
                ایده‌ها، <span className="text-grad">در قابِ تجربه.</span>
              </>
            }
            intro="چند نگاه مفهومی به مسائلی که دوست داریم حل کنیم؛ از تصویر اولیه تا تجربه‌ای که روی صفحه جان می‌گیرد."
          />
        </Reveal>
      </div>

      <CircularGallery items={PROJECTS} onOrder={onOrder} />
    </section>
  );
}
