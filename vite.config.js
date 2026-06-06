import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    host: true,
    configureServer(server) {
      // Custom Connect middleware to simulate Vercel serverless /api endpoints locally
      server.middlewares.use(async (req, res, next) => {
        const urlObj = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
        const pathname = urlObj.pathname;

        if (pathname === '/api/config' && req.method === 'GET') {
          const clientId = process.env.GITHUB_CLIENT_ID || '';
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ client_id: clientId }));
          return;
        }

        if (pathname === '/api/callback' && req.method === 'GET') {
          const code = urlObj.searchParams.get('code') || '';
          const clientId = process.env.GITHUB_CLIENT_ID || '';
          const clientSecret = process.env.GITHUB_CLIENT_SECRET || '';

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
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(htmlTemplate({ error: '인증 코드가 누락되었습니다.' }));
            return;
          }

          if (!clientId || !clientSecret) {
            res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(htmlTemplate({ 
              error: '로컬 환경 변수가 미설정되었습니다. GITHUB_CLIENT_ID와 GITHUB_CLIENT_SECRET을 설정하고 데브 서버를 재시작해 주세요.' 
            }));
            return;
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
                code
              })
            });

            const tokenData = await tokenResponse.json();

            if (tokenData.error) {
              res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(htmlTemplate({ error: tokenData.error_description || tokenData.error }));
              return;
            }

            const accessToken = tokenData.access_token;

            // 2. Fetch authenticated GitHub profile
            const userResponse = await fetch('https://api.github.com/user', {
              headers: {
                'Authorization': `token ${accessToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'GitTraffic-Local-Dev'
              }
            });

            const userData = await userResponse.json();
            if (!userResponse.ok) {
              res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(htmlTemplate({ error: 'GitHub 사용자 정보를 가져오지 못했습니다.' }));
              return;
            }

            // 3. Serve success HTML
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(htmlTemplate({
              access_token: accessToken,
              username: userData.login
            }));
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(htmlTemplate({ error: err.message }));
          }
          return;
        }

        if (pathname === '/api/token' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk;
          });
          
          req.on('end', async () => {
            try {
              const { code } = JSON.parse(body || '{}');
              
              // Read local environment variables (if set in console or system)
              const clientId = process.env.GITHUB_CLIENT_ID || '';
              const clientSecret = process.env.GITHUB_CLIENT_SECRET || '';
              
              if (!code) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Authorization code is required' }));
                return;
              }
              
              if (!clientId || !clientSecret) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                  error: '로컬 환경 변수가 미설정되었습니다. 터미널에서 GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET을 지정하고 다시 실행해 주세요.' 
                }));
                return;
              }
              
              // 1. Fetch access token from GitHub
              const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
                },
                body: JSON.stringify({
                  client_id: clientId,
                  client_secret: clientSecret,
                  code
                })
              });
              
              const tokenData = await tokenResponse.json();
              
              if (tokenData.error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: tokenData.error_description || tokenData.error }));
                return;
              }
              
              const accessToken = tokenData.access_token;
              
              // 2. Fetch authenticated GitHub profile
              const userResponse = await fetch('https://api.github.com/user', {
                headers: {
                  'Authorization': `token ${accessToken}`,
                  'Accept': 'application/vnd.github.v3+json',
                  'User-Agent': 'GitTraffic-Local-Dev'
                }
              });
              
              const userData = await userResponse.json();
              if (!userResponse.ok) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to retrieve profile detail' }));
                return;
              }
              
              // 3. Return payload
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                access_token: accessToken,
                username: userData.login
              }));
            } catch (err) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
        } else {
          next();
        }
      });
    }
  }
});
