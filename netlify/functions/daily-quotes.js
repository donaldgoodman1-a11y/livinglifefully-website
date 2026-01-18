/**
 * Netlify Scheduled Function: Daily Quote Submitter
 * 
 * This function runs automatically every day at 8:00 AM UTC
 * and submits 3 random quotes to your moderation queue.
 * 
 * SETUP INSTRUCTIONS:
 * 1. Place this file in: netlify/functions/daily-quotes.js
 * 2. Place quotes.json in: data/quotes.json (at root of your repo)
 * 3. Add to netlify.toml (see below)
 * 4. Set environment variable QUOTE_SUBMIT_ENDPOINT in Netlify dashboard
 * 5. Deploy to Netlify
 * 
 * Add this to your netlify.toml:
 * 
 * [functions.daily-quotes]
 *   schedule = "0 8 * * *"
 * 
 * This runs at 8:00 AM UTC daily. Adjust as needed:
 * - "0 14 * * *" = 2:00 PM UTC (7:00 AM Pacific)
 * - "0 15 * * *" = 3:00 PM UTC (8:00 AM Pacific)
 */

const quotes = require('../../data/quotes.json');

// Configuration
const QUOTES_PER_DAY = 3;
const SUBMITTER_NAME = 'Daily Wisdom (Auto)';

/**
 * Get random quotes without repeating recently used ones
 */
function getRandomQuotes(allQuotes, count) {
  // Shuffle and pick
  const shuffled = [...allQuotes].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

/**
 * Submit a single quote to the moderation queue
 */
async function submitQuote(quote, endpoint) {
  const payload = {
    quote: quote.quote,
    author: quote.author,
    source: quote.source || '',
    submitter_name: SUBMITTER_NAME,
    submitter_email: ''
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      return { success: true, author: quote.author };
    } else {
      const errorText = await response.text();
      return { success: false, author: quote.author, error: `HTTP ${response.status}: ${errorText}` };
    }
  } catch (error) {
    return { success: false, author: quote.author, error: error.message };
  }
}

/**
 * Main scheduled function handler
 */
exports.handler = async (event, context) => {
  console.log('Daily Quote Submitter started at:', new Date().toISOString());

  // Get the endpoint from environment variable
  const endpoint = process.env.QUOTE_SUBMIT_ENDPOINT;
  
  if (!endpoint) {
    console.error('QUOTE_SUBMIT_ENDPOINT environment variable not set');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'QUOTE_SUBMIT_ENDPOINT not configured' })
    };
  }

  // Select random quotes
  const selectedQuotes = getRandomQuotes(quotes.quotes, QUOTES_PER_DAY);
  
  console.log(`Selected ${selectedQuotes.length} quotes for today:`);
  selectedQuotes.forEach((q, i) => {
    console.log(`  ${i + 1}. "${q.quote.substring(0, 50)}..." - ${q.author}`);
  });

  // Submit each quote
  const results = [];
  for (const quote of selectedQuotes) {
    const result = await submitQuote(quote, endpoint);
    results.push(result);
    
    // Small delay between submissions
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Log results
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`Submission complete: ${successful} successful, ${failed} failed`);
  
  if (failed > 0) {
    console.log('Failed submissions:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.author}: ${r.error}`);
    });
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: `Daily quotes submitted: ${successful} successful, ${failed} failed`,
      date: new Date().toISOString(),
      quotes: selectedQuotes.map(q => ({ author: q.author, preview: q.quote.substring(0, 50) + '...' })),
      results
    })
  };
};
