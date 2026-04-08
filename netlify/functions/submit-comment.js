const https = require("https");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = "donaldgoodman1-a11y/livinglifefully-website";
const FILE_PATH = "data/community-wisdom.json";

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

function githubPut(path, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const options = {
      hostname: "api.github.com",
      path,
      method: "PUT",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "User-Agent": "livinglifefully-site",
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
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
    req.write(body);
    req.end();
  });
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
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
    const data = JSON.parse(event.body);
    const { wisdom, author } = data;

    // Validate
    if (!wisdom || wisdom.trim().length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Please enter your wisdom to share." }),
      };
    }
    if (wisdom.trim().length > 1000) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Submission is too long. Please keep it under 1000 characters.",
        }),
      };
    }

    const submission = {
      id: Date.now().toString(),
      wisdom: wisdom.trim(),
      author: (author && author.trim()) || "Anonymous Reader",
      submittedAt: new Date().toISOString(),
    };

    // Read current file from GitHub
    const getResponse = await githubGet(
      `/repos/${GITHUB_REPO}/contents/${FILE_PATH}`
    );

    let currentData = { pending: [], approved: [], rejected: [] };
    let sha = null;

    if (getResponse.status === 200) {
      sha = getResponse.body.sha;
      const content = Buffer.from(getResponse.body.content, "base64").toString("utf8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        // Legacy format — migrate
        currentData = { pending: parsed, approved: [], rejected: [] };
      } else {
        currentData = {
          pending: parsed.pending || [],
          approved: parsed.approved || [],
          rejected: parsed.rejected || [],
        };
      }
    }
    // If 404, file doesn't exist yet — we'll create it fresh

    // Add new submission to pending
    currentData.pending.push(submission);

    const updatedContent = Buffer.from(
      JSON.stringify(currentData, null, 2)
    ).toString("base64");

    const putPayload = {
      message: `New wisdom submission from ${submission.author}`,
      content: updatedContent,
      ...(sha && { sha }),
    };

    const putResponse = await githubPut(
      `/repos/${GITHUB_REPO}/contents/${FILE_PATH}`,
      putPayload
    );

    if (putResponse.status !== 200 && putResponse.status !== 201) {
      throw new Error(`GitHub write failed: ${putResponse.status}`);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: "Thank you! Your wisdom has been submitted for review.",
      }),
    };
  } catch (error) {
    console.error("submit-comment error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Sorry — your submission could not be accepted." }),
    };
  }
};
