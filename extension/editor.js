document.addEventListener("synclEE:read", () => {
  const monaco = window.monaco;
  const editors = monaco?.editor?.getEditors?.() ?? [];
  const focused = editors.find(editor => editor.hasTextFocus());
  const models = monaco?.editor?.getModels?.() ?? [];
  const model = focused?.getModel() ?? (editors.length === 1 ? editors[0].getModel() : null)
    ?? (models.length === 1 ? models[0] : null);
  const ace = document.querySelector(".ace_editor")?.env?.editor;
  const data = model ? {code: model.getValue(), language: model.getLanguageId()}
    : ace ? {code: ace.getValue(), language: ace.session.getMode().$id.split("/").pop()}
    : null;
  document.dispatchEvent(new CustomEvent("synclEE:buffer", {detail: JSON.stringify(data)}));
});

// LeetCode returns the submitted buffer and the verdict through separate requests.
if (location.hostname === "leetcode.com") {
  const websiteFetch = window.fetch;
  const submissions = new Map();
  window.fetch = async function (input, options) {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url, location.href);
    const problem = url.origin === location.origin && url.pathname.match(/^\/problems\/([\w-]+)\/submit\/?$/);
    const payload = problem && typeof options?.body === "string" ? options.body : null;
    const result = await websiteFetch.apply(this, arguments);
    if (!result.ok || url.origin !== location.origin) return result;
    if (payload) {
      const body = result.clone();
      body.json().then(({submission_id: id}) => {
        const {typed_code: code, lang: language} = JSON.parse(payload);
        if (id && typeof code === "string") {
          if (submissions.size >= 16) submissions.delete(submissions.keys().next().value);
          submissions.set(String(id), {url: location.origin + "/problems/" + problem[1] + "/", code, language});
        }
      }).catch(() => {});
    }
    const id = url.pathname.match(/^\/submissions\/detail\/(\d+)\/check\/?$/)?.[1];
    if (id && submissions.has(id)) {
      result.clone().json().then(verdict => {
        const submission = submissions.get(id);
        if (!submission || verdict.state !== "SUCCESS") return;
        submissions.delete(id);
        if (verdict.status_code === 10) {
          document.dispatchEvent(new CustomEvent("synclEE:accepted", {detail: JSON.stringify(submission)}));
        }
      }).catch(() => {});
    }
    return result;
  };
}
