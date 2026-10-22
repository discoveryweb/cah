import { useCallback, useState } from "react";
import { Cursor } from "./components/Cursor";
import { Cta } from "./components/Cta";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { Intro } from "./components/Intro";
import { OrderModal } from "./components/OrderModal";
import { Preloader } from "./components/Preloader";
import { Services } from "./components/Services";
import { ChapterRail, BackToTop, ScrollProgress } from "./components/SiteChrome";
import { Studio } from "./components/Studio";
import { Work } from "./components/Work";

export default function App() {
  const [order, setOrder] = useState<{ open: boolean; service?: string }>({ open: false });
  const [ready, setReady] = useState(false);

  const openOrder = useCallback((service?: string) => setOrder({ open: true, service }), []);
  const closeOrder = useCallback(() => setOrder((current) => ({ ...current, open: false })), []);
  const handleReady = useCallback(() => setReady(true), []);

  return (
    <div dir="rtl" className={`site${ready ? " is-ready" : ""}`}>
      <a href="#main-content" className="skip-link">
        رفتن به محتوای اصلی
      </a>

      <Preloader onDone={handleReady} />
      <Cursor />
      <ScrollProgress />
      <Header onOrder={() => openOrder()} ready={ready} />
      <ChapterRail />

      <main id="main-content" tabIndex={-1}>
        <Hero onOrder={() => openOrder()} />
        <Intro />
        <Work onOrder={() => openOrder()} />
        <Services onOrder={openOrder} />
        <Studio />
        <Cta onOrder={() => openOrder()} />
      </main>

      <Footer />

      <OrderModal open={order.open} onClose={closeOrder} initialService={order.service} />
      <BackToTop />
    </div>
  );
}
