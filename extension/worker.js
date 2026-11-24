import {saveSolution, solutionPath} from "./sync.js";

chrome.storage.local.setAccessLevel({accessLevel: "TRUSTED_CONTEXTS"});
let queue = Promise.resolve();
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== "accepted" || !sender.tab || sender.frameId !== 0) return;
  const job = queue.then(async () => {
    const {config, token, stats = {}} = await chrome.storage.local.get(["config", "token", "stats"]);
    if (!config?.repository || !token) return;
    const file = solutionPath(message.submission, sender.url);
    const committed = await saveSolution({repository: config.repository, token, submission: message.submission, file});
    if (committed) {
      stats[file.platform] = (stats[file.platform] ?? 0) + 1;
      await chrome.storage.local.set({stats, lastSync: new Date().toISOString(), lastError: ""});
    } else {
      await chrome.storage.local.remove("lastError");
    }
  });
  queue = job.catch(async error => {
    await chrome.storage.local.set({lastError: error.message});
  }).catch(() => {});
  job.then(() => respond({ok: true}), () => respond({ok: false}));
  return true;
});
