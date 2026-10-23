import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { ContentProvider } from "./content/ContentProvider";

// The control room is only downloaded when someone opens /shenataisoni, so the
// public site keeps its lean first paint.
const AdminApp = lazy(() =>
  import("./admin/AdminApp").then((module) => ({ default: module.AdminApp }))
);

document.documentElement.classList.add("js");

const isAdmin = window.location.pathname.replace(/\/+$/, "").toLowerCase() === "/shenataisoni";

if (isAdmin) {
  document.title = "اتاق فرمان کهن";
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isAdmin ? (
      <Suspense
        fallback={
          <div className="admin">
            <span className="admin__grain" aria-hidden="true" />
            <div className="admin-boot">
              <span className="aeyebrow" dir="ltr">
                OPENING CONTROL ROOM
              </span>
              <p>در حال باز کردن اتاق فرمان…</p>
            </div>
          </div>
        }
      >
        <AdminApp />
      </Suspense>
    ) : (
      <ContentProvider>
        <App />
      </ContentProvider>
    )}
  </StrictMode>
);
