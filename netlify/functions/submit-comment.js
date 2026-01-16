exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse the incoming data
    const data = JSON.parse(event.body);
    const { wisdom, author } = data;

    // Validate the submission
    if (!wisdom || wisdom.trim().length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Please enter your wisdom to share.' })
      };
    }

    if (wisdom.trim().length > 1000) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Submission is too long. Please keep it under 1000 characters.' })
      };
    }

    // Prepare the submission data
    const submission = {
      wisdom: wisdom.trim(),
      author: (author && author.trim()) || 'Anonymous Reader',
      submittedAt: new Date().toISOString()
    };

    // Submit to Netlify Forms by POSTing to the hidden form
    const formData = new URLSearchParams();
    formData.append('form-name', 'wisdom-submissions');
    formData.append('wisdom', submission.wisdom);
    formData.append('author', submission.author);
    formData.append('submission-date', submission.submittedAt);

    const response = await fetch('https://livinglifefullywithhope.com/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });

    if (!response.ok) {
      console.error('Netlify Forms submission failed:', response.status);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Submission failed. Please try again.' })
      };
    }

    // Success!
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Thank you! Your wisdom has been submitted for review.',
        submission: submission
      })
    };

  } catch (error) {
    console.error('Error processing submission:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Sorry — your submission could not be accepted.' })
    };
  }
};
