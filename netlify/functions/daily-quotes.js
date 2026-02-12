 /**
 * Netlify Scheduled Function: Daily Quote Publisher
 * 
 * Runs every day at 8:00 AM Pacific (3:00 PM UTC)
 * - Uses ALL quotes in community-wisdom.json as the quote bank
 * - Keeps only 30 quotes marked as "active" for display
 * - Randomly selects 5 new quotes daily from inactive ones
 * - Marks 5 oldest active quotes as inactive
 * 
 * Add this to your netlify.toml:
 * 
 * [functions.daily-quotes]
 *   schedule = "0 15 * * *"
 */

// Configuration
const QUOTES_PER_DAY = 5;
const QUOTES_TO_ROTATE_DAILY = 5;
const MAX_ACTIVE_QUOTES = 30; // Keep only 30 "active" quotes for display

exports.handler = async (event, context) => {
  console.log('=== Daily Quote Publisher started at:', new Date().toISOString());

  const githubToken = process.env.GITHUB_TOKEN;
  const githubRepo = process.env.GITHUB_REPO || 'donaldgoodman1-a11y/livinglifefully-website';
  const filePath = 'NEW WEBSITE FOREVER/Data/community-wisdom.json';

  if (!githubToken) {
    console.error('GITHUB_TOKEN not set');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'GITHUB_TOKEN not configured' })
    };
  }

  try {
    // Step 1: Get current community-wisdom.json from GitHub
    console.log('Step 1: Fetching current community-wisdom.json...');
    const getFileResponse = await fetch(
      `https://api.github.com/repos/${githubRepo}/contents/${filePath}`,
      {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    if (!getFileResponse.ok) {
      throw new Error('Could not fetch community-wisdom.json');
    }

    const fileData = await getFileResponse.json();
    const sha = fileData.sha;
    const content = Buffer.from(fileData.content, 'base64').toString('utf8');
    const currentData = JSON.parse(content);
    currentData.quotes = currentData.quotes || [];
    
    console.log(`   Total quotes in file: ${currentData.quotes.length}`);

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
    console.log(`   Today's date: ${today}`);

    // Step 2: Separate active and inactive quotes
    // Active quotes are those without "inactive" flag or where inactive=false
    let activeQuotes = currentData.quotes.filter(q => !q.inactive);
    let inactiveQuotes = currentData.quotes.filter(q => q.inactive);
    
    console.log(`   Active quotes: ${activeQuotes.length}, Inactive quotes: ${inactiveQuotes.length}`);

    // Step 3: If this is first run, mark oldest quotes as inactive to get to MAX_ACTIVE_QUOTES
    if (inactiveQuotes.length === 0 && activeQuotes.length > MAX_ACTIVE_QUOTES) {
      console.log('Step 3: First run - marking oldest quotes as inactive...');
      const excessCount = activeQuotes.length - MAX_ACTIVE_QUOTES;
      // Take the oldest quotes (from the end of the array) and mark as inactive
      const quotesToMarkInactive = activeQuotes.slice(-excessCount);
      quotesToMarkInactive.forEach(q => q.inactive = true);
      
      // Rebuild the lists
      activeQuotes = activeQuotes.slice(0, MAX_ACTIVE_QUOTES);
      inactiveQuotes = quotesToMarkInactive;
      
      console.log(`   Marked ${excessCount} quotes as inactive`);
      console.log(`   New counts - Active: ${activeQuotes.length}, Inactive: ${inactiveQuotes.length}`);
    }

    // Step 4: Rotate - mark oldest active quotes as inactive
    let quotesRotated = 0;
    if (activeQuotes.length >= MAX_ACTIVE_QUOTES) {
      const quotesToDeactivate = activeQuotes.slice(-QUOTES_TO_ROTATE_DAILY);
      quotesToDeactivate.forEach(q => {
        q.inactive = true;
        q.deactivatedDate = today;
      });
      
      // Remove from active, add to inactive
      activeQuotes = activeQuotes.slice(0, -QUOTES_TO_ROTATE_DAILY);
      inactiveQuotes = [...inactiveQuotes, ...quotesToDeactivate];
      quotesRotated = quotesToDeactivate.length;
      
      console.log(`Step 4: Marked ${quotesRotated} oldest active quotes as inactive`);
    } else {
      console.log(`Step 4: No rotation needed (only ${activeQuotes.length} active quotes)`);
    }

    // Step 5: Select random quotes from inactive pool
    console.log('Step 5: Selecting new random quotes from inactive pool...');
    
    if (inactiveQuotes.length < QUOTES_PER_DAY) {
      console.log(`   WARNING: Only ${inactiveQuotes.length} inactive quotes available (need ${QUOTES_PER_DAY})`);
    }
    
    // Shuffle and select
    const shuffledInactive = [...inactiveQuotes].sort(() => 0.5 - Math.random());
    const selectedQuotes = shuffledInactive.slice(0, Math.min(QUOTES_PER_DAY, shuffledInactive.length));
    
    console.log(`   Selected ${selectedQuotes.length} quotes from inactive pool`);

    // Step 6: Mark selected quotes as active and add today's date
    selectedQuotes.forEach(quote => {
      quote.inactive = false;
      quote.date = today;
      delete quote.deactivatedDate; // Clean up
    });

    // Add selected quotes to the beginning of active quotes
    activeQuotes = [...selectedQuotes, ...activeQuotes];
    
    // Remove selected quotes from inactive pool
    const selectedTexts = new Set(selectedQuotes.map(q => q.text + '|' + q.author));
    inactiveQuotes = inactiveQuotes.filter(q => !selectedTexts.has(q.text + '|' + q.author));

    console.log(`   New counts - Active: ${activeQuotes.length}, Inactive: ${inactiveQuotes.length}`);

    // Step 7: Rebuild the full quotes array (active first, then inactive)
    currentData.quotes = [...activeQuotes, ...inactiveQuotes];
    currentData.lastRotation = today;
    currentData.totalQuotes = currentData.quotes.length;
    currentData.activeQuotes = activeQuotes.length;
    currentData.inactiveQuotes = inactiveQuotes.length;

    // Step 8: Update the file on GitHub
    console.log('Step 8: Committing changes to GitHub...');
    const commitMessage = `Daily wisdom: Activated ${selectedQuotes.length} quotes, deactivated ${quotesRotated} quotes (${activeQuotes.length} active, ${inactiveQuotes.length} inactive) - ${today}`;

    const updateBody = {
      message: commitMessage,
      content: Buffer.from(JSON.stringify(currentData, null, 2)).toString('base64'),
      sha: sha
    };

    const updateResponse = await fetch(
      `https://api.github.com/repos/${githubRepo}/contents/${filePath}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateBody)
      }
    );

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json();
      console.error('GitHub API error:', errorData);
      throw new Error('Failed to update community wisdom file');
    }

    console.log('=== SUCCESS! Daily quotes published ===');

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: commitMessage,
        quotesActivated: selectedQuotes.length,
        quotesDeactivated: quotesRotated,
        activeQuotes: activeQuotes.length,
        inactiveQuotes: inactiveQuotes.length,
        totalQuotes: currentData.quotes.length,
        maxActiveQuotes: MAX_ACTIVE_QUOTES,
        lastRotation: currentData.lastRotation,
        selectedQuotes: selectedQuotes.map(q => ({ 
          text: q.text.substring(0, 50) + '...', 
          author: q.author 
        }))
      })
    };

  } catch (error) {
    console.error('=== ERROR in daily-quotes:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
