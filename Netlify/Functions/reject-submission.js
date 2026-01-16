// Netlify Function: Reject a submission (delete from Netlify Forms)
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
    const { submissionId } = JSON.parse(event.body);
    
    if (!submissionId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing submission ID' })
      };
    }

    const apiToken = process.env.NETLIFY_API_TOKEN;
    
    if (!apiToken) {
      throw new Error('Missing Netlify API token');
    }

    // Delete submission from Netlify Forms
    const response = await fetch(
      `https://api.netlify.com/api/v1/submissions/${submissionId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${apiToken}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to delete submission: ${response.status}`);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        success: true, 
        message: 'Submission rejected and deleted'
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
