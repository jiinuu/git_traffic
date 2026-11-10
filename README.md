# GitHub Traffic Dashboard

내 GitHub 저장소의 조회·클론·유입 경로를 한 화면에서 살펴보는 대시보드입니다.

- 저장소별 방문·클론 추이와 상세 차트
- GitHub 로그인 또는 토큰 연결
- 브라우저 캐시와 선택적 Slack 알림 연동

### 시작하기

```sh
npm install
npm run dev
```

OAuth 로그인에는 서버 환경변수 `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`과 GitHub OAuth App 설정이 필요합니다. 로컬 콜백 주소는 `http://localhost:5173/api/callback`입니다. 연동 코드는 [api/](api/)와 [vite.config.js](vite.config.js)를 참고하세요.

GitHub의 집계 데이터를 사용하므로 개별 방문자나 본인 방문을 식별하지 못합니다. 토큰과 캐시가 브라우저 `localStorage`에 저장되므로 신뢰할 수 있는 개인 환경에서 사용하고, 토큰 권한은 필요한 저장소로 제한해주세요.

[이전 상세 문서](https://github.com/jiinuu/git_traffic/blob/29b56e4b94bcdc07ce347e0e54462f8fd6f99b73/README.md) — 개편 전 기록이며, 현재 안내와 다를 수 있습니다.

---

## English

A dashboard for viewing traffic across your GitHub repositories.

- Repository views, clones, referrers, and detailed charts
- GitHub OAuth or token-based connection
- Browser caching and optional Slack notifications

```sh
npm install
npm run dev
```

OAuth requires `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and a configured GitHub OAuth App. The local callback is `http://localhost:5173/api/callback`. See [api/](api/) and [vite.config.js](vite.config.js).

The dashboard uses aggregate traffic data; it cannot identify individual visitors or separate your own visits. Tokens and cache are stored in browser `localStorage`. Use a trusted personal environment and limit token permissions.

[Previous detailed documentation](https://github.com/jiinuu/git_traffic/blob/29b56e4b94bcdc07ce347e0e54462f8fd6f99b73/README.md) — a historical snapshot that may differ from the current guide.
