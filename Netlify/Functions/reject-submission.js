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
    const { id } = JSON.parse(event.body);

    if (!id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing submission ID' })
      };
    }

    const netlifyToken = process.env.NETLIFY_API_TOKEN;

    if (!netlifyToken) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error: Missing NETLIFY_API_TOKEN' })
      };
    }

    // Mark the submission as spam (removes from main list but keeps record)
    const spamResponse = await fetch(
      `https://api.netlify.com/api/v1/submissions/${id}/spam`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${netlifyToken}`
        }
      }
    );

    if (!spamResponse.ok) {
      // If marking as spam fails, try to delete it
      const deleteResponse = await fetch(
        `https://api.netlify.com/api/v1/submissions/${id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${netlifyToken}`
          }
        }
      );

      if (!deleteResponse.ok) {
        throw new Error('Failed to reject submission');
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: true, 
        message: 'Submission rejected'
      })
    };

  } catch (error) {
    console.error('Error rejecting submission:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
