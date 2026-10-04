// Paste as the `function` of a browser evaluate call (chrome-devtools / Playwright) on any app
// page: lists visible controls smaller than 44×44 px (spec §6.4). Empty array = pass.
// Open the "Under the hood" drawer first so its links are measured too.
() => {
  document.querySelector("details.hood")?.setAttribute("open", "");
  const bad = [];
  for (const el of document.querySelectorAll("button, a, input, select, summary")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0) continue;
    if (r.height < 44 || r.width < 44) {
      bad.push(`${el.tagName}.${el.className} "${el.textContent.trim().slice(0, 25)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
  }
  return bad;
}
