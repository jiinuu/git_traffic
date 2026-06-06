const fs = require('fs');
const path = require('path');

// Configuration
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const GH_PAT = process.env.GH_PAT;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;

const token = GH_PAT || GITHUB_TOKEN;

const CACHE_DIR = path.join(__dirname, 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'traffic-cache.json');

async function run() {
  if (!SLACK_WEBHOOK_URL) {
    console.error('❌ Error: SLACK_WEBHOOK_URL environment variable is not set.');
    process.exit(1);
  }

  if (!token) {
    console.error('❌ Error: Neither GH_PAT nor GITHUB_TOKEN is available.');
    process.exit(1);
  }

  // Ensure cache directory exists
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }

  // Load existing cache
  let cache = {};
  if (fs.existsSync(CACHE_FILE)) {
    try {
      cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    } catch (e) {
      console.warn('⚠️ Warning: Failed to parse cache file. Initializing fresh cache.', e);
      cache = {};
    }
  }

  const headers = {
    'Accept': 'application/vnd.github+json',
    'Authorization': `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'github-traffic-notifier'
  };

  let reposToCheck = [];

  // Determine which repositories to check
  if (GH_PAT) {
    console.log('🔄 GH_PAT detected. Fetching all owned repositories...');
    try {
      const res = await fetch('https://api.github.com/user/repos?type=owner&per_page=100', { headers });
      if (!res.ok) {
        throw new Error(`Failed to fetch repos: ${res.status} ${res.statusText}`);
      }
      const repos = await res.json();
      reposToCheck = repos.map(r => r.full_name);
      console.log(`✅ Found ${reposToCheck.length} repositories to check.`);
    } catch (err) {
      console.error('⚠️ Failed to fetch all owned repositories. Falling back to current repository only.', err);
      if (GITHUB_REPOSITORY) {
        reposToCheck = [GITHUB_REPOSITORY];
      }
    }
  } else {
    console.log('🔄 GITHUB_TOKEN detected. Checking current repository only:', GITHUB_REPOSITORY);
    if (GITHUB_REPOSITORY) {
      reposToCheck = [GITHUB_REPOSITORY];
    } else {
      console.error('❌ GITHUB_REPOSITORY environment variable is missing. Cannot proceed.');
      process.exit(1);
    }
  }

  if (reposToCheck.length === 0) {
    console.log('ℹ️ No repositories found to check.');
    return;
  }

  const todayUtcStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const updates = [];
  const nextCache = { ...cache };

  for (const repoFullName of reposToCheck) {
    console.log(`🔍 Checking traffic for: ${repoFullName}`);
    try {
      // Fetch Views
      const viewsRes = await fetch(`https://api.github.com/repos/${repoFullName}/traffic/views`, { headers });
      if (!viewsRes.ok) {
        console.warn(`⚠️ Skip ${repoFullName}: Views API returned status ${viewsRes.status}`);
        continue;
      }
      const viewsData = await viewsRes.json();

      // Fetch Clones
      const clonesRes = await fetch(`https://api.github.com/repos/${repoFullName}/traffic/clones`, { headers });
      if (!clonesRes.ok) {
        console.warn(`⚠️ Skip ${repoFullName}: Clones API returned status ${clonesRes.status}`);
        continue;
      }
      const clonesData = await clonesRes.json();

      // Find stats for today
      const todayViewsObj = (viewsData.views || []).find(v => v.timestamp.startsWith(todayUtcStr));
      const todayClonesObj = (clonesData.clones || []).find(c => c.timestamp.startsWith(todayUtcStr));

      const currentViews = todayViewsObj ? todayViewsObj.count : 0;
      const currentViewsUniques = todayViewsObj ? todayViewsObj.uniques : 0;

      const currentClones = todayClonesObj ? todayClonesObj.count : 0;
      const currentClonesUniques = todayClonesObj ? todayClonesObj.uniques : 0;

      const cachedRepo = cache[repoFullName];

      // If no cache exists for this repository, initialize cache and skip alert
      if (!cachedRepo) {
        console.log(`📌 First check for ${repoFullName}. Initializing cache.`);
        nextCache[repoFullName] = {
          date: todayUtcStr,
          views: currentViews,
          viewsUniques: currentViewsUniques,
          clones: currentClones,
          clonesUniques: currentClonesUniques
        };
        continue;
      }

      let viewsDiff = 0;
      let clonesDiff = 0;

      if (cachedRepo.date === todayUtcStr) {
        viewsDiff = currentViews - cachedRepo.views;
        clonesDiff = currentClones - cachedRepo.clones;
      } else {
        // Date has changed (UTC day rolled over)
        // Everything recorded today is considered new increment
        viewsDiff = currentViews;
        clonesDiff = currentClones;
      }

      // Safeguard against reset or decreasing numbers (should not happen, but just in case)
      if (viewsDiff < 0) viewsDiff = 0;
      if (clonesDiff < 0) clonesDiff = 0;

      // Update cache
      nextCache[repoFullName] = {
        date: todayUtcStr,
        views: currentViews,
        viewsUniques: currentViewsUniques,
        clones: currentClones,
        clonesUniques: currentClonesUniques
      };

      if (viewsDiff > 0 || clonesDiff > 0) {
        console.log(`📈 Increment detected for ${repoFullName}: +${viewsDiff} views, +${clonesDiff} clones.`);
        updates.push({
          name: repoFullName.split('/')[1],
          fullName: repoFullName,
          viewsDiff,
          clonesDiff,
          totalViews: currentViews,
          totalViewsUniques: currentViewsUniques,
          totalClones: currentClones,
          totalClonesUniques: currentClonesUniques
        });
      }

    } catch (err) {
      console.error(`❌ Error checking repository ${repoFullName}:`, err);
    }
  }

  // Save new cache state
  fs.writeFileSync(CACHE_FILE, JSON.stringify(nextCache, null, 2), 'utf8');
  console.log('💾 Cache state saved.');

  // Send slack webhook if there are updates
  if (updates.length > 0) {
    console.log(`📤 Sending notifications for ${updates.length} updated repositories...`);
    await sendSlackNotification(updates);
  } else {
    console.log('✨ No traffic increments detected in this hour.');
  }
}

async function sendSlackNotification(updates) {
  // Build markdown Slack message blocks
  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '📈 GitTraffic 변동 알림 (최근 1시간)',
        emoji: true
      }
    },
    {
      type: 'divider'
    }
  ];

  for (const update of updates) {
    let text = `*<https://github.com/${update.fullName}|${update.fullName}>*\n`;
    if (update.viewsDiff > 0) {
      text += `• 👁 오늘 조회수: *+${update.viewsDiff}* 증가 (총 ${update.totalViews}회 / ${update.totalViewsUniques}명)\n`;
    }
    if (update.clonesDiff > 0) {
      text += `• ⬇ 오늘 클론수: *+${update.clonesDiff}* 증가 (총 ${update.totalClones}회 / ${update.totalClonesUniques}명)\n`;
    }
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: text
      }
    });
  }

  try {
    const res = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ blocks })
    });

    if (res.ok) {
      console.log('✅ Slack notification sent successfully.');
    } else {
      const errMsg = await res.text();
      console.error(`❌ Failed to send Slack notification: ${res.status} ${res.statusText}`, errMsg);
    }
  } catch (err) {
    console.error('❌ Failed to send Slack notification:', err);
  }
}

run().catch(err => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});
