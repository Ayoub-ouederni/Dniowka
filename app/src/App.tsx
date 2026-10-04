import { DisconnectButton } from "./components/ConnectButton";
import { copy } from "./copy";
import { useRoute } from "./route";
import { Employer } from "./screens/Employer";
import { Salary } from "./screens/Salary";
import { Start } from "./screens/Start";

export default function App() {
  const route = useRoute();
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
