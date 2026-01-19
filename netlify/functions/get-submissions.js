/**
 * Get Submissions from Netlify Forms
 * Fetches pending quote submissions for admin review
 */

exports.handler = async (event) => {
  // Check admin authentication
  const adminKey = event.headers['x-admin-key'];
  const expectedKey = process.env.ADMIN_KEY || 'admin123';
  
  if (!adminKey || adminKey !== expectedKey) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  try {
    const netlifyToken = process.env.NETLIFY_API_TOKEN;
    const siteId = process.env.MY_SITE_ID; // Your Netlify site ID
    
    if (!netlifyToken) {
      console.error('NETLIFY_API_TOKEN not set');
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Server configuration error: Missing NETLIFY_API_TOKEN' })
      };
    }

    if (!siteId) {
      console.error('MY_SITE_ID not set');
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Server configuration error: Missing MY_SITE_ID' })
      };
    }

    // First, get the form ID for "quote-submission" (or your form name)
    const formsResponse = await fetch(
      `https://api.netlify.com/api/v1/sites/${siteId}/forms`,
      {
        headers: {
          'Authorization': `Bearer ${netlifyToken}`
        }
      }
    );

    if (!formsResponse.ok) {
      const errorText = await formsResponse.text();
      console.error('Failed to fetch forms:', formsResponse.status, errorText);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Failed to fetch forms from Netlify' })
      };
    }

    const forms = await formsResponse.json();
    console.log('Available forms:', forms.map(f => f.name));
    
    // Find the quote submission form - try multiple possible names
    const formNames = ['quote-submission', 'quote-form', 'contribute', 'wisdom-submission', 'contact'];
    let quoteForm = null;
    
    for (const name of formNames) {
      quoteForm = forms.find(f => f.name.toLowerCase() === name.toLowerCase());
      if (quoteForm) {
        console.log(`Found form: ${quoteForm.name} with ID: ${quoteForm.id}`);
        break;
      }
    }
    
    // If no specific form found, use the first form or list all available
    if (!quoteForm && forms.length > 0) {
      console.log('Using first available form:', forms[0].name);
      quoteForm = forms[0];
    }
    
    if (!quoteForm) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          pending: [], 
          approvedCount: 0, 
          rejectedCount: 0,
          message: 'No forms found on this site'
        })
      };
    }

    // Fetch submissions for this form
    const submissionsResponse = await fetch(
      `https://api.netlify.com/api/v1/forms/${quoteForm.id}/submissions`,
      {
        headers: {
          'Authorization': `Bearer ${netlifyToken}`
        }
      }
    );

    if (!submissionsResponse.ok) {
      const errorText = await submissionsResponse.text();
      console.error('Failed to fetch submissions:', submissionsResponse.status, errorText);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Failed to fetch submissions' })
      };
    }

    const submissions = await submissionsResponse.json();
    console.log(`Found ${submissions.length} submissions`);

    // Transform submissions to match what admin.html expects
    const pending = submissions.map(sub => {
      // Handle different possible field names from the form
      const wisdom = sub.data.quote || sub.data.wisdom || sub.data.message || sub.data.text || '';
      const author = sub.data.author || sub.data.name || sub.data.submitter_name || 'Anonymous';
      
      return {
        id: sub.id,
        wisdom: wisdom,
        author: author,
        date: sub.created_at,
        email: sub.data.email || sub.data.submitter_email || ''
      };
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pending: pending,
        approvedCount: 0,  // We don't track this currently
        rejectedCount: 0,  // We don't track this currently
        formName: quoteForm.name,
        totalSubmissions: submissions.length
      })
    };

  } catch (error) {
    console.error('Error in get-submissions:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
