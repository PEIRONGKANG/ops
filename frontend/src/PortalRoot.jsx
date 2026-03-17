import { useState } from "react";

import App from "./App";
import { PortalLanding } from "./components/PortalLanding";

const PORTAL_SESSION_KEY = "ops_training_portal_entered_v1";

function readPortalState() {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(PORTAL_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function PortalRoot() {
  const [entered, setEntered] = useState(readPortalState);

  const handleEnter = () => {
    try {
      window.sessionStorage.setItem(PORTAL_SESSION_KEY, "1");
    } catch {
      // Ignore storage failures and continue into the app.
    }
    setEntered(true);
  };

  if (!entered) {
    return <PortalLanding onEnter={handleEnter} />;
  }

  return <App />;
}
