const fetch = require('node-fetch');

exports.handler = async (event) => {
  // Check for admin key
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
        body: JSON.stringify({ error: 'Server configuration error: Missing NETLIFY_API_TOKEN' })
      };
    }

    // Get all forms for the site
    const formsResponse = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/forms`, {
      headers: {
        'Authorization': `Bearer ${netlifyToken}`
      }
    });

    if (!formsResponse.ok) {
      throw new Error('Failed to fetch forms');
    }

    const forms = await formsResponse.json();
    const wisdomForm = forms.find(f => f.name === 'wisdom-submissions');

    if (!wisdomForm) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pending: [], approvedCount: 0, rejectedCount: 0 })
      };
    }

    // Get submissions for this form
    const submissionsResponse = await fetch(
      `https://api.netlify.com/api/v1/forms/${wisdomForm.id}/submissions?per_page=100`,
      {
        headers: {
          'Authorization': `Bearer ${netlifyToken}`
        }
      }
    );

    if (!submissionsResponse.ok) {
      throw new Error('Failed to fetch submissions');
    }

    const submissions = await submissionsResponse.json();

    // Filter and format pending submissions (not spam)
    const pending = submissions
      .filter(sub => !sub.spam)
      .map(sub => ({
        id: sub.id,
        wisdom: sub.data.wisdom || sub.data.Wisdom || '',
        author: sub.data.author || sub.data.Author || 'Anonymous Reader',
        date: sub.created_at
      }));

    // Count spam as "rejected"
    const rejectedCount = submissions.filter(sub => sub.spam).length;

    // Try to get approved count from community-wisdom.json
    let approvedCount = 0;
    try {
      const wisdomResponse = await fetch('https://livinglifefullywithhope.com/data/community-wisdom.json');
      if (wisdomResponse.ok) {
        const wisdomData = await wisdomResponse.json();
        approvedCount = wisdomData.quotes?.length || 0;
      }
    } catch (e) {
      // Ignore errors fetching approved count
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pending,
        approvedCount,
        rejectedCount
      })
    };

  } catch (error) {
    console.error('Error fetching submissions:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
