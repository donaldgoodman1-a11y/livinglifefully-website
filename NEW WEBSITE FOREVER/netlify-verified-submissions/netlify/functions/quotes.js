export async function handler() {
  try {
    const siteId = process.env.NETLIFY_SITE_ID;
    const token  = process.env.NETLIFY_ACCESS_TOKEN;
    const formName = process.env.NETLIFY_FORM_NAME || "Verified Submissions";

    if (!siteId || !token) {
      return json(500, { error: "Missing environment variables." });
    }

    const formsRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/forms`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const forms = await formsRes.json();
    const form = forms.find(f => f.name === formName);
    if (!form) return json(404, { error: "Form not found." });

    const subsRes = await fetch(`https://api.netlify.com/api/v1/forms/${form.id}/submissions`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const submissions = await subsRes.json();

    const approved = submissions
      .filter(s => s.spam !== true)
      .map(s => ({
        quote: (s.data?.quote || "").trim(),
        author: (s.data?.author || "").trim()
      }))
      .filter(q => q.quote.length);

    return json(200, { quotes: approved });
  } catch (e) {
    return json(500, { error: e.message });
  }
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(body)
  };
}
