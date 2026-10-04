import { Suspense, lazy, useEffect } from "react";

import { DisconnectButton } from "./components/ConnectButton";
import { LangToggle } from "./components/LangToggle";
import { copy } from "./copy";
import { importLabels } from "./labels";
import { useLang } from "./lang";
import { useRoute } from "./route";
import { BigScreen } from "./screens/BigScreen";
import { Employer } from "./screens/Employer";
import { Salary } from "./screens/Salary";
import { Start } from "./screens/Start";

// Dev-only visual QA page: the import is dropped from production builds.
const Gallery = import.meta.env.DEV
  ? lazy(() => import("./screens/Gallery").then((m) => ({ default: m.Gallery })))
  : null;

export default function App() {
  const route = useRoute();
  // Re-renders the whole tree with the other language's copy.
  useLang();
  useEffect(() => {
    if (route.name === "labels") window.location.replace(importLabels(route.params));
  }, [route]);

  // The big screen is projected: no header, no footer.
  if (route.name === "screen") return <BigScreen key={route.employer} authority={route.employer} />;
  return (
    <>
      <header className="top">
        <a href="#/" className="brand">
          {copy.appName}
        </a>
        <div className="top-actions">
          <LangToggle />
          <DisconnectButton />
        </div>
      </header>
      {route.name === "employer" && <Employer />}
      {route.name === "salary" && (
        <Salary
          key={route.stream}
          stream={route.stream}
          company={route.company}
          employee={route.employee}
        />
      )}
      {route.name === "start" && <Start />}
      {route.name === "gallery" && Gallery && (
        <Suspense fallback={null}>
          <Gallery />
        </Suspense>
      )}
      <footer className="foot">{copy.devnetNote}</footer>
    </>
  );
}
