const sites = [
  ["leetcode.com", "LeetCode", /\/problems\/([^/]+)/i],
  ["codechef.com", "CodeChef", /\/problems\/([^/]+)/i],
  ["hackerrank.com", "HackerRank", /\/challenges\/([^/]+)/i],
  ["geeksforgeeks.org", "GeeksforGeeks", /\/problems\/([^/]+)/i]
];
const extensions = {
  python: "py", python3: "py", cpp: "cpp", "c++": "cpp", java: "java",
  javascript: "js", typescript: "ts", c: "c", csharp: "cs", "c#": "cs",
  go: "go", golang: "go", rust: "rs", ruby: "rb", php: "php", kotlin: "kt",
  swift: "swift", scala: "scala", sql: "sql", bash: "sh", shell: "sh",
  dart: "dart", elixir: "ex", haskell: "hs", perl: "pl", lua: "lua"
};
export function solutionPath(submission, senderUrl) {
  const url = new URL(submission.url);
  const sender = new URL(senderUrl);
  if (url.protocol !== "https:" || url.origin !== sender.origin) throw new Error("Unexpected submission origin.");
  const site = sites.find(([host]) => url.hostname === host || url.hostname.endsWith("." + host));
  const slug = site && url.pathname.match(site[2])?.[1];
  if (!slug || !/^[\w-]+$/.test(slug)) throw new Error("Unsupported problem URL.");
  if (typeof submission.code !== "string" || !submission.code.trim() ||
      new TextEncoder().encode(submission.code).length > 250000) throw new Error("Invalid solution buffer.");
  const [, platform] = site;
  const language = String(submission.language || "").trim().toLowerCase();
  const extension = Object.hasOwn(extensions, language) ? extensions[language] : "txt";
  const rating = /^\d{3,4}$/.test(submission.rating) ? Number(submission.rating) : null;
  const category = platform === "CodeChef" && rating !== null ? [String(Math.floor(rating / 100) * 100) + "s"] : [];
  return {platform, slug, path: [platform, ...category, slug + "." + extension].join("/")};
}
export function repositoryName(value) {
  const name = String(value ?? "").trim();
  if (!/^[\w-]+\/[\w.-]+$/.test(name) || /\/\.{1,2}$/.test(name)) throw new Error("Enter a repository as owner/name.");
  return name;
}
export function encodeCode(code) {
  const bytes = new TextEncoder().encode(code);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
export async function saveSolution({repository, token, submission, file, fetcher = fetch}) {
  const url = "https://api.github.com/repos/" + repositoryName(repository)
    + "/contents/" + file.path.split("/").map(encodeURIComponent).join("/");
  const headers = {
    Authorization: "Bearer " + token, Accept: "application/vnd.github+json",
    "Content-Type": "application/json", "X-GitHub-Api-Version": "2022-11-28"
  };
  const content = encodeCode(submission.code);
  for (let attempt = 0; attempt < 2; attempt++) {
    const existing = await fetcher(url, {headers});
    if (!existing.ok && existing.status !== 404) throw new Error("GitHub read failed (" + existing.status + ").");
    const previous = existing.ok ? await existing.json() : {};
    if (previous.content?.replace(/\s/g, "") === content) return false;
    const result = await fetcher(url, {method: "PUT", headers, body: JSON.stringify({
      message: "Sync " + file.platform + " solution for " + file.slug,
      content, ...(previous.sha && {sha: previous.sha})
    })});
    if (result.ok) return true;
    if (attempt === 0 && [409, 422].includes(result.status)) continue;
    throw new Error("GitHub write failed (" + result.status + "). Check repository access and initialize its default branch.");
  }
}
