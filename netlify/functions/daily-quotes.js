 /**
 * Netlify Scheduled Function: Daily Quote Publisher
 * 
 * Runs every day at 8:00 AM Pacific (3:00 PM UTC)
 * - Adds 4 random quotes daily to community-wisdom.json
 * - Every 7 days (weekly), rotates 10 oldest quotes back to the quote bank
 * 
 * Add this to your netlify.toml:
 * 
 * [functions.daily-quotes]
 *   schedule = "0 15 * * *"
 */

// Quote bank - embedded to avoid path issues
const QUOTE_BANK = [
  {"quote": "You are never too old to set another goal or to dream a new dream.", "author": "C.S. Lewis"},
  {"quote": "Hardships often prepare ordinary people for an extraordinary destiny.", "author": "C.S. Lewis"},
  {"quote": "There are far, far better things ahead than any we leave behind.", "author": "C.S. Lewis"},
  {"quote": "Courage is not simply one of the virtues, but the form of every virtue at the testing point.", "author": "C.S. Lewis"},
  {"quote": "You have brains in your head. You have feet in your shoes. You can steer yourself any direction you choose.", "author": "Dr. Seuss"},
  {"quote": "Today you are you, that is truer than true. There is no one alive who is youer than you.", "author": "Dr. Seuss"},
  {"quote": "Why fit in when you were born to stand out?", "author": "Dr. Seuss"},
  {"quote": "Be kind, for everyone you meet is fighting a hard battle.", "author": "Plato"},
  {"quote": "The beginning is the most important part of the work.", "author": "Plato"},
  {"quote": "Wise men speak because they have something to say; fools because they have to say something.", "author": "Plato"},
  {"quote": "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", "author": "Aristotle"},
  {"quote": "Happiness depends upon ourselves.", "author": "Aristotle"},
  {"quote": "Knowing yourself is the beginning of all wisdom.", "author": "Aristotle"},
  {"quote": "In the middle of difficulty lies opportunity.", "author": "Albert Einstein"},
  {"quote": "Life is like riding a bicycle. To keep your balance, you must keep moving.", "author": "Albert Einstein"},
  {"quote": "Imagination is more important than knowledge.", "author": "Albert Einstein"},
  {"quote": "Spread love everywhere you go. Let no one ever come to you without leaving happier.", "author": "Mother Teresa"},
  {"quote": "Not all of us can do great things. But we can do small things with great love.", "author": "Mother Teresa"},
  {"quote": "Peace begins with a smile.", "author": "Mother Teresa"},
  {"quote": "I've learned that people will forget what you said, people will forget what you did, but people will never forget how you made them feel.", "author": "Maya Angelou"},
  {"quote": "Try to be a rainbow in someone's cloud.", "author": "Maya Angelou"},
  {"quote": "Nothing can dim the light which shines from within.", "author": "Maya Angelou"},
  {"quote": "Darkness cannot drive out darkness; only light can do that. Hate cannot drive out hate; only love can do that.", "author": "Martin Luther King Jr."},
  {"quote": "Faith is taking the first step even when you don't see the whole staircase.", "author": "Martin Luther King Jr."},
  {"quote": "The time is always right to do what is right.", "author": "Martin Luther King Jr."},
  {"quote": "In the end, it's not the years in your life that count. It's the life in your years.", "author": "Abraham Lincoln"},
  {"quote": "Whatever you are, be a good one.", "author": "Abraham Lincoln"},
  {"quote": "The best way to predict your future is to create it.", "author": "Abraham Lincoln"},
  {"quote": "Success is not final, failure is not fatal: it is the courage to continue that counts.", "author": "Winston Churchill"},
  {"quote": "Attitude is a little thing that makes a big difference.", "author": "Winston Churchill"},
  {"quote": "If you're going through hell, keep going.", "author": "Winston Churchill"},
  {"quote": "The best and most beautiful things in the world cannot be seen or even touched - they must be felt with the heart.", "author": "Helen Keller"},
  {"quote": "Life is either a daring adventure or nothing at all.", "author": "Helen Keller"},
  {"quote": "Keep your face to the sunshine and you cannot see a shadow.", "author": "Helen Keller"},
  {"quote": "Be the change that you wish to see in the world.", "author": "Mahatma Gandhi"},
  {"quote": "The weak can never forgive. Forgiveness is the attribute of the strong.", "author": "Mahatma Gandhi"},
  {"quote": "In a gentle way, you can shake the world.", "author": "Mahatma Gandhi"},
  {"quote": "What lies behind us and what lies before us are tiny matters compared to what lies within us.", "author": "Ralph Waldo Emerson"},
  {"quote": "To be yourself in a world that is constantly trying to make you something else is the greatest accomplishment.", "author": "Ralph Waldo Emerson"},
  {"quote": "Go confidently in the direction of your dreams. Live the life you have imagined.", "author": "Henry David Thoreau"},
  {"quote": "You have power over your mind - not outside events. Realize this, and you will find strength.", "author": "Marcus Aurelius"},
  {"quote": "The happiness of your life depends upon the quality of your thoughts.", "author": "Marcus Aurelius"},
  {"quote": "Waste no more time arguing about what a good man should be. Be one.", "author": "Marcus Aurelius"},
  {"quote": "It does not matter how slowly you go as long as you do not stop.", "author": "Confucius"},
  {"quote": "Our greatest glory is not in never falling, but in rising every time we fall.", "author": "Confucius"},
  {"quote": "Wherever you go, go with all your heart.", "author": "Confucius"},
  {"quote": "Peace comes from within. Do not seek it without.", "author": "Buddha"},
  {"quote": "The mind is everything. What you think you become.", "author": "Buddha"},
  {"quote": "Thousands of candles can be lighted from a single candle. Happiness never decreases by being shared.", "author": "Buddha"},
  {"quote": "The past is behind, learn from it. The future is ahead, prepare for it. The present is here, live it.", "author": "Thomas S. Monson"},
  {"quote": "Never let a problem to be solved become more important than a person to be loved.", "author": "Thomas S. Monson"},
  {"quote": "Decisions determine destiny.", "author": "Thomas S. Monson"},
  {"quote": "Life is to be enjoyed, not endured.", "author": "Gordon B. Hinckley"},
  {"quote": "Try a little harder to be a little better.", "author": "Gordon B. Hinckley"},
  {"quote": "The best antidote I know for worry is work.", "author": "Gordon B. Hinckley"},
  {"quote": "The joy we feel has little to do with the circumstances of our lives and everything to do with the focus of our lives.", "author": "Russell M. Nelson"},
  {"quote": "You don't have to be perfect to be loved.", "author": "Russell M. Nelson"},
  {"quote": "The Lord loves effort.", "author": "Russell M. Nelson"},
  {"quote": "Don't you quit. You keep walking. You keep trying. There is help and happiness ahead.", "author": "Jeffrey R. Holland"},
  {"quote": "However late you think you are, however many chances you think you have missed, you have not traveled beyond the reach of divine love.", "author": "Jeffrey R. Holland"},
  {"quote": "Hold on. Hope on.", "author": "Jeffrey R. Holland"},
  {"quote": "Trust in the Lord with all thine heart; and lean not unto thine own understanding.", "author": "King Solomon"},
  {"quote": "A soft answer turneth away wrath.", "author": "King Solomon"},
  {"quote": "A cheerful heart is good medicine.", "author": "King Solomon"},
  {"quote": "The Lord is my shepherd; I shall not want.", "author": "King David"},
  {"quote": "Weeping may endure for a night, but joy cometh in the morning.", "author": "King David"},
  {"quote": "Be still, and know that I am God.", "author": "King David"},
  {"quote": "They that wait upon the Lord shall renew their strength; they shall mount up with wings as eagles.", "author": "Isaiah"},
  {"quote": "Fear thou not; for I am with thee: be not dismayed; for I am thy God.", "author": "Isaiah"},
  {"quote": "Come unto me, all ye that labour and are heavy laden, and I will give you rest.", "author": "Jesus Christ"},
  {"quote": "Ask, and it shall be given you; seek, and ye shall find; knock, and it shall be opened unto you.", "author": "Jesus Christ"},
  {"quote": "Let your light so shine before men.", "author": "Jesus Christ"},
  {"quote": "I can do all things through Christ which strengtheneth me.", "author": "Paul the Apostle"},
  {"quote": "And we know that all things work together for good to them that love God.", "author": "Paul the Apostle"},
  {"quote": "For I know the thoughts that I think toward you, saith the Lord, thoughts of peace, and not of evil.", "author": "Jeremiah"},
  {"quote": "Lift where you stand.", "author": "Dieter F. Uchtdorf"},
  {"quote": "Doubt your doubts before you doubt your faith.", "author": "Dieter F. Uchtdorf"},
  {"quote": "It is your reaction to adversity, not the adversity itself, that determines how your life's story will develop.", "author": "Dieter F. Uchtdorf"}
];

// Configuration
const QUOTES_PER_DAY = 4;
const ROTATION_INTERVAL_DAYS = 7;
const QUOTES_TO_ROTATE = 10;

function getRandomQuotes(count, excludeQuotes = []) {
  // Filter out quotes that are currently in community wisdom
  const availableQuotes = QUOTE_BANK.filter(bankQuote => {
    return !excludeQuotes.some(existingQuote => 
      existingQuote.text === bankQuote.quote && existingQuote.author === bankQuote.author
    );
  });
  
  const shuffled = [...availableQuotes].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

function shouldRotateQuotes(currentData) {
  if (!currentData.lastRotation) {
    return false; // Don't rotate on first run
  }
  
  const lastRotationDate = new Date(currentData.lastRotation);
  const today = new Date();
  const daysSinceRotation = Math.floor((today - lastRotationDate) / (1000 * 60 * 60 * 24));
  
  return daysSinceRotation >= ROTATION_INTERVAL_DAYS;
}

exports.handler = async (event, context) => {
  console.log('Daily Quote Publisher started at:', new Date().toISOString());

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
    const getFileResponse = await fetch(
      `https://api.github.com/repos/${githubRepo}/contents/${filePath}`,
      {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    let currentData = { quotes: [], lastRotation: null };
    let sha = null;

    if (getFileResponse.ok) {
      const fileData = await getFileResponse.json();
      sha = fileData.sha;
      const content = Buffer.from(fileData.content, 'base64').toString('utf8');
      currentData = JSON.parse(content);
      currentData.quotes = currentData.quotes || [];
    } else {
      console.log('community-wisdom.json not found, will create new file');
    }

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
    let commitMessage = `Daily wisdom: Added ${QUOTES_PER_DAY} quotes for ${today}`;
    
    // Step 2: Check if we need to rotate quotes (weekly)
    if (shouldRotateQuotes(currentData)) {
      console.log('Rotation triggered! Removing oldest quotes...');
      
      // Remove the oldest quotes (from the end of the array)
      const quotesToRemove = currentData.quotes.slice(-QUOTES_TO_ROTATE);
      currentData.quotes = currentData.quotes.slice(0, -QUOTES_TO_ROTATE);
      
      console.log(`Rotated ${quotesToRemove.length} quotes back to the bank`);
      commitMessage += ` | Rotated ${quotesToRemove.length} quotes`;
      
      // Update last rotation date
      currentData.lastRotation = today;
    } else if (!currentData.lastRotation) {
      // Set initial rotation date if not set
      currentData.lastRotation = today;
    }

    // Step 3: Select random quotes (excluding ones already in community wisdom)
    const selectedQuotes = getRandomQuotes(QUOTES_PER_DAY, currentData.quotes);
    console.log('Selected quotes:', selectedQuotes.map(q => q.author));

    // Step 4: Add new quotes to the beginning of the array
    for (const quote of selectedQuotes) {
      const newQuote = {
        text: quote.quote,
        author: quote.author,
        date: today
      };
      currentData.quotes.unshift(newQuote);
    }

    // Step 5: Update the file on GitHub
    const updateBody = {
      message: commitMessage,
      content: Buffer.from(JSON.stringify(currentData, null, 2)).toString('base64')
    };

    if (sha) {
      updateBody.sha = sha;
    }

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

    console.log('Successfully added daily quotes!');

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: commitMessage,
        quotesAdded: selectedQuotes.length,
        totalQuotes: currentData.quotes.length,
        lastRotation: currentData.lastRotation,
        quotes: selectedQuotes.map(q => ({ text: q.quote.substring(0, 50) + '...', author: q.author }))
      })
    };

  } catch (error) {
    console.error('Error in daily-quotes:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
