export default async function handler(req, res) {
  // Setup CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { code } = req.query;
  
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  const htmlTemplate = (data) => `
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="UTF-8">
      <title>GitTraffic - GitHub 인증</title>
      <style>
        body {
          background-color: #0d1117;
          color: #c9d1d9;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          margin: 0;
        }
        .container {
          text-align: center;
          background: rgba(22, 27, 34, 0.8);
          border: 1px solid rgba(48, 54, 61, 0.8);
          border-radius: 12px;
          padding: 2.5rem;
          max-width: 400px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(10px);
        }
        h2 {
          margin-top: 0;
          color: ${data.error ? '#f85149' : '#58a6ff'};
        }
        p {
          font-size: 0.95rem;
          color: #8b949e;
          line-height: 1.5;
        }
        .spinner {
          border: 3px solid rgba(56, 189, 248, 0.1);
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border-left-color: #38bdf8;
          animation: spin 1s linear infinite;
          margin: 1.5rem auto 0 auto;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>${data.error ? '인증 실패' : '인증 완료'}</h2>
        <p>${data.error ? data.error : '성공적으로 로그인되었습니다. 이 창은 자동으로 닫힙니다.'}</p>
        ${data.error ? '' : '<div class="spinner"></div>'}
      </div>
      <script>
        const message = ${JSON.stringify(data)};
        if (window.opener) {
          // Send the message back to the dashboard tab
          window.opener.postMessage(message, window.location.origin);
        } else {
          console.error('Parent window (window.opener) not found.');
        }
        setTimeout(() => {
          window.close();
        }, 1000);
      </script>
    </body>
    </html>
  `;

  if (!code) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send(htmlTemplate({ error: '인증 코드가 누락되었습니다.' }));
  }

  if (!clientId || !clientSecret) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send(htmlTemplate({ error: '서버에 GitHub OAuth 환경 변수가 설정되지 않았습니다.' }));
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
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(400).send(htmlTemplate({ error: tokenData.error_description || tokenData.error }));
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
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(400).send(htmlTemplate({ error: 'GitHub 사용자 정보를 가져오지 못했습니다.' }));
    }

    // 3. Return success HTML page
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(htmlTemplate({
      access_token: accessToken,
      username: userData.login
    }));
  } catch (err) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send(htmlTemplate({ error: err.message }));
  }
}
