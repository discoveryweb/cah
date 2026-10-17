import { useCallback, useState } from "react";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { Features } from "./components/Features";
import { Projects } from "./components/Projects";
import { Services } from "./components/Services";
import { Approach } from "./components/Approach";
import { Studio } from "./components/Studio";
import { CtaBanner } from "./components/CtaBanner";
import { Footer } from "./components/Footer";
import { OrderModal } from "./components/OrderModal";

export default function App() {
  const [order, setOrder] = useState<{ open: boolean; service?: string }>({ open: false });

  const openOrder = useCallback((service?: string) => setOrder({ open: true, service }), []);
  const closeOrder = useCallback(() => setOrder((current) => ({ ...current, open: false })), []);

  return (
    <div dir="rtl" className="site-shell relative isolate min-h-screen overflow-x-clip bg-ink font-sans text-txt">
      <a href="#main-content" className="skip-link">
        رفتن به محتوای اصلی
      </a>

      <div className="ambient" aria-hidden="true">
        <div className="ambient-orb ambient-orb--one" />
        <div className="ambient-orb ambient-orb--two" />
        <div className="ambient-orb ambient-orb--three" />
      </div>

      <div className="relative z-10">
        <Header onOrder={() => openOrder()} />
        <main id="main-content" tabIndex={-1}>
          <Hero onOrder={() => openOrder()} />
          <Features />
          <Projects />
          <Services onOrder={openOrder} />
          <Approach />
          <Studio />
          <CtaBanner onOrder={() => openOrder()} />
        </main>
        <Footer />
      </div>

      <OrderModal open={order.open} onClose={closeOrder} initialService={order.service} />
    </div>
  );
}
