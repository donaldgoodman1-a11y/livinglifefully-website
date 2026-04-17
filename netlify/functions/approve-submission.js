 const https = require("https");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || "donaldgoodman1-a11y/livinglifefully-website";
const PENDING_FILE = "data/pending-submissions.json";
const QUOTES_FILE = "NEW WEBSITE FOREVER/Data/community-wisdom.json";

function githubRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: "api.github.com",
      path,
      method,
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "User-Agent": "livinglifefully-site",
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        ...(bodyStr ? { "Content-Length": Buffer.byteLength(bodyStr) } : {}),
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {} });
        } catch (e) {
          reject(new Error("Failed to parse GitHub response: " + data));
        }
      });
    });
    req.on("error", reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

 const authHeader = event.headers["authorization"] || "";
if (!authHeader.startsWith("Bearer ")) {
  return { statusCode: 401, headers, body: JSON.stringify({ error: "Unauthorized" }) };
}

  let id, wisdom, author;
  try {
    ({ id, wisdom, author } = JSON.parse(event.body));
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid request body" }) };
  }

  if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing submission ID" }) };
  if (!wisdom) return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing wisdom text" }) };
  if (!GITHUB_TOKEN) return { statusCode: 500, headers, body: JSON.stringify({ error: "GitHub token not configured" }) };

  try {
    // Step 1: Get pending submissions
    const pendingGet = await githubRequest("GET", `/repos/${GITHUB_REPO}/contents/${PENDING_FILE}`);
    if (pendingGet.status === 404) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: "No pending submissions found" }) };
    }
    if (pendingGet.status !== 200) throw new Error(`GitHub API error getting pending: ${pendingGet.status}`);

    const pendingSha = pendingGet.body.sha;
    const pendingData = JSON.parse(Buffer.from(pendingGet.body.content, "base64").toString("utf8"));
    const pending = pendingData.pending || [];
    const submission = pending.find(sub => sub.id === id);
    if (!submission) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: "Submission not found" }) };
    }

    pendingData.pending = pending.filter(sub => sub.id !== id);
    pendingData.approvedCount = (pendingData.approvedCount || 0) + 1;

    // Step 2: Get quotes.json
    const quotesGet = await githubRequest("GET", `/repos/${GITHUB_REPO}/contents/${QUOTES_FILE}`);
    if (quotesGet.status !== 200) throw new Error(`GitHub API error getting quotes.json: ${quotesGet.status}`);

    const quotesSha = quotesGet.body.sha;
    const quotesData = JSON.parse(Buffer.from(quotesGet.body.content, "base64").toString("utf8"));
    quotesData.quotes = quotesData.quotes || [];

    // New quote — inactive:false so it shows immediately, communitySubmission:true for filtering
    const newQuote = {
      text: (wisdom || submission.wisdom).trim(),
      author: (author || submission.author || "Anonymous Reader").trim(),
      date: new Date().toISOString().split("T")[0],
      inactive: false,
      communitySubmission: true,
    };

    quotesData.quotes.unshift(newQuote);
    quotesData.totalQuotes = quotesData.quotes.length;
    quotesData.activeQuotes = quotesData.quotes.filter(q => !q.inactive).length;
    quotesData.inactiveQuotes = quotesData.quotes.filter(q => q.inactive).length;

    // Step 3: Save quotes.json
    const quotesUpdate = await githubRequest("PUT", `/repos/${GITHUB_REPO}/contents/${QUOTES_FILE}`, {
      message: `Approved community wisdom from ${newQuote.author}`,
      content: Buffer.from(JSON.stringify(quotesData, null, 2)).toString("base64"),
      sha: quotesSha,
      branch: "main",
    });
    if (quotesUpdate.status !== 200 && quotesUpdate.status !== 201) {
      throw new Error("Failed to update quotes.json");
    }

    // Step 4: Save pending-submissions.json
    const pendingUpdate = await githubRequest("PUT", `/repos/${GITHUB_REPO}/contents/${PENDING_FILE}`, {
      message: `Approved and removed submission ${id}`,
      content: Buffer.from(JSON.stringify(pendingData, null, 2)).toString("base64"),
      sha: pendingSha,
      branch: "main",
    });
    if (pendingUpdate.status !== 200 && pendingUpdate.status !== 201) {
      throw new Error("Failed to update pending submissions file");
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: "Wisdom approved and published!", quote: newQuote }),
    };
  } catch (err) {
    console.error("approve-submission error:", err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
