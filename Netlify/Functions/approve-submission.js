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

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { id, wisdom, author } = JSON.parse(event.body);

    if (!wisdom) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing wisdom text' })
      };
    }

    const githubToken = process.env.GITHUB_TOKEN;
    const netlifyToken = process.env.NETLIFY_API_TOKEN;
    const githubRepo = process.env.GITHUB_REPO || 'donaldgoodman1-a11y/livinglifefully-website';

    if (!githubToken) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error: Missing GITHUB_TOKEN' })
      };
    }

    // Step 1: Get current community-wisdom.json from GitHub
    const filePath = 'data/community-wisdom.json';
    const getFileResponse = await fetch(
      `https://api.github.com/repos/${githubRepo}/contents/${filePath}`,
      {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    let currentData = { quotes: [] };
    let sha = null;

    if (getFileResponse.ok) {
      const fileData = await getFileResponse.json();
      sha = fileData.sha;
      const content = Buffer.from(fileData.content, 'base64').toString('utf8');
      currentData = JSON.parse(content);
    }

    // Step 2: Add the new quote
    const newQuote = {
      text: wisdom.trim(),
      author: (author && author.trim()) || 'Anonymous Reader',
      date: new Date().toISOString().split('T')[0]
    };

    currentData.quotes = currentData.quotes || [];
    currentData.quotes.unshift(newQuote); // Add to beginning (newest first)

    // Step 3: Update the file on GitHub
    const updateResponse = await fetch(
      `https://api.github.com/repos/${githubRepo}/contents/${filePath}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `Approved wisdom from ${newQuote.author}`,
          content: Buffer.from(JSON.stringify(currentData, null, 2)).toString('base64'),
          sha: sha
        })
      }
    );

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json();
      console.error('GitHub API error:', errorData);
      throw new Error('Failed to update community wisdom file');
    }

    // Step 4: Delete the submission from Netlify Forms
    if (id && netlifyToken) {
      try {
        await fetch(`https://api.netlify.com/api/v1/submissions/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${netlifyToken}`
          }
        });
      } catch (e) {
        console.log('Could not delete submission from Netlify Forms:', e);
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: true, 
        message: 'Wisdom approved and published!',
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
