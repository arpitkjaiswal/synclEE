import {repositoryName} from "./sync.js";

const byId = id => document.getElementById(id);
const status = message => { byId("status").textContent = message; };
const platforms = ["LeetCode", "CodeChef", "HackerRank", "GeeksforGeeks"];

async function oauth(path, params) {
  const response = await fetch("https://github.com/login/" + path, {
    method: "POST", headers: {Accept: "application/json"}, body: new URLSearchParams(params)
  });
  if (!response.ok) throw new Error("GitHub authorization request failed (" + response.status + ").");
  return response.json();
}

async function refresh() {
  const {token, config, stats = {}, lastSync, lastError} = await chrome.storage.local.get(
    ["token", "config", "stats", "lastSync", "lastError"]
  );
  byId("settings").hidden = Boolean(token);
  byId("disconnect").hidden = !token;
  byId("stats").replaceChildren(...platforms.flatMap(platform => {
    const name = document.createElement("dt");
    const count = document.createElement("dd");
    name.textContent = platform;
    count.textContent = stats[platform] ?? 0;
    return [name, count];
  }));
  byId("last").textContent = lastSync ? "Last sync " + new Date(lastSync).toLocaleString() : "";
  if (token) status(lastError || "Connected to " + config.repository);
}

const {config} = await chrome.storage.local.get("config");
if (config) {
  byId("repo").value = config.repository;
  byId("client").value = config.clientId;
}

async function completeDeviceFlow(flow) {
  const {deviceCode, clientId, repository, expiresAt} = flow;
  let delay = flow.interval * 1000;
  byId("connect").disabled = true;
  byId("code").textContent = flow.userCode;
  byId("device").hidden = false;
  status("Waiting for GitHub authorization…");
  try {
    while (Date.now() < expiresAt) {
      await new Promise(resolve => setTimeout(resolve, delay));
      if (Date.now() >= expiresAt) break;
      const reply = await oauth("oauth/access_token", {
        client_id: clientId, device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code"
      });
      if (reply.error === "authorization_pending") continue;
      if (reply.error === "slow_down") { delay += 5000; continue; }
      if (!reply.access_token) throw new Error(reply.error_description || "GitHub authorization failed.");
      const result = await fetch("https://api.github.com/repos/" + repository, {
        headers: {Authorization: "Bearer " + reply.access_token, Accept: "application/vnd.github+json"}
      });
      if (!result.ok || !(await result.json()).permissions?.push) {
        throw new Error("GitHub did not grant write access to the destination repository.");
      }
      await chrome.storage.local.set({token: reply.access_token, config: {repository, clientId}, lastError: ""});
      await refresh();
      return;
    }
    throw new Error("The device code expired. Connect again to request a new one.");
  } catch (error) {
    status(error.message);
  } finally {
    await chrome.storage.session.remove("deviceFlow");
    byId("device").hidden = true;
    byId("connect").disabled = false;
  }
}

byId("settings").addEventListener("submit", async event => {
  event.preventDefault();
  byId("connect").disabled = true;
  try {
    const repository = repositoryName(byId("repo").value);
    const clientId = byId("client").value.trim();
    if (!/^[a-z\d]+$/i.test(clientId)) throw new Error("Enter a valid GitHub OAuth client ID.");
    const reply = await oauth("device/code", {client_id: clientId, scope: "repo"});
    if (!reply.device_code) throw new Error(reply.error_description || "Enable device flow in your GitHub OAuth app.");
    const flow = {repository, clientId, deviceCode: reply.device_code, userCode: reply.user_code,
      expiresAt: Date.now() + reply.expires_in * 1000, interval: reply.interval || 5};
    await chrome.storage.session.set({deviceFlow: flow});
    await completeDeviceFlow(flow);
  } catch (error) {
    status(error.message);
    byId("connect").disabled = false;
  }
});
byId("disconnect").addEventListener("click", async () => {
  await chrome.storage.local.remove(["token", "lastError"]);
  status("Disconnected. You can revoke the app in GitHub settings.");
  await refresh();
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") refresh().catch(error => status(error.message));
});
await refresh();
const {deviceFlow} = await chrome.storage.session.get("deviceFlow");
if (deviceFlow) await completeDeviceFlow(deviceFlow);
