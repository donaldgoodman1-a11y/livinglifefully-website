 exports.handler = async (event) => {
  // Check for admin key
  const adminKey = event.headers['x-admin-key'];
const expectedKey = 'admin123';
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

    // DEBUG: Log token and repo info
    console.log('=== DEBUG INFO ===');
    console.log('GitHub repo:', githubRepo);
    console.log('Token present:', !!githubToken);
    console.log('Token prefix:', githubToken.substring(0, 10));
    console.log('Token length:', githubToken.length);

    // Step 1: Get current community-wisdom.json from GitHub
    const filePath = 'NEW%20WEBSITE%20FOREVER/Data/community-wisdom.json';
    const fullUrl = `https://api.github.com/repos/${githubRepo}/contents/${filePath}?ref=main`;
    
    console.log('GET URL:', fullUrl);

    const getFileResponse = await fetch(fullUrl, {
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    
    console.log('GET response status:', getFileResponse.status);

    let currentData = { quotes: [] };
    let sha = null;
    
    if (getFileResponse.ok) {
      const fileData = await getFileResponse.json();
      sha = fileData.sha;
      console.log('File SHA:', sha);
      const content = Buffer.from(fileData.content, 'base64').toString('utf8');
      currentData = JSON.parse(content);
      console.log('Current quotes count:', currentData.quotes ? currentData.quotes.length : 0);
    } else if (getFileResponse.status === 404) {
      const body404 = await getFileResponse.json();
      console.log('GET 404 body:', JSON.stringify(body404));
      console.log('community-wisdom.json not found, will create new file');
    } else {
      const errorData = await getFileResponse.json();
      console.error('GitHub API error getting file:', errorData);
      throw new Error('Failed to read community wisdom file');
    }
    
    // Step 2: Add the new quote
    const newQuote = {
      text: wisdom.trim(),
      author: (author && author.trim()) || 'Anonymous Reader',
      date: new Date().toISOString().split('T')[0]
    };
    
    currentData.quotes = currentData.quotes || [];
    currentData.quotes.unshift(newQuote);
    
    // Step 3: Update the file on GitHub
    const updateBody = {
      message: `Approved wisdom from ${newQuote.author}`,
      content: Buffer.from(JSON.stringify(currentData, null, 2)).toString('base64'),
      branch: 'main'
    };
    
    if (sha) {
      updateBody.sha = sha;
    }

    const putUrl = `https://api.github.com/repos/${githubRepo}/contents/${filePath}`;
    console.log('PUT URL:', putUrl);
    console.log('SHA included:', !!sha);
    
    const updateResponse = await fetch(putUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: JSON.stringify(updateBody)
    });
    
    console.log('PUT response status:', updateResponse.status);

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
