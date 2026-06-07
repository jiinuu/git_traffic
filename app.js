// App state
let state = {
  isDemo: false,
  username: '',
  token: '',
  clientId: '',        // Exposed from server env
  repos: [],          // Parsed repository traffic objects
  cachedData: {},     // Cumulative traffic data stored in localStorage
  currentSort: 'today-views',
  currentSearch: '',
  selectedRepo: null,
  chartViewMode: 'both', // 'both', 'views', 'clones'
  hideSummary: localStorage.getItem('github_traffic_hide_summary') !== 'false', // default to true (hidden) if not explicitly set to false
  showPrivate: localStorage.getItem('github_traffic_show_private') === 'true', // default false (hidden)
  
  // Slack notifications
  slackUrl: '',
  slackNotifyEnabled: false,
  pollingIntervalId: null,
  isPollingActive: false,
  isConnecting: false
};

// Helper for Lucide Icons
function initIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Helper for horizontal drag-to-scroll on long elements (e.g. paths)
function makeDragScrollable(el) {
  let isDown = false;
  let startX;
  let scrollLeft;
  
  el.addEventListener('mousedown', (e) => {
    isDown = true;
    el.style.cursor = 'grabbing';
    startX = e.pageX - el.offsetLeft;
    scrollLeft = el.scrollLeft;
  });
  
  el.addEventListener('mouseleave', () => {
    isDown = false;
    el.style.cursor = 'ew-resize';
  });
  
  el.addEventListener('mouseup', () => {
    isDown = false;
    el.style.cursor = 'ew-resize';
  });
  
  el.addEventListener('mousemove', (e) => {
    if(!isDown) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startX) * 1.5; // scroll speed multiplier
    el.scrollLeft = scrollLeft - walk;
  });
}

// -------------------------------------------------------------
// 1. RELATIVE DATE CALCULATIONS
// -------------------------------------------------------------
function calculateLastActive(viewsObject) {
  const dates = Object.keys(viewsObject).sort();
  if (dates.length === 0) {
    return { text: '유입 없음', daysDiff: 999, class: 'badge-old' };
  }
  
  // Find the latest date with count > 0
  let latestActiveDateStr = '';
  for (let i = dates.length - 1; i >= 0; i--) {
    const dStr = dates[i];
    if (viewsObject[dStr] && viewsObject[dStr].count > 0) {
      latestActiveDateStr = dStr;
      break;
    }
  }
  
  if (!latestActiveDateStr) {
    return { text: '유입 없음', daysDiff: 999, class: 'badge-old' };
  }
  
  const today = new Date();
  today.setHours(0,0,0,0);
  const activeDate = new Date(latestActiveDateStr);
  activeDate.setHours(0,0,0,0);
  
  // Time difference in days
  const diffTime = today.getTime() - activeDate.getTime();
  const daysDiff = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (daysDiff <= 0) {
    return { text: '오늘 유입!', daysDiff: 0, class: 'badge-today' };
  } else if (daysDiff === 1) {
    return { text: '어제 방문', daysDiff: 1, class: 'badge-yesterday' };
  } else if (daysDiff <= 7) {
    return { text: `${daysDiff}일 전`, daysDiff: daysDiff, class: 'badge-recent' };
  } else {
    return { text: `${daysDiff}일 전`, daysDiff: daysDiff, class: 'badge-old' };
  }
}

// -------------------------------------------------------------
// 2. DEMO DATA GENERATOR WITH DIVERSE TIMESTAMPS
// -------------------------------------------------------------
function generateDemoData() {
  const repoNames = [
    'nextjs-saas-boilerplate',
    'awesome-react-hooks',
    'python-ai-crawler',
    'developer-portfolio-website',
    'fastapi-postgres-template',
    'css-glassmorphism-generator',
    'rust-cli-utility'
  ];
  
  const languages = ['TypeScript', 'JavaScript', 'Python', 'HTML', 'Python', 'CSS', 'Rust'];
  const langColors = ['#3178c6', '#f1e05a', '#3572A5', '#e34c26', '#3572A5', '#563d7c', '#dea584'];
  
  // Setup dates: last 14 days
  const today = new Date();
  const dateStrings = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    dateStrings.push(d.toISOString().split('T')[0]);
  }
  
  return repoNames.map((name, idx) => {
    const viewsData = {};
    const clonesData = {};
    let totalViews = 0;
    let totalClones = 0;
    
    // Simulate activity states
    dateStrings.forEach((date, dateIdx) => {
      const daysAgo = dateStrings.length - 1 - dateIdx;
      let views = 0;
      let clones = 0;
      
      if (idx === 0) {
        views = Math.floor(Math.random() * 40) + 10;
        clones = Math.floor(views * 0.15);
      } else if (idx === 1) {
        if (daysAgo === 1) views = 24;
        else if (daysAgo > 1) views = Math.floor(Math.random() * 12);
      } else if (idx === 2) {
        if (daysAgo === 3) views = 15;
        else if (daysAgo > 3) views = Math.floor(Math.random() * 8);
      } else if (idx === 3) {
        if (daysAgo === 9) views = 8;
      } else if (idx === 4) {
        if (daysAgo === 0) views = 30;
      } else if (idx === 5) {
        views = 0;
      } else if (idx === 6) {
        if (daysAgo === 5) views = 14;
        else if (daysAgo > 5) views = Math.floor(Math.random() * 5);
      }
      
      clones = Math.floor(views * 0.1);
      viewsData[date] = { count: views, uniques: Math.ceil(views * 0.8) };
      clonesData[date] = { count: clones, uniques: Math.ceil(clones * 0.8) };
      
      totalViews += views;
      totalClones += clones;
    });

    const referrers = [
      { referrer: 'github.com', count: Math.ceil(totalViews * 0.5), uniques: Math.ceil(totalViews * 0.4) },
      { referrer: 'Google', count: Math.ceil(totalViews * 0.3), uniques: Math.ceil(totalViews * 0.25) }
    ].filter(r => r.count > 0);

    const paths = [
      { path: '/', title: 'Home / Root', count: Math.ceil(totalViews * 0.6), uniques: Math.ceil(totalViews * 0.5) },
      { path: '/blob/main/README.md', title: 'README.md', count: Math.ceil(totalViews * 0.3), uniques: Math.ceil(totalViews * 0.25) },
      { path: '/releases', title: 'Releases', count: Math.ceil(totalViews * 0.1), uniques: Math.ceil(totalViews * 0.08) }
    ].filter(p => p.count > 0);

    const todayDateStr = dateStrings[dateStrings.length - 1];
    const yesterdayDateStr = dateStrings[dateStrings.length - 2];

    return {
      name: name,
      fullName: `demo-user/${name}`,
      description: `${name} simulation repository tracking.`,
      language: languages[idx],
      languageColor: langColors[idx],
      views: viewsData,
      clones: clonesData,
      referrers: referrers,
      paths: paths,
      private: idx % 3 === 0,
      todayViews: viewsData[todayDateStr]?.count || 0,
      todayClones: clonesData[todayDateStr]?.count || 0,
      yesterdayViews: viewsData[yesterdayDateStr]?.count || 0,
      yesterdayClones: clonesData[yesterdayDateStr]?.count || 0,
      totalViews14d: totalViews,
      totalClones14d: totalClones
    };
  });
}

// -------------------------------------------------------------
// 3. LIGHTWEIGHT GRAPH DRAWING (DUAL MIRROR SPARKLINE & DUAL GRID)
// -------------------------------------------------------------

// Dual-mirror butterfly sparkline: Views (cyan, top half) + Clones (purple, bottom half mirrored) or single-line modes
function generateDualMirrorSparkline(viewsObject, clonesObject) {
  const today = new Date();
  const dateStrings = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    dateStrings.push(d.toISOString().split('T')[0]);
  }

  const viewValues = dateStrings.map(d => (viewsObject[d] ? viewsObject[d].count : 0));
  const cloneValues = dateStrings.map(d => (clonesObject[d] ? clonesObject[d].count : 0));
  const viewUniques = dateStrings.map(d => (viewsObject[d] ? viewsObject[d].uniques : 0));
  const cloneUniques = dateStrings.map(d => (clonesObject[d] ? clonesObject[d].uniques : 0));

  const maxViews = Math.max(...viewValues, ...viewUniques, 1);
  const maxClones = Math.max(...cloneValues, ...cloneUniques, 1);

  const W = 100;
  const H = 54;     // total height: top 24 (views) + 6 center gap + 24 bottom (clones)
  const uid = Math.random().toString(36).substring(7);
  const n = dateStrings.length;
  const xStep = W / (n - 1);

  let viewPathD = '', viewAreaD = '', viewUniqPathD = '';
  let clonePathD = '', cloneAreaD = '', cloneUniqPathD = '';
  let axisY = 27;

  const mode = state.chartViewMode || 'both';

  if (mode === 'both') {
    const topH = 24;  // views half height
    const botH = 24;  // clones half height
    const midY = topH + 3; // center axis Y (27)
    axisY = midY;

    // Build view points (top half, grows upward from midY)
    const viewPts = viewValues.map((v, i) => {
      const x = i * xStep;
      const norm = v / maxViews;
      const y = midY - norm * topH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const viewUniqPts = viewUniques.map((v, i) => {
      const x = i * xStep;
      const norm = v / maxViews;
      const y = midY - norm * topH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    // Build clone points (bottom half, grows downward from midY)
    const clonePts = cloneValues.map((v, i) => {
      const x = i * xStep;
      const norm = v / maxClones;
      const y = midY + norm * botH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const cloneUniqPts = cloneUniques.map((v, i) => {
      const x = i * xStep;
      const norm = v / maxClones;
      const y = midY + norm * botH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    viewPathD = `M ${viewPts.join(' L ')}`;
    viewAreaD = `${viewPathD} L ${W},${midY} L 0,${midY} Z`;
    viewUniqPathD = `M ${viewUniqPts.join(' L ')}`;

    clonePathD = `M ${clonePts.join(' L ')}`;
    cloneAreaD = `${clonePathD} L ${W},${midY} L 0,${midY} Z`;
    cloneUniqPathD = `M ${cloneUniqPts.join(' L ')}`;
  } else if (mode === 'views') {
    const baseH = 48; // full scale height
    const midY = 51;  // baseline at bottom
    axisY = midY;

    const viewPts = viewValues.map((v, i) => {
      const x = i * xStep;
      const norm = v / maxViews;
      const y = midY - norm * baseH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const viewUniqPts = viewUniques.map((v, i) => {
      const x = i * xStep;
      const norm = v / maxViews;
      const y = midY - norm * baseH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    viewPathD = `M ${viewPts.join(' L ')}`;
    viewAreaD = `${viewPathD} L ${W},${midY} L 0,${midY} Z`;
    viewUniqPathD = `M ${viewUniqPts.join(' L ')}`;
  } else if (mode === 'clones') {
    const baseH = 48; // full scale height
    const midY = 51;  // baseline at bottom
    axisY = midY;

    const clonePts = cloneValues.map((v, i) => {
      const x = i * xStep;
      const norm = v / maxClones;
      const y = midY - norm * baseH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const cloneUniqPts = cloneUniques.map((v, i) => {
      const x = i * xStep;
      const norm = v / maxClones;
      const y = midY - norm * baseH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    clonePathD = `M ${clonePts.join(' L ')}`;
    cloneAreaD = `${clonePathD} L ${W},${midY} L 0,${midY} Z`;
    cloneUniqPathD = `M ${cloneUniqPts.join(' L ')}`;
  }

  const viewsSvgMarkup = (mode === 'both' || mode === 'views') ? `
    <!-- Views fill area -->
    <path d="${viewAreaD}" fill="url(#vg-${uid})"/>
    <!-- Views total line (cyan) -->
    <path d="${viewPathD}" fill="none" stroke="#06b6d4" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    <!-- Views unique line (cyan, dashed, lighter) -->
    <path d="${viewUniqPathD}" fill="none" stroke="#22d3ee" stroke-width="1" stroke-dasharray="2,2" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>
  ` : '';

  const clonesSvgMarkup = (mode === 'both' || mode === 'clones') ? `
    <!-- Clones fill area -->
    <path d="${cloneAreaD}" fill="url(#cg-${uid})"/>
    <!-- Clones total line (purple) -->
    <path d="${clonePathD}" fill="none" stroke="#a855f7" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    <!-- Clones unique line (purple, dashed, lighter) -->
    <path d="${cloneUniqPathD}" fill="none" stroke="#c084fc" stroke-width="1" stroke-dasharray="2,2" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>
  ` : '';

  return `
    <svg class="dual-sparkline-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="vg-${uid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#06b6d4" stop-opacity="0.0"/>
        </linearGradient>
        <linearGradient id="cg-${uid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#a855f7" stop-opacity="${mode === 'clones' ? '0.3' : '0.0'}"/>
          <stop offset="100%" stop-color="#a855f7" stop-opacity="${mode === 'clones' ? '0.0' : '0.3'}"/>
        </linearGradient>
      </defs>
      <!-- Axis line -->
      <line x1="0" y1="${axisY}" x2="${W}" y2="${axisY}" stroke="rgba(255,255,255,0.08)" stroke-width="0.5"/>
      ${viewsSvgMarkup}
      ${clonesSvgMarkup}
    </svg>
  `;
}

function generateSparklineHoverOverlay(viewsObject, clonesObject) {
  const today = new Date();
  const dateStrings = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    dateStrings.push(d.toISOString().split('T')[0]);
  }
  
  const viewValues = dateStrings.map(d => (viewsObject[d] ? viewsObject[d].count : 0));
  const cloneValues = dateStrings.map(d => (clonesObject[d] ? clonesObject[d].count : 0));
  const viewUniques = dateStrings.map(d => (viewsObject[d] ? viewsObject[d].uniques : 0));
  const cloneUniques = dateStrings.map(d => (clonesObject[d] ? clonesObject[d].uniques : 0));

  const maxViews = Math.max(...viewValues, ...viewUniques, 1);
  const maxClones = Math.max(...cloneValues, ...cloneUniques, 1);

  const mode = state.chartViewMode || 'both';
  
  return dateStrings.map((date, i) => {
    const v = viewValues[i];
    const vu = viewUniques[i];
    const c = cloneValues[i];
    const cu = cloneUniques[i];
    
    const dParts = date.split('-');
    const label = `${dParts[1]}/${dParts[2]}`; // MM/DD
    
    const xPct = i * (100 / 13);
    const widthPct = 100 / 13;
    let left, width;
    let alignClass = 'align-center';
    
    if (i === 0) {
      left = 0;
      width = widthPct / 2;
      alignClass = 'align-left';
    } else if (i === 13) {
      left = 100 - widthPct / 2;
      width = widthPct / 2;
      alignClass = 'align-right';
    } else {
      left = xPct - widthPct / 2;
      width = widthPct;
    }
    
    // Calculate Y coordinates for hover dots
    let yViews = 0, yClones = 0;
    let showViewsDot = false, showClonesDot = false;

    if (mode === 'both') {
      const topH = 24;
      const botH = 24;
      const midY = topH + 3; // 27
      yViews = midY - (v / maxViews) * topH;
      yClones = midY + (c / maxClones) * botH;
      showViewsDot = true;
      showClonesDot = true;
    } else if (mode === 'views') {
      const baseH = 48;
      const midY = 51;
      yViews = midY - (v / maxViews) * baseH;
      showViewsDot = true;
    } else if (mode === 'clones') {
      const baseH = 48;
      const midY = 51;
      yClones = midY - (c / maxClones) * baseH;
      showClonesDot = true;
    }
    
    const viewsDotHtml = showViewsDot ? `<div class="sparkline-hover-dot dot-views" style="top: ${yViews.toFixed(1)}px;"></div>` : '';
    const clonesDotHtml = showClonesDot ? `<div class="sparkline-hover-dot dot-clones" style="top: ${yClones.toFixed(1)}px;"></div>` : '';

    return `<div class="sparkline-hover-col ${alignClass}" style="left: ${left.toFixed(2)}%; width: ${width.toFixed(2)}%;" data-label="${label}" data-views="${v}" data-views-uniq="${vu}" data-clones="${c}" data-clones-uniq="${cu}">
      ${viewsDotHtml}
      ${clonesDotHtml}
    </div>`;
  }).join('');
}

// Dual-row dot grid: top row = Views (emerald), bottom row = Clones Unique (purple)
function generateDualSparkGridHtml(viewsObject, clonesObject) {
  const today = new Date();
  const dateStrings = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    dateStrings.push(d.toISOString().split('T')[0]);
  }

  const allViewCounts = dateStrings.map(d => viewsObject[d] ? viewsObject[d].count : 0);
  const allCloneCounts = dateStrings.map(d => clonesObject[d] ? clonesObject[d].count : 0);
  const maxV = Math.max(...allViewCounts, 1);
  const maxC = Math.max(...allCloneCounts, 1);

  return dateStrings.map((date, idx) => {
    const viewCount = allViewCounts[idx];
    const cloneCount = allCloneCounts[idx];

    const vNorm = viewCount / maxV;
    const cNorm = cloneCount / maxC;

    // Views dot (top) – cyan/emerald
    let vOpacity = viewCount === 0 ? 0.06 : Math.max(0.2, vNorm);
    let vColor = viewCount === 0 ? 'rgba(255,255,255,0.03)' : `rgba(6,182,212,${vOpacity.toFixed(2)})`;
    // Clones dot (bottom) – purple
    let cOpacity = cloneCount === 0 ? 0.06 : Math.max(0.2, cNorm);
    let cColor = cloneCount === 0 ? 'rgba(255,255,255,0.03)' : `rgba(168,85,247,${cOpacity.toFixed(2)})`;

    const dParts = date.split('-');
    const label = `${dParts[1]}/${dParts[2]}`;

    return `<div class="dual-dot-col">
      <div class="spark-dot" style="background:${vColor}" data-tooltip="${label} 조회: ${viewCount}회"></div>
      <div class="spark-dot" style="background:${cColor}" data-tooltip="${label} 클론: ${cloneCount}회"></div>
    </div>`;
  }).join('');
}

// Legacy single sparkline kept for backward compatibility (unused in cards)
function generateSvgSparkline(viewsObject) {
  return generateDualMirrorSparkline(viewsObject, {});
}

function generateSparkGridHtml(viewsObject) {
  return generateDualSparkGridHtml(viewsObject, {});
}

// -------------------------------------------------------------
// 4. STORAGE & SYNC
// -------------------------------------------------------------
function mergeTrafficData(repoName, apiViews, apiClones, apiReferrers, apiPaths) {
  if (!state.cachedData[repoName]) {
    state.cachedData[repoName] = { views: {}, clones: {}, referrers: [], paths: [], updatedAt: '', error: null };
  }
  
  const cache = state.cachedData[repoName];
  
  // Track detailed permission errors
  cache.error = null;
  if (apiViews && apiViews.error && (apiViews.status === 403 || apiViews.status === 404)) {
    cache.error = 'forbidden';
  } else if (apiClones && apiClones.error && (apiClones.status === 403 || apiClones.status === 404)) {
    cache.error = 'forbidden';
  }
  
  if (apiViews && !apiViews.error && apiViews.views) {
    apiViews.views.forEach(item => {
      const dateStr = item.timestamp.split('T')[0];
      cache.views[dateStr] = { count: item.count, uniques: item.uniques };
    });
  }
  
  if (apiClones && !apiClones.error && apiClones.clones) {
    apiClones.clones.forEach(item => {
      const dateStr = item.timestamp.split('T')[0];
      cache.clones[dateStr] = { count: item.count, uniques: item.uniques };
    });
  }
  
  if (apiReferrers && !apiReferrers.error) {
    cache.referrers = apiReferrers.map(item => ({
      referrer: item.referrer,
      count: item.count,
      uniques: item.uniques
    }));
  }

  if (apiPaths && !apiPaths.error) {
    cache.paths = apiPaths.map(item => ({
      path: item.path,
      title: item.title || item.path,
      count: item.count,
      uniques: item.uniques
    }));
  }
  
  cache.updatedAt = new Date().toISOString();
  localStorage.setItem('github_traffic_cache', JSON.stringify(state.cachedData));
}

function compileReposList() {
  const todayDateStr = new Date().toISOString().split('T')[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayDateStr = yesterday.toISOString().split('T')[0];
  
  if (state.isDemo) {
    state.repos = generateDemoData();
    return;
  }
  
  state.repos = Object.keys(state.cachedData).map(repoFullName => {
    const cache = state.cachedData[repoFullName];
    const nameOnly = repoFullName.split('/')[1];
    
    const viewDates = Object.keys(cache.views).sort();
    let totalViews = 0;
    viewDates.forEach(d => totalViews += cache.views[d].count);
    
    const cloneDates = Object.keys(cache.clones).sort();
    let totalClones = 0;
    cloneDates.forEach(d => totalClones += cache.clones[d].count);
    
    const meta = JSON.parse(localStorage.getItem(`github_traffic_meta_${repoFullName}`)) || {};
    
    return {
      name: nameOnly,
      fullName: repoFullName,
      description: meta.description || '설명이 없습니다.',
      language: meta.language || 'Markdown',
      languageColor: getLangColor(meta.language || 'Markdown'),
      views: cache.views,
      clones: cache.clones,
      referrers: cache.referrers || [],
      paths: cache.paths || [],
      private: meta.private === true,
      todayViews: cache.views[todayDateStr]?.count || 0,
      todayClones: cache.clones[todayDateStr]?.count || 0,
      yesterdayViews: cache.views[yesterdayDateStr]?.count || 0,
      yesterdayClones: cache.clones[yesterdayDateStr]?.count || 0,
      totalViews14d: totalViews,
      totalClones14d: totalClones,
      error: cache.error || null
    };
  });
}

function getLangColor(lang) {
  const colors = {
    'TypeScript': '#3178c6',
    'JavaScript': '#f1e05a',
    'Python': '#3572A5',
    'HTML': '#e34c26',
    'CSS': '#563d7c',
    'Rust': '#dea584',
    'Go': '#00ADD8',
    'C++': '#f34b7d',
    'Ruby': '#701516'
  };
  return colors[lang] || '#8b949e';
}

// -------------------------------------------------------------
// 5. GITHUB API CONNECT
// -------------------------------------------------------------
async function fetchWithAuth(url) {
  const response = await fetch(url, {
    headers: {
      'Authorization': `token ${state.token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });
  if (response.status === 401) throw new Error('올바르지 않은 토큰입니다.');
  if (!response.ok) {
    const err = new Error(`네트워크 오류 (${response.status})`);
    err.status = response.status;
    throw err;
  }
  return response.json();
}

async function fetchTrafficData(force = false) {
  // Check if we can use cached data (cooldown check: 10 minutes)
  const COOLDOWN_MS = 10 * 60 * 1000;
  let latestUpdateTime = 0;
  
  Object.keys(state.cachedData).forEach(repoName => {
    const updatedAt = state.cachedData[repoName]?.updatedAt;
    if (updatedAt) {
      const time = new Date(updatedAt).getTime();
      if (time > latestUpdateTime) latestUpdateTime = time;
    }
  });

  const now = Date.now();
  const isCacheFresh = (now - latestUpdateTime) < COOLDOWN_MS;

  if (!force && isCacheFresh && Object.keys(state.cachedData).length > 0) {
    console.log('캐시가 신선하여 API 호출을 건너뛰고 로컬 데이터를 로드합니다.');
    state.isDemo = false;
    updateLayoutState();
    compileReposList();
    renderDashboard();
    return;
  }

  showLoading('레포지토리 목록을 동기화하는 중...');
  try {
    let page = 1;
    let reposMeta = [];
    let fetchMore = true;
    
    while (fetchMore && page <= 3) {
      const apiRepos = await fetchWithAuth(`https://api.github.com/user/repos?type=owner&per_page=30&page=${page}&sort=updated`);
      if (apiRepos.length === 0) {
        fetchMore = false;
      } else {
        reposMeta = reposMeta.concat(apiRepos);
        page++;
      }
    }
    
    if (reposMeta.length === 0) {
      hideLoading();
      showEmptyState();
      return;
    }
    
    reposMeta.forEach(repo => {
      localStorage.setItem(`github_traffic_meta_${repo.full_name}`, JSON.stringify({
        description: repo.description,
        language: repo.language,
        private: repo.private
      }));
    });
    
    showLoading(`상세 트래픽 정보를 취합하는 중... (0/${reposMeta.length})`);
    
    const CHUNK_SIZE = 5;
    for (let i = 0; i < reposMeta.length; i += CHUNK_SIZE) {
      const chunk = reposMeta.slice(i, i + CHUNK_SIZE);
      await Promise.all(chunk.map(async (repo) => {
        try {
          const owner = repo.owner.login;
          const name = repo.name;
          
          const [viewsData, clonesData, referrersData, pathsData] = await Promise.all([
            fetchWithAuth(`https://api.github.com/repos/${owner}/${name}/traffic/views`).catch((err) => ({ error: true, status: err.status || 500 })),
            fetchWithAuth(`https://api.github.com/repos/${owner}/${name}/traffic/clones`).catch((err) => ({ error: true, status: err.status || 500 })),
            fetchWithAuth(`https://api.github.com/repos/${owner}/${name}/traffic/popular/referrers`).catch((err) => ({ error: true, status: err.status || 500 })),
            fetchWithAuth(`https://api.github.com/repos/${owner}/${name}/traffic/popular/paths`).catch((err) => ({ error: true, status: err.status || 500 }))
          ]);
          
          mergeTrafficData(repo.full_name, viewsData, clonesData, referrersData, pathsData);
        } catch (err) {
          console.warn(`상세 API 조회 거부됨 (${repo.full_name}):`, err);
        }
      }));
      showLoading(`트래픽 데이터를 가져오는 중... (${Math.min(i + CHUNK_SIZE, reposMeta.length)}/${reposMeta.length})`);
    }
    
    hideLoading();
    state.isDemo = false;
    updateLayoutState();
    
    compileReposList();
    renderDashboard();
    
    // GA Track connection success
    if (state.isConnecting) {
      state.isConnecting = false;
      if (typeof gtag === 'function') {
        const connectMethod = state.token && state.token.startsWith('ghp_') ? 'pat' : 'oauth';
        gtag('event', 'github_connect_success', { method: connectMethod });
      }
    }

    // Start background monitor if configured
    if (state.slackNotifyEnabled) {
      startBackgroundNotifier();
    }
  } catch (error) {
    hideLoading();
    alert(`연동 실패: ${error.message}`);
    
    // GA Track connection error
    if (state.isConnecting) {
      state.isConnecting = false;
      if (typeof gtag === 'function') {
        const connectMethod = state.token && state.token.startsWith('ghp_') ? 'pat' : 'oauth';
        gtag('event', 'github_connect_error', {
          method: connectMethod,
          error_message: error.message
        });
      }
    }
    
    if (error.message.includes('올바르지 않은') || error.message.includes('401')) {
      state.token = '';
      state.username = '';
      localStorage.removeItem('github_traffic_token');
      localStorage.removeItem('github_traffic_username');
      updateLayoutState();
    } else {
      showEmptyState();
    }
  }
}

// UI triggers
function showLoading(msg) {
  document.getElementById('loading-state').style.display = 'flex';
  document.getElementById('loading-text').innerText = msg;
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('repo-grid-container').style.display = 'none';
}
function hideLoading() {
  document.getElementById('loading-state').style.display = 'none';
}
function showEmptyState() {
  document.getElementById('empty-state').style.display = 'flex';
  document.getElementById('repo-grid-container').style.display = 'none';
}

// -------------------------------------------------------------
// 6. DASHBOARD RENDERING
// -------------------------------------------------------------
function calculateChange(todayVal, yesterdayVal) {
  if (yesterdayVal === 0) {
    return todayVal > 0 ? { text: `+${todayVal * 100}%`, isUp: true } : { text: '0%', isUp: true };
  }
  const diff = todayVal - yesterdayVal;
  const pct = Math.round((diff / yesterdayVal) * 100);
  return pct >= 0 ? { text: `+${pct}%`, isUp: true } : { text: `${pct}%`, isUp: false };
}

function renderDashboard() {
  if (state.repos.length === 0) {
    showEmptyState();
    return;
  }
  
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('repo-grid-container').style.display = 'grid';
  
  // Summary Stats
  let totalViewsToday = 0;
  let totalClonesToday = 0;
  let totalViewsYesterday = 0;
  let totalClonesYesterday = 0;
  let activeReposToday = 0;
  
  state.repos.forEach(repo => {
    totalViewsToday += repo.todayViews;
    totalClonesToday += repo.todayClones;
    totalViewsYesterday += repo.yesterdayViews;
    totalClonesYesterday += repo.yesterdayClones;
    if (repo.todayViews > 0) activeReposToday++;
  });
  
  document.getElementById('summary-active-count').innerText = activeReposToday;
  const pulseBadge = document.getElementById('pulse-badge');
  const pulseText = document.getElementById('pulse-text');
  const cardActiveStatus = document.getElementById('card-active-status');
  
  if (activeReposToday > 0) {
    pulseBadge.style.display = 'inline-flex';
    pulseText.innerText = '유입 감지';
    cardActiveStatus.classList.add('active');
  } else {
    pulseBadge.style.display = 'none';
    cardActiveStatus.classList.remove('active');
  }
  
  document.getElementById('summary-views-today').innerText = totalViewsToday;
  const viewChange = calculateChange(totalViewsToday, totalViewsYesterday);
  const viewChangeEl = document.getElementById('summary-views-change');
  viewChangeEl.className = `summary-change ${viewChange.isUp ? 'up' : 'down'}`;
  viewChangeEl.innerHTML = `<i data-lucide="${viewChange.isUp ? 'trending-up' : 'trending-down'}" style="width: 14px; height: 14px;"></i> ${viewChange.text}`;
  
  document.getElementById('summary-clones-today').innerText = totalClonesToday;
  const cloneChange = calculateChange(totalClonesToday, totalClonesYesterday);
  const cloneChangeEl = document.getElementById('summary-clones-change');
  cloneChangeEl.className = `summary-change ${cloneChange.isUp ? 'up' : 'down'}`;
  cloneChangeEl.innerHTML = `<i data-lucide="${cloneChange.isUp ? 'trending-up' : 'trending-down'}" style="width: 14px; height: 14px;"></i> ${cloneChange.text}`;
  
  // Sort and Search
  let filtered = state.repos.filter(repo => {
    const matchesSearch = repo.name.toLowerCase().includes(state.currentSearch.toLowerCase());
    const matchesVisibility = state.showPrivate ? true : !repo.private;
    return matchesSearch && matchesVisibility;
  });
  
  // Process relative date active profiles first for sorting stability
  filtered.forEach(repo => {
    repo.activityProfile = calculateLastActive(repo.views);
  });
  
  filtered.sort((a, b) => {
    if (state.currentSort === 'last-active') {
      return a.activityProfile.daysDiff - b.activityProfile.daysDiff || b.totalViews14d - a.totalViews14d;
    } else if (state.currentSort === 'today-views') {
      return b.todayViews - a.todayViews || b.totalViews14d - a.totalViews14d;
    } else if (state.currentSort === 'total-views') {
      return b.totalViews14d - a.totalViews14d;
    } else if (state.currentSort === 'total-clones') {
      return b.totalClones14d - a.totalClones14d || b.totalViews14d - a.totalViews14d;
    } else if (state.currentSort === 'name') {
      return a.name.localeCompare(b.name);
    }
    return 0;
  });
  
  // Render Cards
  const gridContainer = document.getElementById('repo-grid-container');
  gridContainer.innerHTML = '';
  
  filtered.forEach(repo => {
    const card = document.createElement('div');
    card.className = 'glass-panel repo-card';
    
    const activity = repo.activityProfile;
    const dualSparklineHtml = generateDualMirrorSparkline(repo.views, repo.clones);
    const dualGridHtml = generateDualSparkGridHtml(repo.views, repo.clones);
    const dualHoverOverlayHtml = generateSparklineHoverOverlay(repo.views, repo.clones);

    // Calculate today's unique counts
    const todayStr = new Date().toISOString().split('T')[0];
    const todayViewUniques = repo.views[todayStr] ? repo.views[todayStr].uniques : 0;
    const todayCloneUniques = repo.clones[todayStr] ? repo.clones[todayStr].uniques : 0;
    
    const mode = state.chartViewMode || 'both';

    let middleContentHtml = '';
    if (repo.error === 'forbidden') {
      middleContentHtml = `
        <div class="repo-error-chart-placeholder">
          <i data-lucide="shield-alert"></i>
          <span>상세 트래픽 권한 없음</span>
          <p>이 레포지토리의 트래픽을 조회하려면 토큰에 'repo' 권한(Classic) 또는 'Traffic' 읽기 권한(Fine-grained)이 필요합니다.</p>
        </div>
      `;
    } else {
      const labelsHtml = mode === 'both' ? `
        <span class="label-views"><span class="legend-line legend-solid" style="background:#06b6d4"></span>Views</span>
        <span class="label-clones"><span class="legend-line legend-solid" style="background:#a855f7"></span>Clones</span>
      ` : (mode === 'views' ? `
        <span class="label-views"><span class="legend-line legend-solid" style="background:#06b6d4"></span>Views</span>
        <span></span>
      ` : `
        <span></span>
        <span class="label-clones"><span class="legend-line legend-solid" style="background:#a855f7"></span>Clones</span>
      `);

      const axisLabelHtml = mode === 'both' ? `
        <span>${repo.totalViews14d}</span>
        <span style="opacity:0.4;font-size:0.6rem">14d</span>
        <span>${repo.totalClones14d}</span>
      ` : (mode === 'views' ? `
        <span>${repo.totalViews14d}</span>
        <span style="opacity:0.4;font-size:0.6rem;white-space:nowrap;">14d Views</span>
        <span></span>
      ` : `
        <span></span>
        <span style="opacity:0.4;font-size:0.6rem;white-space:nowrap;">14d Clones</span>
        <span>${repo.totalClones14d}</span>
      `);

      const legendHtml = mode === 'both' ? `
        <span class="legend-item"><span class="legend-dash" style="border-color:#22d3ee"></span>Unique</span>
        <span class="legend-item"><span class="legend-dash" style="border-color:#c084fc"></span>Unique</span>
      ` : (mode === 'views' ? `
        <span class="legend-item"><span class="legend-dash" style="border-color:#22d3ee"></span>Unique</span>
      ` : `
        <span class="legend-item"><span class="legend-dash" style="border-color:#c084fc"></span>Unique</span>
      `);

      middleContentHtml = `
        <div class="dual-sparkline-section">
          <div class="dual-sparkline-labels">
            ${labelsHtml}
          </div>
          <div class="dual-sparkline-wrap">
            ${dualSparklineHtml}
            <div class="sparkline-hover-overlay">
              ${dualHoverOverlayHtml}
            </div>
            <div class="dual-axis-label">
              ${axisLabelHtml}
            </div>
          </div>
          <div class="dual-sparkline-legend">
            ${legendHtml}
          </div>
        </div>
      `;
    }

    let gridContentHtml = '';
    if (repo.error !== 'forbidden') {
      gridContentHtml = `
        <!-- Dual-Row Dot Grid (top=Views, bottom=Clones) -->
        <div class="spark-grid-section">
          <div class="dual-grid-label">
            <span style="color:#06b6d4">● Views</span>
            <span style="color:var(--text-muted)">14일 전 → 오늘</span>
            <span style="color:#a855f7">● Clones</span>
          </div>
          <div class="dual-dot-grid">
            ${dualGridHtml}
          </div>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="card-top">
        <div>
          <div class="repo-name-row">
            <div class="repo-name" title="${repo.fullName}">${repo.name}</div>
            <span class="visibility-tag ${repo.private ? 'private' : 'public'}">
              <i data-lucide="${repo.private ? 'lock' : 'globe'}" style="width: 9px; height: 9px;"></i>
              ${repo.private ? 'Private' : 'Public'}
            </span>
          </div>
          <span class="repo-lang-tag">
            <span class="lang-dot" style="background-color: ${repo.languageColor}"></span>
            ${repo.language}
          </span>
        </div>
        <span class="active-badge ${activity.class}">
          <i data-lucide="clock" style="width: 10px; height: 10px;"></i>
          ${activity.text}
        </span>
      </div>
      
      ${middleContentHtml}
      
      <!-- 4-Metric Compact Stats -->
      <div class="card-stats-4">
        <div class="stat4-item views-stat">
          <span class="stat4-label">👁 오늘</span>
          <span class="stat4-main">${repo.todayViews}</span>
          <span class="stat4-sub">${todayViewUniques} unique</span>
        </div>
        <div class="stat4-item clones-stat">
          <span class="stat4-label">⬇ 오늘</span>
          <span class="stat4-main">${repo.todayClones}</span>
          <span class="stat4-sub">${todayCloneUniques} unique</span>
        </div>
        <div class="stat4-item views-stat dimmed">
          <span class="stat4-label">👁 14일</span>
          <span class="stat4-main">${repo.totalViews14d}</span>
        </div>
        <div class="stat4-item clones-stat dimmed">
          <span class="stat4-label">⬇ 14일</span>
          <span class="stat4-main">${repo.totalClones14d}</span>
        </div>
      </div>
      
      ${gridContentHtml}

      <!-- Share Button -->
      <button class="card-share-btn" data-share-repo="${repo.fullName}" title="트래픽 카드 공유">
        <i data-lucide="share-2" style="width:10px;height:10px;"></i> 공유하기
      </button>
    `;
    
    card.addEventListener('click', (e) => {
      // Don't open detail drawer if user clicked on the interactive hover overlay
      if (e.target.closest('.sparkline-hover-overlay')) return;
      // Don't open detail drawer if user clicked the share button
      if (e.target.closest('.card-share-btn')) return;
      openDetailDrawer(repo);
    });

    // Share button — stop propagation so card click doesn't fire
    const shareBtn = card.querySelector('.card-share-btn');
    if (shareBtn) {
      shareBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        captureAndShare(repo);
      });
    }

    gridContainer.appendChild(card);
  });
  
  // Aggregate referrals
  const aggregatedRefs = {};
  state.repos.forEach(repo => {
    repo.referrers.forEach(ref => {
      if (!aggregatedRefs[ref.referrer]) aggregatedRefs[ref.referrer] = { count: 0, uniques: 0 };
      aggregatedRefs[ref.referrer].count += ref.count;
      aggregatedRefs[ref.referrer].uniques += ref.uniques;
    });
  });
  
  const sortedRefs = Object.keys(aggregatedRefs)
    .map(key => ({ referrer: key, count: aggregatedRefs[key].count, uniques: aggregatedRefs[key].uniques }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
    
  const refContainer = document.getElementById('referrer-list-container');
  refContainer.innerHTML = '';
  if (sortedRefs.length === 0) {
    refContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.75rem; text-align: center; padding: 0.5rem 0;">데이터가 없습니다.</div>';
  } else {
    sortedRefs.forEach(ref => {
      const item = document.createElement('div');
      item.className = 'referrer-item';
      
      let icon = 'link';
      let friendlyName = ref.referrer;
      if (ref.referrer.toLowerCase().includes('google')) { icon = 'search'; friendlyName = 'Google'; }
      else if (ref.referrer.toLowerCase().includes('github')) { icon = 'github'; friendlyName = 'GitHub'; }
      else if (ref.referrer.toLowerCase().includes('t.co') || ref.referrer.toLowerCase().includes('twitter')) { icon = 'twitter'; friendlyName = 'Twitter'; }
      
      item.innerHTML = `
        <div class="referrer-name">
          <i data-lucide="${icon}" style="width: 12px; height: 12px; color: var(--accent-amber);"></i>
          <span>${friendlyName}</span>
        </div>
        <span style="font-weight: 700;">${ref.count} <span style="font-size: 0.7rem; color: var(--text-muted);">(${ref.uniques})</span></span>
      `;
      refContainer.appendChild(item);
    });
  }
  
  // Sidebar top ranked repos
  const topRepos = [...state.repos]
    .map(repo => ({
      name: repo.name,
      fullName: repo.fullName,
      score: repo.totalViews14d + (repo.totalClones14d * 4)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
    
  const rankContainer = document.getElementById('top-repos-list-container');
  rankContainer.innerHTML = '';
  if (topRepos.length === 0) {
    rankContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.75rem; text-align: center; padding: 0.5rem 0;">데이터가 없습니다.</div>';
  } else {
    topRepos.forEach((repo, index) => {
      const item = document.createElement('div');
      item.className = 'top-repo-item';
      item.innerHTML = `
        <span class="top-repo-rank">${index + 1}</span>
        <span style="flex: 1; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 0.5rem;" title="${repo.fullName}">${repo.name}</span>
        <span style="font-weight: 700; color: var(--accent-cyan);">${repo.score} pt</span>
      `;
      rankContainer.appendChild(item);
    });
  }
  
  initIcons();
}

// -------------------------------------------------------------
// 7. DETAIL DRAWER FOR REFERRERS
// -------------------------------------------------------------
function openDetailDrawer(repo) {
  state.selectedRepo = repo;
  
  document.getElementById('detail-repo-name').innerText = repo.name;
  document.getElementById('detail-repo-desc').innerText = repo.description;
  
  const bodyEl = document.getElementById('detail-drawer-body');
  
  if (repo.error === 'forbidden') {
    bodyEl.innerHTML = `
      <div class="repo-error-chart-placeholder" style="height: auto; padding: 2rem 1.2rem; margin-top: 1.5rem;">
        <i data-lucide="shield-alert" style="width: 28px; height: 28px; margin-bottom: 0.4rem;"></i>
        <span style="font-size: 0.95rem;">상세 분석 권한 없음</span>
        <p style="font-size: 0.75rem; margin-top: 0.5rem; max-width: 380px; text-align: center;">
          상세 유입 경로, 인기 방문 파일(Paths), 일자별 상세 수치를 조회하지 못했습니다.<br><br>
          이 레포지토리의 상세 통계 조회를 위해서는 개인 토큰(PAT) 발급 시 <strong>'repo' 권한 (Classic PAT)</strong> 또는 <strong>'Traffic' Read-only 권한 (Fine-grained PAT)</strong>이 부여되어야 합니다.
        </p>
      </div>
    `;
  } else {
    bodyEl.innerHTML = `
      <div class="detail-meta-list">
        <h3 style="font-size: 0.9rem; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.3rem;">
          <i data-lucide="compass" style="color: var(--accent-amber);"></i> 개별 유입 소스 (Referrers)
        </h3>
        <div id="detail-referrer-list" class="referrer-list"></div>
      </div>

      <div class="detail-meta-list" style="margin-top: 1.5rem; border-top: 1px solid var(--border-color); padding-top: 1.2rem;">
        <h3 style="font-size: 0.9rem; margin-bottom: 0.6rem; display: flex; align-items: center; gap: 0.3rem;">
          <i data-lucide="file-text" style="color: var(--accent-cyan);"></i> 인기 방문 경로 (Popular Paths)
        </h3>
        <div id="detail-paths-list" class="referrer-list"></div>
      </div>
      
      <div class="detail-meta-list" style="margin-top: 1.5rem; border-top: 1px solid var(--border-color); padding-top: 1.2rem;">
        <h3 style="font-size: 0.9rem; margin-bottom: 0.6rem; display: flex; align-items: center; gap: 0.3rem;">
          <i data-lucide="calendar" style="color: var(--accent-emerald);"></i> 14일간 일자별 상세 통계
        </h3>
        <div class="table-responsive">
          <table class="detail-traffic-table">
            <thead>
              <tr>
                <th>날짜</th>
                <th>조회수 (고유)</th>
                <th>클론수 (고유)</th>
              </tr>
            </thead>
            <tbody id="detail-traffic-table-body"></tbody>
          </table>
        </div>
      </div>
    `;

    // 1. Render Referrers list
    const detailRefsContainer = document.getElementById('detail-referrer-list');
    if (!repo.referrers || repo.referrers.length === 0) {
      detailRefsContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.8rem; padding: 0.5rem 0;">방문 경로 통계가 아직 없습니다.</div>';
    } else {
      repo.referrers.forEach(ref => {
        const el = document.createElement('div');
        el.className = 'referrer-item';
        el.innerHTML = `
          <div class="referrer-name">
            <i data-lucide="compass" style="width: 12px; height: 12px; color: var(--accent-cyan);"></i>
            <span>${ref.referrer}</span>
          </div>
          <span>Views: <strong>${ref.count}</strong> <span style="font-size: 0.7rem; color: var(--text-muted);">(Uniques: ${ref.uniques})</span></span>
        `;
        detailRefsContainer.appendChild(el);
      });
    }

    // 2. Render Popular Paths list
    const detailPathsContainer = document.getElementById('detail-paths-list');
    if (!repo.paths || repo.paths.length === 0) {
      detailPathsContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.8rem; padding: 0.5rem 0;">인기 방문 경로 데이터가 없습니다.</div>';
    } else {
      repo.paths.forEach(item => {
        const el = document.createElement('div');
        el.className = 'referrer-item';
        el.innerHTML = `
          <div class="referrer-name" title="${item.path}">
            <i data-lucide="file-text" style="width: 12px; height: 12px; color: var(--accent-cyan);"></i>
            <span class="path-text-scroll">${item.path}</span>
          </div>
          <span style="flex-shrink:0;">Views: <strong>${item.count}</strong> <span style="font-size: 0.7rem; color: var(--text-muted);">(Uniques: ${item.uniques})</span></span>
        `;
        detailPathsContainer.appendChild(el);
        
        // Bind drag-to-scroll functionality
        const scrollSpan = el.querySelector('.path-text-scroll');
        if (scrollSpan) {
          makeDragScrollable(scrollSpan);
        }
      });
    }

    // 3. Render 14-day Daily Breakdown Table (Newest first)
    const tableBody = document.getElementById('detail-traffic-table-body');
    const today = new Date();
    const dateStrings = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      dateStrings.push(d.toISOString().split('T')[0]);
    }

    dateStrings.forEach(date => {
      const v = repo.views[date] ? repo.views[date].count : 0;
      const vu = repo.views[date] ? repo.views[date].uniques : 0;
      const c = repo.clones[date] ? repo.clones[date].count : 0;
      const cu = repo.clones[date] ? repo.clones[date].uniques : 0;
      
      const dParts = date.split('-');
      const formattedDate = `${dParts[1]}/${dParts[2]}`; // MM/DD
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight: 600;">${formattedDate}</td>
        <td>${v} <span style="color: var(--text-muted); font-size: 0.7rem;">(${vu})</span></td>
        <td>${c} <span style="color: var(--text-muted); font-size: 0.7rem;">(${cu})</span></td>
      `;
      tableBody.appendChild(tr);
    });
  }
  
  document.getElementById('detail-drawer').classList.add('open');
  initIcons();
}

// -------------------------------------------------------------
// 8. OAUTH LOGIC
// -------------------------------------------------------------
async function initOAuthConfig() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    
    const btnGithubOauth = document.getElementById('btn-github-oauth');
    const btnWelcomeOauth = document.getElementById('btn-welcome-oauth');
    const oauthDisabledMessage = document.getElementById('oauth-disabled-message');
    
    if (data.client_id) {
      state.clientId = data.client_id;
      if (btnGithubOauth) btnGithubOauth.style.display = 'inline-flex';
      if (btnWelcomeOauth) btnWelcomeOauth.style.display = 'inline-flex';
      if (oauthDisabledMessage) oauthDisabledMessage.style.display = 'none';
    } else {
      if (btnGithubOauth) btnGithubOauth.style.display = 'none';
      if (btnWelcomeOauth) btnWelcomeOauth.style.display = 'inline-flex';
      if (oauthDisabledMessage) oauthDisabledMessage.style.display = 'block';
    }
  } catch (err) {
    console.warn('Failed to retrieve server configurations:', err);
    const btnGithubOauth = document.getElementById('btn-github-oauth');
    const btnWelcomeOauth = document.getElementById('btn-welcome-oauth');
    const oauthDisabledMessage = document.getElementById('oauth-disabled-message');
    
    if (btnGithubOauth) btnGithubOauth.style.display = 'none';
    if (btnWelcomeOauth) btnWelcomeOauth.style.display = 'inline-flex';
    if (oauthDisabledMessage) oauthDisabledMessage.style.display = 'block';
  }
  initIcons();
}

// Register event listener to receive authentication tokens from the OAuth popup window
window.addEventListener('message', async (event) => {
  // Security check: ensure the message is from our own origin
  if (event.origin !== window.location.origin) return;
  
  const { access_token, username, error } = event.data;
  
  if (error) {
    alert(`OAuth 로그인 실패: ${error}`);
    return;
  }
  
  if (access_token && username) {
    state.isConnecting = true;
    if (typeof gtag === 'function') {
      gtag('event', 'github_connect_attempt', { method: 'oauth' });
    }
    showLoading('깃허브 트래픽 정보 가져오는 중...');
    
    state.token = access_token;
    state.username = username;
    state.isDemo = false;
    
    localStorage.setItem('github_traffic_token', access_token);
    localStorage.setItem('github_traffic_username', username);
    
    document.getElementById('github-username').value = username;
    document.getElementById('github-token').value = access_token;
    document.getElementById('settings-drawer').classList.remove('open');
    
    updateLayoutState();
    await fetchTrafficData();
  }
});

// -------------------------------------------------------------
// 9. CLIENT-SIDE BACKGROUND SLACK NOTIFIER
// -------------------------------------------------------------
function startBackgroundNotifier() {
  stopBackgroundNotifier();
  
  if (!state.slackUrl || !state.slackNotifyEnabled || state.isDemo || !state.token) {
    return;
  }
  
  console.log('Background Slack Notifier activated.');
  state.isPollingActive = true;
  
  // Set default interval to 5 minutes
  const intervalTime = 5 * 60 * 1000;
  state.pollingIntervalId = setInterval(checkTrafficAndNotify, intervalTime);
  
  // Attach Visibility check to toggle interval speed based on tab state
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

function stopBackgroundNotifier() {
  if (state.pollingIntervalId) {
    clearInterval(state.pollingIntervalId);
    state.pollingIntervalId = null;
  }
  state.isPollingActive = false;
}

function handleVisibilityChange() {
  if (!state.isPollingActive) return;
  
  clearInterval(state.pollingIntervalId);
  if (document.visibilityState === 'hidden') {
    // Slower polling rate when hidden (30 minutes) to save browser resources
    console.log('Tab hidden. Polling interval set to 30 mins.');
    state.pollingIntervalId = setInterval(checkTrafficAndNotify, 30 * 60 * 1000);
  } else {
    // Back to normal (5 minutes) and trigger 1 instant scan
    console.log('Tab visible. Polling interval reset to 5 mins and triggering instant check.');
    state.pollingIntervalId = setInterval(checkTrafficAndNotify, 5 * 60 * 1000);
    checkTrafficAndNotify();
  }
}

async function checkTrafficAndNotify() {
  if (!state.token || !state.slackUrl || state.isDemo) return;
  
  console.log('Checking traffic for Slack notification increments...');
  const todayStr = new Date().toISOString().split('T')[0];
  const increments = [];
  
  try {
    // Only query repos compiled in the current active state
    for (let repo of state.repos) {
      const owner = state.username;
      const name = repo.name;
      
      // Pull fresh data from API
      const viewsData = await fetchWithAuth(`https://api.github.com/repos/${owner}/${name}/traffic/views`).catch(() => null);
      const clonesData = await fetchWithAuth(`https://api.github.com/repos/${owner}/${name}/traffic/clones`).catch(() => null);
      
      if (!viewsData && !clonesData) continue;
      
      const latestViews = viewsData?.views?.find(v => v.timestamp.startsWith(todayStr))?.count || 0;
      const latestClones = clonesData?.clones?.find(c => c.timestamp.startsWith(todayStr))?.count || 0;
      
      // Compare with currently saved cache values in local state
      const cachedViews = repo.views[todayStr]?.count || 0;
      const cachedClones = repo.clones[todayStr]?.count || 0;
      
      const newViews = latestViews - cachedViews;
      const newClones = latestClones - cachedClones;
      
      if (newViews > 0 || newClones > 0) {
        increments.push({
          name: repo.name,
          newViews,
          newClones,
          totalViews: latestViews,
          totalClones: latestClones
        });
        
        // Overwrite local cache immediately so we do not notify for this increment again
        mergeTrafficData(repo.fullName, viewsData, clonesData, null, null);
      }
    }
    
    // If any changes occurred, send a combined slack message
    if (increments.length > 0) {
      await sendCombinedSlackNotification(increments);
      // Re-compile local state metrics to match updated cache
      compileReposList();
      renderDashboard();
    } else {
      console.log('No new increments found.');
    }
  } catch (err) {
    console.warn('Background check run failed:', err);
  }
}

async function sendCombinedSlackNotification(increments) {
  const fields = [];
  increments.forEach(item => {
    fields.push({
      type: 'mrkdwn',
      text: `*${item.name}*\n👁️ *+${item.newViews}* Views (총 ${item.totalViews})\n💾 *+${item.newClones}* Clones (총 ${item.totalClones})`
    });
  });

  const payload = {
    text: `🚨 [GitTraffic] 신규 방문자 유입 감지!`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `📈 GitTraffic 실시간 유입 리포트`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `다음 레포지토리에 새로운 유입이 감지되었습니다:`
        }
      },
      {
        type: 'section',
        fields: fields.slice(0, 10) // Slack limits fields to 10 max
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `감지 시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} | 브라우저 감시 모드`
          }
        ]
      }
    ]
  };

  try {
    const res = await fetch(state.slackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) throw new Error(`Status ${res.status}`);
    console.log('Slack webhook combined message sent successfully!');
  } catch (err) {
    console.warn('Failed to send Slack webhook:', err);
  }
}

// -------------------------------------------------------------
// 10. SETUP & EVENTS
// -------------------------------------------------------------
function updatePrivateFilterBtn() {
  const btn = document.getElementById('btn-toggle-private');
  const label = document.getElementById('private-filter-label');
  if (!btn || !label) return;
  if (state.showPrivate) {
    label.textContent = 'Private 표시 중';
    btn.classList.add('active');
  } else {
    label.textContent = 'Private 숨김';
    btn.classList.remove('active');
  }
}

function updateLayoutState() {
  const isConnected = !!(state.token && state.username);
  
  const welcomeSection = document.getElementById('welcome-section');
  const summaryGrid = document.querySelector('.summary-grid');
  const mainLayout = document.querySelector('.main-layout');
  const btnSettings = document.getElementById('btn-settings');
  const btnLogout = document.getElementById('btn-logout');
  const btnToggleSummary = document.getElementById('btn-toggle-summary');
  const btnSyncData = document.getElementById('btn-sync-data');
  const syncTimeDisplay = document.getElementById('sync-time-display');
  
  if (isConnected) {
    if (welcomeSection) welcomeSection.style.display = 'none';
    if (mainLayout) mainLayout.style.display = 'grid';
    if (btnSettings) btnSettings.style.display = 'inline-flex';
    if (btnLogout) btnLogout.style.display = 'inline-flex';
    if (btnSyncData) btnSyncData.style.display = 'inline-flex';
    
    if (syncTimeDisplay) {
      syncTimeDisplay.style.display = 'inline-block';
      // Calculate latest cache update time
      let latestTime = null;
      Object.keys(state.cachedData).forEach(repo => {
        const t = state.cachedData[repo].updatedAt;
        if (t) {
          const d = new Date(t);
          if (!latestTime || d > latestTime) {
            latestTime = d;
          }
        }
      });
      if (latestTime) {
        const hrs = String(latestTime.getHours()).padStart(2, '0');
        const mins = String(latestTime.getMinutes()).padStart(2, '0');
        const secs = String(latestTime.getSeconds()).padStart(2, '0');
        syncTimeDisplay.textContent = `최근 동기화: ${hrs}:${mins}:${secs}`;
      } else {
        syncTimeDisplay.textContent = '동기화 필요';
      }
    }
    
    if (btnToggleSummary) {
      btnToggleSummary.style.display = 'inline-flex';
      if (state.hideSummary) {
        if (summaryGrid) summaryGrid.style.display = 'none';
        btnToggleSummary.innerHTML = `<i data-lucide="eye"></i> 요약 보이기`;
      } else {
        if (summaryGrid) summaryGrid.style.display = 'grid';
        btnToggleSummary.innerHTML = `<i data-lucide="eye-off"></i> 요약 숨기기`;
      }
    }
  } else {
    if (welcomeSection) welcomeSection.style.display = 'flex';
    
    // Reset to showing the landing view and hiding the login form
    const landingView = document.getElementById('landing-view');
    const formView = document.getElementById('form-view');
    if (landingView) landingView.style.display = 'flex';
    if (formView) formView.style.display = 'none';

    if (summaryGrid) summaryGrid.style.display = 'none';
    if (mainLayout) mainLayout.style.display = 'none';
    if (btnSettings) btnSettings.style.display = 'none';
    if (btnLogout) btnLogout.style.display = 'none';
    if (btnToggleSummary) btnToggleSummary.style.display = 'none';
    if (btnSyncData) btnSyncData.style.display = 'none';
    if (syncTimeDisplay) syncTimeDisplay.style.display = 'none';
  }
  initIcons();
}

function logout() {
  state.token = '';
  state.username = '';
  state.repos = [];
  
  localStorage.removeItem('github_traffic_token');
  localStorage.removeItem('github_traffic_username');
  localStorage.removeItem('github_traffic_cache');
  
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && key.startsWith('github_traffic_meta_')) {
      localStorage.removeItem(key);
    }
  }
  
  stopBackgroundNotifier();
  updateLayoutState();
  
  const usernameInput = document.getElementById('github-username');
  const tokenInput = document.getElementById('github-token');
  if (usernameInput) usernameInput.value = '';
  if (tokenInput) tokenInput.value = '';
  
  const welcomeUser = document.getElementById('welcome-username');
  const welcomeToken = document.getElementById('welcome-token');
  if (welcomeUser) welcomeUser.value = '';
  if (welcomeToken) welcomeToken.value = '';
}

function loadConfig() {
  const savedToken = localStorage.getItem('github_traffic_token');
  const savedUsername = localStorage.getItem('github_traffic_username');
  const savedCache = localStorage.getItem('github_traffic_cache');
  
  // Slack configuration
  const savedSlackUrl = localStorage.getItem('github_traffic_slack_url');
  const savedSlackNotify = localStorage.getItem('github_traffic_slack_notify') === 'true';
  
  state.slackUrl = savedSlackUrl || '';
  state.slackNotifyEnabled = savedSlackNotify;
  
  const slackUrlInput = document.getElementById('slack-webhook-url');
  const slackNotifyInput = document.getElementById('slack-notify-toggle');
  if (slackUrlInput) slackUrlInput.value = state.slackUrl;
  if (slackNotifyInput) slackNotifyInput.checked = state.slackNotifyEnabled;
  
  if (savedCache) {
    state.cachedData = JSON.parse(savedCache);
  }
  
  if (savedToken && savedUsername) {
    state.token = savedToken;
    state.username = savedUsername;
    state.isDemo = false;
    
    const usernameInput = document.getElementById('github-username');
    const tokenInput = document.getElementById('github-token');
    if (usernameInput) usernameInput.value = savedUsername;
    // Masking raw token for security. The user won't see raw token, only placeholder dots.
    if (tokenInput) tokenInput.value = '••••••••••••••••••••••••••••••••••••••••';
    
    updateLayoutState();
    // Default config loading should NOT force api requests if cache is fresh.
    fetchTrafficData(false);
  } else {
    state.isDemo = false;
    updateLayoutState();
  }
}

function setupEventListeners() {
  const triggerOAuthPopup = () => {
    if (!state.clientId) {
      document.getElementById('settings-drawer').classList.add('open');
      alert('GitHub OAuth 간편 로그인이 비활성화되어 있습니다. Personal Access Token(PAT)을 직접 등록하여 연동을 완료해 주세요.');
      document.getElementById('github-username').focus();
      return;
    }
    
    const redirectUri = window.location.origin + '/api/callback';
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${state.clientId}&scope=repo,read:user&redirect_uri=${encodeURIComponent(redirectUri)}`;
    
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    
    window.open(
      githubAuthUrl,
      'github-oauth',
      `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
    );
  };

  // OAuth Button triggers
  const btnGithubOauth = document.getElementById('btn-github-oauth');
  if (btnGithubOauth) {
    btnGithubOauth.addEventListener('click', triggerOAuthPopup);
  }
  
  const welcomeOauthBtn = document.getElementById('btn-welcome-oauth');
  if (welcomeOauthBtn) {
    welcomeOauthBtn.addEventListener('click', triggerOAuthPopup);
  }
  
  const welcomePatBtn = document.getElementById('btn-welcome-pat');
  if (welcomePatBtn) {
    welcomePatBtn.addEventListener('click', () => {
      const drawer = document.getElementById('settings-drawer');
      if (drawer) drawer.classList.add('open');
    });
  }
  
  // Dialog controls
  const btnSettings = document.getElementById('btn-settings');
  if (btnSettings) {
    btnSettings.addEventListener('click', () => {
      const drawer = document.getElementById('settings-drawer');
      if (drawer) drawer.classList.add('open');
    });
  }
  
  const btnCloseSettings = document.getElementById('btn-close-settings');
  if (btnCloseSettings) {
    btnCloseSettings.addEventListener('click', () => {
      const drawer = document.getElementById('settings-drawer');
      if (drawer) drawer.classList.remove('open');
    });
  }
  
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }

  const toggleSummaryBtn = document.getElementById('btn-toggle-summary');
  if (toggleSummaryBtn) {
    toggleSummaryBtn.addEventListener('click', () => {
      state.hideSummary = !state.hideSummary;
      localStorage.setItem('github_traffic_hide_summary', state.hideSummary);
      updateLayoutState();
    });
  }

  const togglePrivateBtn = document.getElementById('btn-toggle-private');
  if (togglePrivateBtn) {
    // Set initial visual state
    updatePrivateFilterBtn();
    togglePrivateBtn.addEventListener('click', () => {
      state.showPrivate = !state.showPrivate;
      localStorage.setItem('github_traffic_show_private', state.showPrivate);
      updatePrivateFilterBtn();
      renderDashboard();
    });
  }
  
  const emptyLogoutBtn = document.getElementById('btn-empty-logout');
  if (emptyLogoutBtn) {
    emptyLogoutBtn.addEventListener('click', logout);
  }
  
  const emptySettingsBtn = document.getElementById('btn-empty-settings');
  if (emptySettingsBtn) {
    emptySettingsBtn.addEventListener('click', () => {
      const drawer = document.getElementById('settings-drawer');
      if (drawer) drawer.classList.add('open');
    });
  }
  
  const btnCloseDetail = document.getElementById('btn-close-detail');
  if (btnCloseDetail) {
    btnCloseDetail.addEventListener('click', () => {
      const drawer = document.getElementById('detail-drawer');
      if (drawer) drawer.classList.remove('open');
    });
  }
  
  // Close drawers on backdrop click
  document.querySelectorAll('.drawer-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });

  // Manual Sync Button Event
  const btnSyncData = document.getElementById('btn-sync-data');
  if (btnSyncData) {
    btnSyncData.addEventListener('click', () => {
      // Rotate refresh icon to give visual cue of sync starting
      const icon = btnSyncData.querySelector('i');
      if (icon) icon.style.transform = 'rotate(360deg)';
      fetchTrafficData(true).finally(() => {
        if (icon) icon.style.transform = 'none';
      });
    });
  }

  // Settings form submit
  const settingsForm = document.getElementById('settings-form');
  if (settingsForm) {
    settingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const inputUsername = document.getElementById('github-username').value.trim();
      let inputToken = document.getElementById('github-token').value.trim();
      
      // Slack parameters
      const inputSlackUrl = document.getElementById('slack-webhook-url').value.trim();
      const inputSlackNotify = document.getElementById('slack-notify-toggle').checked;
      
      // Check if user did not edit the masked token
      if (inputToken.includes('•••')) {
        inputToken = localStorage.getItem('github_traffic_token') || '';
      }
      
      if (inputUsername && inputToken) {
        state.isConnecting = true;
        if (typeof gtag === 'function') {
          gtag('event', 'github_connect_attempt', { method: 'pat' });
        }
        state.username = inputUsername;
        state.token = inputToken;
        localStorage.setItem('github_traffic_username', inputUsername);
        localStorage.setItem('github_traffic_token', inputToken);
        
        // Save slack config
        state.slackUrl = inputSlackUrl;
        state.slackNotifyEnabled = inputSlackNotify;
        localStorage.setItem('github_traffic_slack_url', inputSlackUrl);
        localStorage.setItem('github_traffic_slack_notify', inputSlackNotify);
        
        const drawer = document.getElementById('settings-drawer');
        if (drawer) drawer.classList.remove('open');
        
        // Mask input again for safety
        document.getElementById('github-token').value = '••••••••••••••••••••••••••••••••••••••••';
        
        // Refresh data forcing new network requests
        updateLayoutState();
        fetchTrafficData(true);
      }
    });
  }

  // Welcome page inline form submit
  const welcomeForm = document.getElementById('welcome-form');
  if (welcomeForm) {
    welcomeForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const inputUsername = document.getElementById('welcome-username').value.trim();
      const inputToken = document.getElementById('welcome-token').value.trim();
      
      if (inputUsername && inputToken) {
        state.isConnecting = true;
        if (typeof gtag === 'function') {
          gtag('event', 'github_connect_attempt', { method: 'pat' });
        }
        state.username = inputUsername;
        state.token = inputToken;
        localStorage.setItem('github_traffic_username', inputUsername);
        localStorage.setItem('github_traffic_token', inputToken);
        
        // Sync values to settings drawer form
        const mainUser = document.getElementById('github-username');
        const mainToken = document.getElementById('github-token');
        if (mainUser) mainUser.value = inputUsername;
        if (mainToken) mainToken.value = '••••••••••••••••••••••••••••••••••••••••';
        
        updateLayoutState();
        fetchTrafficData(true);
      }
    });
  }

  // Onboarding View transitions
  const btnGoToForm = document.getElementById('btn-go-to-form');
  const btnBackToLanding = document.getElementById('btn-back-to-landing');
  const landingView = document.getElementById('landing-view');
  const formView = document.getElementById('form-view');

  if (btnGoToForm && landingView && formView) {
    btnGoToForm.addEventListener('click', () => {
      // Transition from landing page to credentials form
      landingView.style.display = 'none';
      formView.style.display = 'block';
      formView.classList.remove('view-slide-up');
      // trigger reflow
      void formView.offsetWidth;
      formView.classList.add('view-slide-up');
      initIcons();
    });
  }

  if (btnBackToLanding && landingView && formView) {
    btnBackToLanding.addEventListener('click', () => {
      // Transition back to landing page
      formView.style.display = 'none';
      landingView.style.display = 'flex';
      landingView.classList.remove('view-slide-up');
      // trigger reflow
      void landingView.offsetWidth;
      landingView.classList.add('view-slide-up');
      initIcons();
    });
  }
  
  // Search input filter
  const repoSearch = document.getElementById('repo-search');
  if (repoSearch) {
    repoSearch.addEventListener('input', (e) => {
      state.currentSearch = e.target.value;
      renderDashboard();
    });
  }
  
  // Sort selection
  const repoSort = document.getElementById('repo-sort');
  if (repoSort) {
    repoSort.addEventListener('change', (e) => {
      state.currentSort = e.target.value;
      renderDashboard();
    });
  }

  // Chart view mode segmented selector
  const viewModeContainer = document.getElementById('chart-view-mode');
  if (viewModeContainer) {
    const segmentButtons = viewModeContainer.querySelectorAll('.segment-btn');
    segmentButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        segmentButtons.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        state.chartViewMode = e.currentTarget.dataset.mode;
        renderDashboard();
      });
    });
  }

  // Floating Tooltip Event Delegation for sparkline hover columns
  document.addEventListener('mouseover', (e) => {
    const col = e.target.closest('.sparkline-hover-col');
    if (!col) return;
    
    const label = col.dataset.label;
    const views = col.dataset.views;
    const viewsUniq = col.dataset.viewsUniq;
    const clones = col.dataset.clones;
    const clonesUniq = col.dataset.clonesUniq;
    
    let tooltipEl = document.getElementById('chart-tooltip');
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.id = 'chart-tooltip';
      tooltipEl.className = 'chart-tooltip';
      document.body.appendChild(tooltipEl);
    }
    
    const mode = state.chartViewMode || 'both';
    let content = `<strong>${label}</strong>`;
    if (mode === 'both') {
      content += ` · 조회: ${views}회(고유 ${viewsUniq}) · 클론: ${clones}회(고유 ${clonesUniq})`;
    } else if (mode === 'views') {
      content += ` · 조회: ${views}회(고유 ${viewsUniq})`;
    } else if (mode === 'clones') {
      content += ` · 클론: ${clones}회(고유 ${clonesUniq})`;
    }
    
    tooltipEl.innerHTML = content;
    tooltipEl.classList.add('visible');
    
    // Position tooltip above the column
    const rect = col.getBoundingClientRect();
    const x = rect.left + rect.width / 2 + window.scrollX;
    const y = rect.top + window.scrollY;
    
    tooltipEl.style.left = `${x}px`;
    tooltipEl.style.top = `${y}px`;
  });
  
  document.addEventListener('mouseout', (e) => {
    const col = e.target.closest('.sparkline-hover-col');
    if (!col) return;
    
    // Check if the relatedTarget is still within the same column to avoid flickering/accidental dismissal
    const related = e.relatedTarget;
    if (related && related.closest('.sparkline-hover-col') === col) {
      return;
    }
    
    const tooltipEl = document.getElementById('chart-tooltip');
    if (tooltipEl) {
      tooltipEl.classList.remove('visible');
    }
  });

  // ── Share Modal Events ────────────────────────────
  const btnCloseShareModal = document.getElementById('btn-close-share-modal');
  if (btnCloseShareModal) {
    btnCloseShareModal.addEventListener('click', closeShareModal);
  }

  const shareModalOverlay = document.getElementById('share-modal');
  if (shareModalOverlay) {
    shareModalOverlay.addEventListener('click', (e) => {
      if (e.target === shareModalOverlay) closeShareModal();
    });
  }

  const btnShareDownload = document.getElementById('btn-share-download');
  if (btnShareDownload) {
    btnShareDownload.addEventListener('click', handleShareDownload);
  }

  const btnShareClipboard = document.getElementById('btn-share-clipboard');
  if (btnShareClipboard) {
    btnShareClipboard.addEventListener('click', handleShareClipboard);
  }

  const btnShareNative = document.getElementById('btn-share-native');
  if (btnShareNative) {
    btnShareNative.addEventListener('click', handleShareNative);
  }

  const btnShareCopyLink = document.getElementById('btn-share-copy-link');
  if (btnShareCopyLink) {
    btnShareCopyLink.addEventListener('click', handleShareCopyLink);
  }
}

// =========================================================
// SHARE FEATURE
// =========================================================
let shareImageBlob = null;
let shareCurrentRepo = null;

/**
 * Build a 480px off-screen share card DOM element.
 * Uses entirely inline styles so html2canvas renders reliably.
 */
function buildShareCardDom(repo) {
  const activity = repo.activityProfile || calculateLastActive(repo.views);

  // Explicit colors per activity class (html2canvas may not resolve CSS vars)
  const activityColorMap = {
    'badge-today':     { bg: 'rgba(16,185,129,0.14)', color: '#10b981', border: 'rgba(16,185,129,0.32)' },
    'badge-yesterday': { bg: 'rgba(6,182,212,0.14)',  color: '#06b6d4', border: 'rgba(6,182,212,0.32)' },
    'badge-recent':    { bg: 'rgba(168,85,247,0.12)', color: '#a855f7', border: 'rgba(168,85,247,0.28)' },
    'badge-old':       { bg: 'rgba(100,116,139,0.1)', color: '#64748b', border: 'rgba(100,116,139,0.2)' },
  };
  const aC = activityColorMap[activity.class] || activityColorMap['badge-old'];

  const sparklineSvg = generateShareCardSparkline(repo.views || {}, repo.clones || {});

  // Generate date labels
  const today = new Date();
  const dateStrings = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    dateStrings.push(d.toISOString().split('T')[0]);
  }
  const formatDate = (dateStr) => {
    const parts = dateStr.split('-');
    return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
  };
  const startLabel = formatDate(dateStrings[0]);
  const midLabel = formatDate(dateStrings[6]);
  const endLabel = formatDate(dateStrings[13]);
  const dateFormatted = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;

  const card = document.createElement('div');
  card.id = 'share-card-offscreen';
  card.style.cssText = [
    'width:480px',
    'background:linear-gradient(135deg,#080d1a 0%,#0d1628 100%)',
    'border-radius:16px',
    'padding:22px 24px',
    'font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif',
    'color:#e2e8f0',
    'border:1px solid rgba(99,102,241,0.22)',
    'box-shadow:0 0 50px rgba(99,102,241,0.08)',
    'position:fixed',
    'top:-9999px',
    'left:-9999px',
    'overflow:hidden',
  ].join(';');

  card.innerHTML = `
    <!-- glow accent -->
    <div style="position:absolute;top:-50px;right:-50px;width:180px;height:180px;
      background:radial-gradient(circle,rgba(99,102,241,0.12) 0%,transparent 70%);
      pointer-events:none;"></div>

    <!-- Header row -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:7px;">
      <div style="min-width:0;flex:1;margin-right:12px;">
        <div style="font-size:19px;font-weight:800;color:#f1f5f9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:310px;">${repo.name}</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:310px;">github.com/${repo.fullName}</div>
      </div>
      <div style="font-size:10px;font-weight:700;padding:3px 9px;border-radius:6px;flex-shrink:0;
        background:${repo.private ? 'rgba(244,63,94,0.12)' : 'rgba(255,255,255,0.05)'};
        color:${repo.private ? '#fb7185' : '#94a3b8'};
        border:1px solid ${repo.private ? 'rgba(244,63,94,0.28)' : 'rgba(255,255,255,0.08)'};
      ">${repo.private ? '🔒 Private' : '🌐 Public'}</div>
    </div>

    <!-- Language + activity row -->
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
      <span style="width:8px;height:8px;border-radius:50%;background:${repo.languageColor || '#64748b'};display:inline-block;flex-shrink:0;"></span>
      <span style="font-size:11px;color:#94a3b8;">${repo.language || 'Unknown'}</span>
      <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:5px;
        background:${aC.bg};color:${aC.color};border:1px solid ${aC.border};">${activity.text}</span>
    </div>

    <!-- Graph section -->
    <div style="background:rgba(255,255,255,0.03);border-radius:10px;padding:12px;margin-bottom:14px;border:1px solid rgba(255,255,255,0.05);">
      <div style="display:flex;gap:16px;font-size:11px;color:#64748b;margin-bottom:8px;">
        <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#06b6d4;margin-right:4px;vertical-align:middle;"></span>Views</span>
        <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#a855f7;margin-right:4px;vertical-align:middle;"></span>Clones</span>
      </div>
      <div style="height:84px;position:relative;">${sparklineSvg}</div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:#475569;margin-top:4px;padding:0 2px;">
        <span>${startLabel}</span>
        <span>${midLabel}</span>
        <span>오늘 (${endLabel})</span>
      </div>
    </div>

    <!-- Stats row -->
    <div style="display:flex;gap:8px;margin-bottom:16px;">
      <div style="flex:1;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:10px 6px;text-align:center;">
        <div style="font-size:10px;color:#64748b;margin-bottom:4px;">👁 14일 조회</div>
        <div style="font-size:20px;font-weight:800;color:#f1f5f9;">${(repo.totalViews14d || 0).toLocaleString()}</div>
      </div>
      <div style="flex:1;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:10px 6px;text-align:center;">
        <div style="font-size:10px;color:#64748b;margin-bottom:4px;">⬇ 14일 클론</div>
        <div style="font-size:20px;font-weight:800;color:#f1f5f9;">${(repo.totalClones14d || 0).toLocaleString()}</div>
      </div>
      <div style="flex:1;background:rgba(6,182,212,0.06);border:1px solid rgba(6,182,212,0.16);border-radius:8px;padding:10px 6px;text-align:center;">
        <div style="font-size:10px;color:#64748b;margin-bottom:4px;">👁 오늘</div>
        <div style="font-size:20px;font-weight:800;color:#06b6d4;">${repo.todayViews || 0}</div>
      </div>
      <div style="flex:1;background:rgba(168,85,247,0.06);border:1px solid rgba(168,85,247,0.16);border-radius:8px;padding:10px 6px;text-align:center;">
        <div style="font-size:10px;color:#64748b;margin-bottom:4px;">⬇ 오늘</div>
        <div style="font-size:20px;font-weight:800;color:#a855f7;">${repo.todayClones || 0}</div>
      </div>
    </div>

    <!-- Footer -->
    <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(255,255,255,0.06);padding-top:11px;">
      <div style="display:flex;flex-direction:column;gap:2px;">
        <span style="font-size:11px;color:#06b6d4;font-family:'Courier New',monospace;font-weight:600;">github.com/${repo.fullName}</span>
        <span style="font-size:9px;color:#475569;">조회 기준: ${dateFormatted}</span>
      </div>
      <span style="font-size:11px;font-weight:700;color:#475569;letter-spacing:1px;">⚡ GitTraffic</span>
    </div>
  `;
  return card;
}

/**
 * Generate a dual-mirror sparkline SVG (views above / clones below the midline)
 * sized for the share card (480px × 84px canvas).
 */
function generateShareCardSparkline(viewsObject, clonesObject) {
  const today = new Date();
  const dates = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }

  const viewVals  = dates.map(d => viewsObject[d]  ? viewsObject[d].count  : 0);
  const cloneVals = dates.map(d => clonesObject[d] ? clonesObject[d].count : 0);

  const maxV = Math.max(...viewVals,  1);
  const maxC = Math.max(...cloneVals, 1);

  const W = 432; const H = 84;
  const n = 14;
  const xStep = W / (n - 1);
  const uid = 'sc' + Math.random().toString(36).substring(2, 8);

  const midY = 42; const topH = 38; const botH = 38;

  const vPts  = viewVals.map((v, i)  => `${(i * xStep).toFixed(1)},${(midY - (v / maxV)  * topH).toFixed(1)}`);
  const cPts  = cloneVals.map((v, i) => `${(i * xStep).toFixed(1)},${(midY + (v / maxC)  * botH).toFixed(1)}`);

  const vPath = `M ${vPts.join(' L ')}`;
  const cPath = `M ${cPts.join(' L ')}`;
  const vArea = `${vPath} L ${W},${midY} L 0,${midY} Z`;
  const cArea = `${cPath} L ${W},${midY} L 0,${midY} Z`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
    <defs>
      <linearGradient id="vg${uid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.38"/>
        <stop offset="100%" stop-color="#06b6d4" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="cg${uid}" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stop-color="#a855f7" stop-opacity="0.38"/>
        <stop offset="100%" stop-color="#a855f7" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <line x1="0" y1="${midY}" x2="${W}" y2="${midY}" stroke="rgba(255,255,255,0.09)" stroke-width="1"/>
    <path d="${vArea}" fill="url(#vg${uid})"/>
    <path d="${vPath}" fill="none" stroke="#06b6d4" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${cArea}" fill="url(#cg${uid})"/>
    <path d="${cPath}" fill="none" stroke="#a855f7" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

/**
 * Main entry point — builds off-screen card, captures with html2canvas,
 * then opens the share modal with the result.
 */
async function captureAndShare(repo) {
  shareCurrentRepo = repo;
  shareImageBlob = null;

  // Ensure activityProfile is populated
  if (!repo.activityProfile) repo.activityProfile = calculateLastActive(repo.views || {});

  // Update GitHub link in modal
  const shareLinkEl = document.getElementById('share-github-link');
  if (shareLinkEl) shareLinkEl.textContent = `https://github.com/${repo.fullName}`;

  // Reset preview to loading state and open modal
  const sharePrevContainer = document.getElementById('share-preview-container');
  if (sharePrevContainer) {
    sharePrevContainer.innerHTML = `
      <div class="share-preview-loading">
        <div class="spinner" style="width:18px;height:18px;"></div>
        <span>공유 카드 생성 중…</span>
      </div>`;
  }
  const shareModal = document.getElementById('share-modal');
  if (shareModal) shareModal.classList.add('open');

  // Remove any stale off-screen card
  const old = document.getElementById('share-card-offscreen');
  if (old) old.remove();

  const card = buildShareCardDom(repo);
  document.body.appendChild(card);

  // Give the browser a tick to paint the card before capture
  await new Promise(r => requestAnimationFrame(() => setTimeout(r, 80)));

  try {
    if (typeof html2canvas === 'undefined') throw new Error('html2canvas not available');

    const canvas = await html2canvas(card, {
      backgroundColor: '#080d1a',
      scale: 2,          // retina quality
      logging: false,
      useCORS: true,
      allowTaint: true,
    });

    canvas.toBlob((blob) => {
      if (!blob) return;
      shareImageBlob = blob;
      const url = URL.createObjectURL(blob);
      if (sharePrevContainer) {
        sharePrevContainer.innerHTML =
          `<img class="share-preview-img" src="${url}" alt="공유 카드 미리보기">`;
      }
      // Show native share if the browser supports file sharing
      const btnNative = document.getElementById('btn-share-native');
      if (btnNative) {
        btnNative.style.display =
          (navigator.share && navigator.canShare) ? 'inline-flex' : 'none';
      }
    }, 'image/png');

  } catch (err) {
    console.error('[GitTraffic] Share card capture failed:', err);
    if (sharePrevContainer) {
      sharePrevContainer.innerHTML =
        `<div style="color:#f43f5e;font-size:0.82rem;padding:2rem;text-align:center;"
          >이미지 생성에 실패했습니다.<br>링크로 공유해 주세요.</div>`;
    }
  } finally {
    card.remove();
  }
}

function closeShareModal() {
  const modal = document.getElementById('share-modal');
  if (modal) modal.classList.remove('open');
  // Revoke any object URL still held in the preview
  const img = document.querySelector('#share-preview-container img');
  if (img && img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
  shareImageBlob = null;
}

async function handleShareDownload() {
  if (!shareImageBlob || !shareCurrentRepo) return;
  const url = URL.createObjectURL(shareImageBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gittraffic-${shareCurrentRepo.name}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function handleShareClipboard() {
  if (!shareImageBlob) return;
  const btn = document.getElementById('btn-share-clipboard');
  try {
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': shareImageBlob })
    ]);
    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = `<i data-lucide="check" style="width:14px;height:14px;"></i> 복사됨!`;
      initIcons();
      setTimeout(() => { btn.innerHTML = orig; initIcons(); }, 2200);
    }
  } catch {
    alert('이 브라우저는 이미지 클립보드 복사를 지원하지 않습니다.\nPNG 다운로드 후 공유해 주세요.');
  }
}

async function handleShareNative() {
  if (!shareImageBlob || !navigator.share || !shareCurrentRepo) return;
  const file = new File(
    [shareImageBlob],
    `gittraffic-${shareCurrentRepo.name}.png`,
    { type: 'image/png' }
  );
  try {
    await navigator.share({
      title: `${shareCurrentRepo.name} GitHub 트래픽`,
      text: `📊 ${shareCurrentRepo.name} 최근 14일 트래픽 현황\ngithub.com/${shareCurrentRepo.fullName}`,
      files: [file],
    });
  } catch (err) {
    if (err.name !== 'AbortError') console.error('[GitTraffic] Share failed:', err);
  }
}

async function handleShareCopyLink() {
  if (!shareCurrentRepo) return;
  const link = `https://github.com/${shareCurrentRepo.fullName}`;
  const btn = document.getElementById('btn-share-copy-link');
  try {
    await navigator.clipboard.writeText(link);
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = '✅ 복사됨!';
      setTimeout(() => { btn.textContent = orig; }, 2200);
    }
  } catch (err) {
    console.error('[GitTraffic] Copy link failed:', err);
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  initOAuthConfig();
  loadConfig();
  initIcons();
});
