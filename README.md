# 📈 GitTraffic - 5초 직관적인 깃허브 트래픽 대시보드

**GitTraffic**은 모바일 퍼스트 디자인으로 설계되어, 단 5초 만에 나 혹은 타인이 내 레포지토리를 방문했는지, 오늘 조회수가 가장 높은 레포지토리는 무엇인지 등을 한눈에 모니터링할 수 있는 직관적인 트래픽 대시보드입니다.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FYOUR_GITHUB_USERNAME%2Fgithub-traffic-dashboard&env=GITHUB_CLIENT_ID,GITHUB_CLIENT_SECRET)

---

## 주요 기능
- 🚀 **원클릭 로그인**: 팝업 방식으로 대시보드 이탈 없이 3초 만에 완료하는 OAuth 계정 연동
- 📱 **반응형 모바일 그리드**: 모바일 및 태블릿 화면에서도 가독성이 최적화된 컴팩트한 카드 뷰
- 📊 **14도트 스파크-그리드 (Spark-Grid)**: 깃허브 잔디(Contribution graph) 스타일을 차용하여 최근 14일간 유입 신호를 한눈에 파악
- 📉 **인라인 스파크라인 (Sparkline)**: 별도의 차트 라이브러리(Chart.js 등) 없이 SVG 기반으로 작동하는 초경량 트렌드 선
- 🚨 **실시간 슬랙(Slack) 알림**: 브라우저 백그라운드 폴링을 활용하여 신규 뷰 및 클론 발생 시 즉각 슬랙 웹훅 전송

---

## ⚡ 5분 배포 및 설정 방법

### 1단계: GitHub OAuth App 생성
대시보드 로그인 버튼을 활성화하기 위해 공용 OAuth App을 깃허브에 등록해야 합니다.
1. [GitHub Developer Settings > OAuth Apps](https://github.com/settings/developers)로 이동합니다.
2. **New OAuth App**을 클릭합니다.
3. 다음과 같이 정보를 입력합니다:
   - **Application name**: `GitTraffic`
   - **Homepage URL**: 본인의 Vercel 배포 URL (예: `https://gittraffic.vercel.app`)
   - **Authorization callback URL**: `https://gittraffic.vercel.app/api/callback` (마지막에 `/api/callback` 경로가 붙어야 함)
4. 등록 후 생성된 **Client ID**와 **Client Secret**을 메모해 둡니다.

### 2단계: Vercel 배포 및 환경 변수 설정
위의 **Deploy with Vercel** 버튼을 클릭하거나, Vercel에 직접 프로젝트를 연결하여 배포합니다.
배포 시 다음 두 개의 **Environment Variables (환경 변수)**를 입력해 줍니다:
- `GITHUB_CLIENT_ID`: (1단계에서 획득한 Client ID)
- `GITHUB_CLIENT_SECRET`: (1단계에서 획득한 Client Secret)

---

## 💻 로컬 개발 환경 실행 방법

로컬에서 테스트 및 개발하려면 아래 순서대로 진행합니다.

1. **의존성 설치**:
   ```bash
   npm install
   ```

2. **환경 변수 파일 생성**:
   프로젝트 루트 폴더에 `.env` 파일을 생성하고 아래 값을 입력합니다:
   ```env
   GITHUB_CLIENT_ID=your_oauth_client_id
   GITHUB_CLIENT_SECRET=your_oauth_client_secret
   ```
   *주의: 로컬 테스트를 하려면 GitHub OAuth App의 Authorization callback URL에 `http://localhost:5173/api/callback`이 등록되어 있어야 합니다.*

3. **개발 서버 실행**:
   ```bash
   npm run dev
   ```
   실행 후 브라우저에서 `http://localhost:5173`으로 접속합니다.

---

## 🔒 보안 및 개인정보 관련
- 사용자의 GitHub Personal Access Token(PAT)이나 Access Token은 Vercel 서버나 외부 데이터베이스에 **저장되지 않으며**, 오직 사용자의 브라우저 로컬 저장소(`localStorage`)에만 안전하게 보관됩니다.
- 서버리스 함수(`/api/callback.js`, `/api/token.js`)는 브라우저 CORS 제약을 우회하기 위해 GitHub 토큰 교환을 대행해 주는 프록시 역할만 수행합니다.
