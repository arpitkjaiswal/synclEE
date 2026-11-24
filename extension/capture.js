(() => {
  const verdictSelectors = [
    '[data-e2e-locator="submission-result"]', '[data-testid="submission-result"]',
    '[data-testid="submission-status"]', '.submission-result', '.submission-status',
    '.submission-verdict', '.testcase-result', '.result-status', '[role="status"]'
  ].join(",");
  const isAccepted = text => /^(?:accepted|all test cases passed[!.]?|correct answer[!.]?)$/i.test(text.trim());
  let pending;
  const send = submission => chrome.runtime.sendMessage({type: "accepted", submission}).catch(() => {});

  if (location.hostname === "leetcode.com") {
    document.addEventListener("synclEE:accepted", event => {
      try {
        pending = null;
        send(JSON.parse(event.detail));
      } catch {}
    });
  }

  function verdicts() {
    return [...document.querySelectorAll(verdictSelectors)].filter(node => node.getClientRects().length)
      .map(node => [node, node.textContent.trim()]);
  }

  function readBuffer() {
    let buffer;
    document.addEventListener("synclEE:buffer", event => {
      try { buffer = JSON.parse(event.detail); } catch {}
    }, {once: true});
    document.dispatchEvent(new Event("synclEE:read"));
    if (buffer?.code?.trim()) return buffer;
    const field = document.querySelector("textarea[data-language], textarea#code, textarea[name=code]");
    return field?.value.trim() ? {code: field.value, language: field.dataset.language} : null;
  }

  document.addEventListener("click", event => {
    const button = event.target instanceof Element && event.target.closest("button, [role=button], input[type=submit]");
    if (!button || !/^(submit|submit code|submit solution)$/i.test(
      (button.getAttribute("aria-label") || button.value || button.textContent).trim()
    )) return;
    const buffer = readBuffer();
    pending = buffer && {buffer, started: Date.now(), url: location.href, baseline: new Map(verdicts())};
  }, true);

  new MutationObserver(() => {
    if (!pending) return;
    if (Date.now() - pending.started > 120000 || new URL(pending.url).pathname.split("/").slice(0, 3).join("/")
        !== location.pathname.split("/").slice(0, 3).join("/")) {
      pending = null;
      return;
    }
    for (const [node, verdict] of verdicts()) {
      const previous = pending.baseline.get(node);
      pending.baseline.set(node, verdict);
      if (!isAccepted(verdict) || previous === verdict) continue;
      const ratingLabel = document.querySelector('[data-testid="problem-difficulty"], [data-testid="problem-rating"], [aria-label*="Difficulty" i]');
      const rating = (ratingLabel?.textContent || ratingLabel?.getAttribute("aria-label") || "").match(/\b\d{3,4}\b/)?.[0];
      const submission = {...pending.buffer, url: pending.url, rating};
      pending = null;
      send(submission);
      break;
    }
  }).observe(document, {subtree: true, childList: true, characterData: true});
})();
