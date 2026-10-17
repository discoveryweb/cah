import { PROJECTS } from "../data";
import { CircularGallery } from "./CircularGallery";
import { Reveal, SectionBadge } from "./ui";

export function Projects() {
  return (
    <section id="projects" className="section-anchor section-space relative">
      <div className="mx-auto max-w-[1280px] px-5 sm:px-8">
        <Reveal className="section-heading mb-7 flex flex-col gap-5 sm:mb-9 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <SectionBadge>پروژه‌های منتخب</SectionBadge>
            <h2 className="section-title mt-4">
              ایده‌ها، <span className="text-grad">در قابِ تجربه.</span>
            </h2>
          </div>
          <p className="section-intro max-w-md lg:pb-1">
            چند نگاه مفهومی به مسائلی که دوست داریم حل کنیم؛ از تصویر اولیه تا تجربه‌ای که روی صفحه جان می‌گیرد.
          </p>
        </Reveal>

        <CircularGallery items={PROJECTS} />
      </div>
    </section>
  );
}
