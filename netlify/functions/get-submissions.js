 const https = require("https");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || "donaldgoodman1-a11y/livinglifefully-website";
const PENDING_FILE = "data/pending-submissions.json";

function githubGet(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.github.com",
      path,
      method: "GET",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "User-Agent": "livinglifefully-site",
        Accept: "application/vnd.github.v3+json",
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          reject(new Error("Failed to parse GitHub response: " + data));
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  // Simple password check
  const adminKey = process.env.ADMIN_KEY;
  const authHeader = event.headers["authorization"] || "";
  const provided = authHeader.replace("Bearer ", "").trim();
  if (!provided || (adminKey && provided !== adminKey)) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: "Unauthorized" }),
    };
  }

  if (!GITHUB_TOKEN) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "GitHub token not configured" }),
    };
  }

  try {
    const response = await githubGet(
      `/repos/${GITHUB_REPO}/contents/${PENDING_FILE}`
    );

    if (response.status === 404) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ pending: [], approvedCount: 0, rejectedCount: 0 }),
      };
    }

    if (response.status !== 200) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const content = Buffer.from(response.body.content, "base64").toString("utf8");
    const data = JSON.parse(content);

    const pending = data.pending || [];
    const approvedCount = data.approvedCount || 0;
    const rejectedCount = data.rejectedCount || 0;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ pending, approvedCount, rejectedCount }),
    };
  } catch (err) {
    console.error("get-submissions error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
