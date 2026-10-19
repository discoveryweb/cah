import { useCallback, useState } from "react";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { Features } from "./components/Features";
import { Projects } from "./components/Projects";
import { Services } from "./components/Services";
import { Approach } from "./components/Approach";
import { Studio } from "./components/Studio";
import { Manifesto } from "./components/Manifesto";
import { CtaBanner } from "./components/CtaBanner";
import { Footer } from "./components/Footer";
import { OrderModal } from "./components/OrderModal";
import { BackToTop, CursorGlow, ScrollProgress } from "./components/SiteChrome";

export default function App() {
  const [order, setOrder] = useState<{ open: boolean; service?: string }>({ open: false });

  const openOrder = useCallback((service?: string) => setOrder({ open: true, service }), []);
  const closeOrder = useCallback(() => setOrder((current) => ({ ...current, open: false })), []);

  return (
    <div dir="rtl" className="shell">
      <a href="#main-content" className="skip-link">
        رفتن به محتوای اصلی
      </a>

      <div className="atmosphere" aria-hidden="true">
        <div className="atmosphere__base" />
        <div className="atmosphere__grid" />
        <div className="atmosphere__orb atmosphere__orb--1" />
        <div className="atmosphere__orb atmosphere__orb--2" />
        <div className="atmosphere__orb atmosphere__orb--3" />
        <div className="atmosphere__beam" />
      </div>

      <CursorGlow />
      <div className="grain" aria-hidden="true" />
      <ScrollProgress />

      <div className="relative z-10">
        <Header onOrder={() => openOrder()} />
        <main id="main-content" tabIndex={-1}>
          <Hero onOrder={() => openOrder()} />
          <Features />
          <Projects onOrder={openOrder} />
          <Services onOrder={openOrder} />
          <Approach />
          <Studio />
          <Manifesto />
          <CtaBanner onOrder={() => openOrder()} />
        </main>
        <Footer />
      </div>

      <OrderModal open={order.open} onClose={closeOrder} initialService={order.service} />
      <BackToTop />
    </div>
  );
}
