import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/estedad";
import "@fontsource-variable/vazirmatn";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "./index.css";
import App from "./App";

document.documentElement.classList.add("js");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
