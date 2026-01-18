const fetch = require('node-fetch');

exports.handler = async (event) => {
  const adminKey = event.headers['x-admin-key'];
  const expectedKey = process.env.ADMIN_KEY;
  
  if (!adminKey || adminKey !== expectedKey) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  try {
    const siteId = process.env.SITE_ID;
    const netlifyToken = process.env.NETLIFY_API_TOKEN;

    if (!netlifyToken) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Missing NETLIFY_API_TOKEN' })
      };
    }

    const formsResponse = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/forms`, {
      headers: { 'Authorization': `Bearer ${netlifyToken}` }
    });

    if (!formsResponse.ok) throw new Error('Failed to fetch forms');

    const forms = await formsResponse.json();
    const quoteForm = forms.find(f => f.name === 'quote-submission');

    if (!quoteForm) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pending: [], approvedCount: 0, rejectedCount: 0 })
      };
    }

    const submissionsResponse = await fetch(
      `https://api.netlify.com/api/v1/forms/${quoteForm.id}/submissions?per_page=100`,
      { headers: { 'Authorization': `Bearer ${netlifyToken}` } }
    );

    if (!submissionsResponse.ok) throw new Error('Failed to fetch submissions');

    const submissions = await submissionsResponse.json();

    const pending = submissions
      .filter(sub => !sub.spam)
      .map(sub => ({
        id: sub.id,
        wisdom: sub.data.quote || sub.data.Quote || '',
        author: sub.data.author || sub.data.Author || 'Anonymous',
        date: sub.created_at
      }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pending,
        approvedCount: 0,
        rejectedCount: submissions.filter(sub => sub.spam).length
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
