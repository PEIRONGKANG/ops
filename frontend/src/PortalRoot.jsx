import { useState } from "react";

import App from "./App";
import { PortalLanding } from "./components/PortalLanding";

export function PortalRoot() {
  const [entered, setEntered] = useState(false);

  const handleEnter = () => {
    setEntered(true);
  };

  if (!entered) {
    return <PortalLanding onEnter={handleEnter} />;
  }

  return <App />;
}
