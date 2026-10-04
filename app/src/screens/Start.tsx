import { copy } from "../copy";

export function Start() {
  return (
    <main className="screen start">
      <h1>{copy.tagline}</h1>
      <p className="lead">{copy.taglineMore}</p>
      <h2>{copy.start.title}</h2>
      <a className="role" href="#/employer">
        <strong>{copy.start.employer}</strong>
        <span>{copy.start.employerHint}</span>
      </a>
      <div className="role muted">
        <strong>{copy.start.employee}</strong>
        <span>{copy.start.employeeHint}</span>
      </div>
    </main>
  );
}
