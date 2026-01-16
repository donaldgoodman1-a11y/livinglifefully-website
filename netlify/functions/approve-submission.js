// Netlify Function: Approve a submission and add to community-wisdom.json
const fs = require('fs').promises;
const path = require('path');

exports.handler = async (event, context) => {
  // Only allow authenticated users
  const { user } = context.clientContext;
  if (!user) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { submissionId, wisdom, author } = JSON.parse(event.body);
    
    if (!wisdom) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing wisdom text' })
      };
    }

    // Read current community-wisdom.json
    const jsonPath = path.join(__dirname, '../../data/community-wisdom.json');
    let data;
    try {
      const fileContent = await fs.readFile(jsonPath, 'utf8');
      data = JSON.parse(fileContent);
    } catch (err) {
      // If file doesn't exist, start fresh
      data = { quotes: [] };
    }

    // Add new quote
    const newQuote = {
      text: wisdom,
      author: author || 'Anonymous Reader',
      date: new Date().toISOString()
    };
    
    data.quotes.unshift(newQuote); // Add to beginning of array

    // Write back to file
    await fs.writeFile(jsonPath, JSON.stringify(data, null, 2), 'utf8');

    // Optionally delete submission from Netlify Forms
    if (submissionId) {
      const siteId = process.env.SITE_ID;
      const apiToken = process.env.NETLIFY_API_TOKEN;
      
      if (siteId && apiToken) {
        await fetch(
          `https://api.netlify.com/api/v1/submissions/${submissionId}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${apiToken}`
            }
          }
        );
      }
    }

    // Trigger a new deploy to update the site
    const buildHookUrl = process.env.BUILD_HOOK_URL;
    if (buildHookUrl) {
      await fetch(buildHookUrl, { method: 'POST' });
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        success: true, 
        message: 'Quote approved and published',
        quote: newQuote
      })
    };
  } catch (error) {
    console.error('Error approving submission:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
