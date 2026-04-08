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

  // Check for admin password
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminPassword) {
    const authHeader = event.headers["authorization"] || "";
    const provided = authHeader.replace("Bearer ", "").trim();
    if (provided !== adminPassword) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }
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
      `/repos/${GITHUB_REPO}/contents/${FILE_PATH}`
    );

    if (response.status === 404) {
      // File doesn't exist yet — return empty arrays
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ pending: [], approved: [], rejected: [] }),
      };
    }

    if (response.status !== 200) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const content = Buffer.from(response.body.content, "base64").toString(
      "utf8"
    );
    const data = JSON.parse(content);

    // Support both array format and object format
    let pending = [];
    let approved = [];
    let rejected = [];

    if (Array.isArray(data)) {
      // Legacy: flat array — treat all as pending
      pending = data;
    } else {
      pending = data.pending || [];
      approved = data.approved || [];
      rejected = data.rejected || [];
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ pending, approved, rejected }),
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
