import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { PortalRoot } from "./PortalRoot.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <PortalRoot />
  </StrictMode>,
);
