const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // Check for authentication
  if (!context.clientContext || !context.clientContext.user) {
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
        body: JSON.stringify({ error: 'Server configuration error: Missing API token' })
      };
    }

    // Mark the submission as spam (this removes it from the main list but keeps a record)
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
      // If marking as spam fails, try to delete it instead
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
