import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { installTestHooks } from "./testHooks";

// `MODE` is replaced at build time, so normal builds drop the hooks entirely.
if (import.meta.env.MODE === "test") installTestHooks();

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
