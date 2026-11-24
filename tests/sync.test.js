import {strict as assert} from "node:assert";
import {test} from "node:test";
import {encodeCode, repositoryName, saveSolution, solutionPath} from "../extension/sync.js";

const submission = {url: "https://www.codechef.com/START100/problems/ABC", language: "cpp", rating: "1475", code: "// λ"};
const file = solutionPath(submission, submission.url);

test("categorizes CodeChef and parses the other supported platforms", () => {
  assert.equal(file.path, "CodeChef/1400s/ABC.cpp");
  for (const [host, pathname, directory] of [
    ["leetcode.com", "/problems/two-sum/", "LeetCode"],
    ["www.hackerrank.com", "/challenges/two-sum/problem", "HackerRank"],
    ["www.geeksforgeeks.org", "/problems/two-sum/1", "GeeksforGeeks"]
  ]) {
    const url = "https://" + host + pathname;
    assert.equal(solutionPath({url, language: "python", code: "print(1)"}, url).path, directory + "/two-sum.py");
  }
});

test("rejects inconsistent origins and repository paths", () => {
  assert.throws(() => solutionPath(submission, "https://example.com"));
  assert.throws(() => solutionPath({...submission, code: " "}, submission.url));
  assert.throws(() => repositoryName("owner/.."));
});

test("writes the full UTF-8 solution and retries with the current blob SHA", async () => {
  const calls = [];
  const responses = [
    new Response(null, {status: 404}), new Response(null, {status: 409}),
    Response.json({sha: "current", content: encodeCode("old")}), new Response(null, {status: 200})
  ];
  const committed = await saveSolution({repository: "owner/solutions", token: "fake", submission, file,
    fetcher: async (url, options) => { calls.push({url, ...options}); return responses.shift(); }});
  assert.equal(committed, true);
  assert.equal(calls[3].url, "https://api.github.com/repos/owner/solutions/contents/CodeChef/1400s/ABC.cpp");
  const payload = JSON.parse(calls[3].body);
  assert.equal(payload.sha, "current");
  assert.equal(Buffer.from(payload.content, "base64").toString(), submission.code);
});

test("does not write an identical solution", async () => {
  let reads = 0;
  const committed = await saveSolution({repository: "owner/solutions", token: "fake", submission, file,
    fetcher: async () => { reads++; return Response.json({content: encodeCode(submission.code)}); }});
  assert.equal(committed, false);
  assert.equal(reads, 1);
});
