const https = require("https");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || "donaldgoodman1-a11y/livinglifefully-website";
const PENDING_FILE = "data/pending-submissions.json";

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

async function verifyNetlifyJWT(token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "livinglifefullywithhope.com",
      path: "/.netlify/identity/user",
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode === 200) {
          try { resolve(JSON.parse(data)); } catch (e) { reject(new Error("Invalid user data")); }
        } else {
          reject(new Error("Unauthorized"));
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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  // Verify Netlify Identity JWT
  const authHeader = event.headers["authorization"] || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: "Unauthorized" }) };
  }
  try {
    await verifyNetlifyJWT(token);
  } catch (err) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  // Parse body
  let id;
  try {
    ({ id } = JSON.parse(event.body));
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid request body" }) };
  }

  if (!id) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing submission ID" }) };
  }

  if (!GITHUB_TOKEN) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "GitHub token not configured" }) };
  }

  try {
    // Get current pending file
    const getResponse = await githubRequest("GET", `/repos/${GITHUB_REPO}/contents/${PENDING_FILE}`);

    if (getResponse.status === 404) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: "No pending submissions found" }) };
    }
    if (getResponse.status !== 200) {
      throw new Error(`GitHub API error: ${getResponse.status}`);
    }

    const sha = getResponse.body.sha;
    const content = Buffer.from(getResponse.body.content, "base64").toString("utf8");
    const data = JSON.parse(content);

    const pending = data.pending || [];
    const originalLength = pending.length;

    // Remove the submission with matching id
    data.pending = pending.filter(sub => sub.id !== id);

    if (data.pending.length === originalLength) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: "Submission not found" }) };
    }

    // Increment rejected count
    data.rejectedCount = (data.rejectedCount || 0) + 1;

    // Save back to GitHub
    const updateResponse = await githubRequest("PUT", `/repos/${GITHUB_REPO}/contents/${PENDING_FILE}`, {
      message: `Rejected submission ${id}`,
      content: Buffer.from(JSON.stringify(data, null, 2)).toString("base64"),
      sha,
      branch: "main",
    });

    if (updateResponse.status !== 200 && updateResponse.status !== 201) {
      throw new Error("Failed to update pending submissions file");
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: "Submission rejected" }),
    };
  } catch (err) {
    console.error("reject-submission error:", err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
