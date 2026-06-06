const fs = require('fs');
const path = require('path');

const token = process.env.GITHUB_TOKEN;
const webhookUrl = process.env.SLACK_WEBHOOK_URL;
const repoName = process.env.REPO_NAME;

if (!token || !webhookUrl || !repoName) {
  console.error('Error: GITHUB_TOKEN, SLACK_WEBHOOK_URL, and REPO_NAME environment variables are required.');
  process.exit(1);
}

const headers = {
  'Authorization': `token ${token}`,
  'Accept': 'application/vnd.github.v3+json',
  'User-Agent': 'GitHub-Traffic-Notifier'
};

async function fetchJson(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API request failed: ${response.status} for ${url}`);
  }
  return response.json();
}

async function sendSlackNotification(newViews, newClones, totalTodayViews, totalTodayClones) {
  const payload = {
    text: `🚨 [${repoName}] 신규 트래픽 감지!`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `📈 GitTraffic 알림: ${repoName.split('/')[1]}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${repoName}* 레포지토리에 새로운 방문이 기록되었습니다.`
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*신규 유입 (최근 1시간)*\n👁️ Views: *+${newViews}*\n💾 Clones: *+${newClones}*`
          },
          {
            type: 'mrkdwn',
            text: `*오늘 누적 합계*\n👁️ 총 Views: *${totalTodayViews}*\n💾 총 Clones: *${totalTodayClones}*`
          }
        ]
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `알림 전송 시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`
          }
        ]
      }
    ]
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Slack webhook sending failed: ${response.status}`);
  }
  console.log('Slack notification sent successfully!');
}

async function main() {
  try {
    console.log(`Checking traffic for repository: ${repoName}`);

    // 1. Fetch Views and Clones data from GitHub Traffic API
    const viewsData = await fetchJson(`https://api.github.com/repos/${repoName}/traffic/views`);
    const clonesData = await fetchJson(`https://api.github.com/repos/${repoName}/traffic/clones`);

    // 2. Extract today's stats (formatted YYYY-MM-DD in UTC)
    const todayStr = new Date().toISOString().split('T')[0];
    const todayViewsItem = viewsData.views.find(v => v.timestamp.startsWith(todayStr));
    const todayClonesItem = clonesData.clones.find(c => c.timestamp.startsWith(todayStr));

    const todayViews = todayViewsItem ? todayViewsItem.count : 0;
    const todayClones = todayClonesItem ? todayClonesItem.count : 0;

    // 3. Load previous execution cache from file to avoid duplicate alerts
    // Cache resides in the runner's workspace or is restored via action caching
    const cachePath = path.join(__dirname, 'last-traffic.json');
    let cachedViews = 0;
    let cachedClones = 0;

    if (fs.existsSync(cachePath)) {
      try {
        const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        // Only trust cache if it's for today (reset daily)
        if (cache.date === todayStr) {
          cachedViews = cache.views || 0;
          cachedClones = cache.clones || 0;
        }
      } catch (err) {
        console.warn('Failed to read last-traffic.json cache:', err.message);
      }
    }

    // 4. Detect new activity increments
    const newViews = todayViews - cachedViews;
    const newClones = todayClones - cachedClones;

    console.log(`Today views: ${todayViews} (New: ${newViews}), Today clones: ${todayClones} (New: ${newClones})`);

    if (newViews > 0 || newClones > 0) {
      // Send Slack payload
      await sendSlackNotification(newViews, newClones, todayViews, todayClones);

      // Save updated cache
      fs.writeFileSync(cachePath, JSON.stringify({
        date: todayStr,
        views: todayViews,
        clones: todayClones
      }), 'utf8');
      console.log('Cache updated successfully.');
    } else {
      console.log('No new traffic detected. Skipping notification.');
    }

  } catch (error) {
    console.error('Error occurred in Traffic Notifier:', error.message);
    process.exit(1);
  }
}

main();
