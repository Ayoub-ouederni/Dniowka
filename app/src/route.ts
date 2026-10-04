import { useEffect, useState } from "react";

export type Route =
  | { name: "start" }
  | { name: "employer" }
  | { name: "screen"; employer: string }
  | { name: "salary"; stream: string; company: string | null; employee: string | null }
  | { name: "labels"; params: URLSearchParams }
  | { name: "gallery" };

export function parseRoute(hash: string): Route {
  const [path, query = ""] = hash.replace(/^#/, "").split("?");
  const params = new URLSearchParams(query);
  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "employer") return { name: "employer" };
  if (parts[0] === "screen" && parts[1]) return { name: "screen", employer: parts[1] };
  if (parts[0] === "dev" && parts[1] === "gallery") return { name: "gallery" };
  if (parts[0] === "labels") return { name: "labels", params };
  if (parts[0] === "s" && parts[1]) {
    return {
      name: "salary",
      stream: parts[1],
      company: params.get("c"),
      employee: params.get("n"),
    };
  }
  return { name: "start" };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

/** Link an employer sends: the names are off-chain labels carried in the link only. */
export function inviteLink(stream: string, company: string | null, employee: string | null) {
  const params = new URLSearchParams();
  if (company) params.set("c", company);
  if (employee) params.set("n", employee);
  const query = params.toString();
  return `${window.location.origin}${window.location.pathname}#/s/${stream}${query ? `?${query}` : ""}`;
}
