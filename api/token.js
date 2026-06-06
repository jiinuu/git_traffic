export default async function handler(req, res) {
  // Setup CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle Options preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Authorization code (code) is required' });
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ 
      error: 'GitHub OAuth Client ID or Client Secret configuration is missing on the server. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables.' 
    });
  }

  try {
    // 1. Exchange temporary authorization code for Access Token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code
      })
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return res.status(400).json({ 
        error: tokenData.error_description || tokenData.error 
      });
    }

    const accessToken = tokenData.access_token;

    // 2. Fetch user profile from GitHub API to fetch user login name (Username)
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'GitTraffic-Dashboard'
      }
    });

    const userData = await userResponse.json();

    if (!userResponse.ok) {
      return res.status(400).json({ error: 'Failed to retrieve GitHub user profile details' });
    }

    // 3. Return credentials back to browser securely
    return res.status(200).json({
      access_token: accessToken,
      username: userData.login
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
