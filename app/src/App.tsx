import { DisconnectButton } from "./components/ConnectButton";
import { copy } from "./copy";
import { useRoute } from "./route";
import { BigScreen } from "./screens/BigScreen";
import { Employer } from "./screens/Employer";
import { Salary } from "./screens/Salary";
import { Start } from "./screens/Start";

export default function App() {
  const route = useRoute();
  // The big screen is projected: no header, no footer.
  if (route.name === "screen") return <BigScreen key={route.employer} authority={route.employer} />;
  return (
    <>
      <header className="top">
        <a href="#/" className="brand">
          {copy.appName}
        </a>
        <DisconnectButton />
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
      <footer className="foot">{copy.devnetNote}</footer>
    </>
  );
}
