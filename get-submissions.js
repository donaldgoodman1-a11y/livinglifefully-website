// Netlify Function: Fetch submissions from Netlify Forms API
exports.handler = async (event, context) => {
  // Only allow authenticated users
  const { user } = context.clientContext;
  if (!user) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  try {
    const siteId = process.env.SITE_ID;
    const apiToken = process.env.NETLIFY_API_TOKEN;
    
    if (!siteId || !apiToken) {
      throw new Error('Missing environment variables');
    }

    // Fetch submissions from Netlify Forms API
    const response = await fetch(
      `https://api.netlify.com/api/v1/sites/${siteId}/submissions`,
      {
        headers: {
          'Authorization': `Bearer ${apiToken}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Netlify API error: ${response.status}`);
    }

    const submissions = await response.json();
    
    // Filter for community-wisdom form and not yet processed
    const wisdomSubmissions = submissions.filter(sub => 
      sub.form_name === 'community-wisdom' && 
      sub.data && 
      sub.data.wisdom
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(wisdomSubmissions)
    };
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
