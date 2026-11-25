const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const api = require('./lib/index.js');

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>free-llm-models</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 960px; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; color: #111; }
    header { border-bottom: 1px solid #ddd; padding-bottom: 1rem; margin-bottom: 1.5rem; }
    h1 { margin: 0 0 0.25rem; font-size: 1.5rem; }
    .meta { color: #555; font-size: 0.9rem; }
    .controls { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; }
    input, select, button { font: inherit; padding: 0.4rem 0.65rem; border: 1px solid #ccc; border-radius: 4px; background: #fff; }
    button { cursor: pointer; background: #f5f5f5; }
    button:hover { background: #eaeaea; }
    table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; font-size: 0.92rem; }
    th, td { text-align: left; padding: 0.45rem 0.6rem; border-bottom: 1px solid #eee; }
    th { background: #fafafa; font-weight: 600; }
    .panel { border: 1px solid #e5e5e5; border-radius: 4px; padding: 1rem; margin-bottom: 1rem; background: #fafafa; }
    .hidden { display: none; }
    code { background: #f0f0f0; padding: 0.1rem 0.3rem; border-radius: 3px; font-size: 0.88em; }
  </style>
</head>
<body>
  <header>
    <h1>free-llm-models</h1>
    <div class="meta" id="meta-info">Loading dataset...</div>
  </header>

  <div class="controls">
    <input id="search-input" type="search" placeholder="Search models or providers..." />
    <select id="provider-select">
      <option value="">All providers</option>
    </select>
    <select id="limit-select">
      <option value="20">Limit: 20</option>
      <option value="50">Limit: 50</option>
      <option value="100">Limit: 100</option>
      <option value="1000">All</option>
    </select>
    <button id="random-btn" type="button">Random Model</button>
    <button id="providers-btn" type="button">Providers</button>
  </div>

  <div id="detail-panel" class="panel hidden"></div>
  <div id="table-container"></div>

  <script>
    const metaEl = document.getElementById('meta-info');
    const searchEl = document.getElementById('search-input');
    const providerEl = document.getElementById('provider-select');
    const limitEl = document.getElementById('limit-select');
    const randomBtn = document.getElementById('random-btn');
    const providersBtn = document.getElementById('providers-btn');
    const detailEl = document.getElementById('detail-panel');
    const tableEl = document.getElementById('table-container');

    function clearEl(el) {
      while (el.firstChild) el.removeChild(el.firstChild);
    }

    function showDetail(model) {
      clearEl(detailEl);
      detailEl.classList.remove('hidden');
      const title = document.createElement('strong');
      title.textContent = model.name + ' (' + model.id + ')';
      const info = document.createElement('div');
      info.textContent =
        'Provider: ' + model.provider +
        ' | Tools: ' + (model.supportsTools ? 'yes' : 'no') +
        ' | JSON: ' + (model.supportsJson ? 'yes' : 'no') +
        ' | Released: ' + (model.released || 'unknown');
      detailEl.appendChild(title);
      detailEl.appendChild(info);
    }

    function renderModels(models, total) {
      clearEl(tableEl);
      if (!models.length) {
        const p = document.createElement('p');
        p.textContent = 'No models found.';
        tableEl.appendChild(p);
        return;
      }
      const table = document.createElement('table');
      const thead = document.createElement('thead');
      const headRow = document.createElement('tr');
      ['Model', 'ID', 'Provider', 'Tools', 'JSON', 'Released'].forEach((h) => {
        const th = document.createElement('th');
        th.textContent = h;
        headRow.appendChild(th);
      });
      thead.appendChild(headRow);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      models.forEach((m) => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', () => showDetail(m));
        [
          m.name,
          m.id,
          m.provider,
          m.supportsTools ? 'yes' : '-',
          m.supportsJson ? 'yes' : '-',
          m.released ? m.released.slice(0, 10) : '-'
        ].forEach((val) => {
          const td = document.createElement('td');
          td.textContent = val;
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      tableEl.appendChild(table);

      const summary = document.createElement('p');
      summary.className = 'meta';
      summary.textContent = 'Showing ' + models.length + ' of ' + total + ' matching models.';
      tableEl.appendChild(summary);
    }

    function renderProviders(providers) {
      clearEl(tableEl);
      detailEl.classList.add('hidden');
      const table = document.createElement('table');
      const thead = document.createElement('thead');
      const headRow = document.createElement('tr');
      ['Provider', 'Models'].forEach((h) => {
        const th = document.createElement('th');
        th.textContent = h;
        headRow.appendChild(th);
      });
      thead.appendChild(headRow);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      providers.forEach((p) => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', () => {
          providerEl.value = p.name;
          searchEl.value = '';
          loadModels();
        });
        [p.name, String(p.count)].forEach((val) => {
          const td = document.createElement('td');
          td.textContent = val;
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      tableEl.appendChild(table);
    }

    async function loadModels() {
      const params = new URLSearchParams();
      if (searchEl.value.trim()) params.set('q', searchEl.value.trim());
      if (providerEl.value) params.set('provider', providerEl.value);
      params.set('limit', limitEl.value);
      const res = await fetch('/api/models?' + params.toString());
      const data = await res.json();
      renderModels(data.models, data.total);
    }

    async function init() {
      const [metaRes, provRes] = await Promise.all([
        fetch('/api/meta'),
        fetch('/api/providers')
      ]);
      const meta = await metaRes.json();
      const providers = await provRes.json();

      metaEl.textContent = meta.count + ' models across ' + providers.length + ' providers (updated ' + meta.updated + ')';
      providers.forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p.name;
        opt.textContent = p.name + ' (' + p.count + ')';
        providerEl.appendChild(opt);
      });

      await loadModels();
    }

    searchEl.addEventListener('input', loadModels);
    providerEl.addEventListener('change', loadModels);
    limitEl.addEventListener('change', loadModels);
    randomBtn.addEventListener('click', async () => {
      const res = await fetch('/api/random');
      const model = await res.json();
      showDetail(model);
    });
    providersBtn.addEventListener('click', async () => {
      const res = await fetch('/api/providers');
      const providers = await res.json();
      renderProviders(providers);
    });

    init();
  </script>
</body>
</html>
`;

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  if (pathname === '/' || pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(HTML);
  }

  if (pathname === '/health') {
    return sendJson(res, 200, { status: 'ok' });
  }

  if (pathname === '/api/meta') {
    return sendJson(res, 200, api.meta());
  }

  if (pathname === '/api/providers') {
    return sendJson(res, 200, api.providers());
  }

  if (pathname === '/api/random') {
    return sendJson(res, 200, api.random());
  }

  if (pathname === '/api/models') {
    const q = (url.searchParams.get('q') || '').trim();
    const provider = (url.searchParams.get('provider') || '').trim();
    const limitParam = parseInt(url.searchParams.get('limit') || '20', 10);
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 20;

    let models = q ? api.search(q) : api.all();
    if (provider) {
      const p = provider.toLowerCase();
      models = models.filter((m) => m.provider.toLowerCase() === p);
    }

    return sendJson(res, 200, {
      total: models.length,
      models: models.slice(0, limit),
    });
  }

  if (pathname.startsWith('/api/models/')) {
    const id = decodeURIComponent(pathname.slice('/api/models/'.length));
    const model = api.get(id);
    if (!model) {
      return sendJson(res, 404, { error: 'Model not found' });
    }
    return sendJson(res, 200, model);
  }

  if (pathname === '/api/compare') {
    const a = url.searchParams.get('a');
    const b = url.searchParams.get('b');
    if (!a || !b) {
      return sendJson(res, 400, { error: 'Query parameters "a" and "b" are required' });
    }
    const ma = api.get(a);
    const mb = api.get(b);
    if (!ma || !mb) {
      return sendJson(res, 404, { error: 'One or both models not found' });
    }
    return sendJson(res, 200, [ma, mb]);
  }

  if (pathname === '/og-image.jpg') {
    const imgPath = path.join(__dirname, 'og-image.jpg');
    if (fs.existsSync(imgPath)) {
      res.writeHead(200, { 'Content-Type': 'image/jpeg' });
      return fs.createReadStream(imgPath).pipe(res);
    }
  }

  return sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, HOST, () => {
  console.log(`free-llm-models server listening on http://${HOST}:${PORT}`);
});
