const DEFAULT_QUACKLE_TARGET = 'https://tilesword-quackle.onrender.com';

function getTargetBase() {
  return (process.env.QUACKLE_PROXY_TARGET || DEFAULT_QUACKLE_TARGET).replace(/\/+$/, '');
}

export default async function handler(req, res) {
  const requestUrl = new URL(req.url || '/', 'https://tilesword.local');
  const proxyPath = requestUrl.pathname.replace(/^\/api\/quackle\/?/, '');
  const pathParts = proxyPath.split('/').filter(Boolean);
  const upstream = new URL(`${getTargetBase()}/${pathParts.map(encodeURIComponent).join('/')}`);
  requestUrl.searchParams.forEach((value, key) => upstream.searchParams.append(key, value));

  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    const lower = key.toLowerCase();
    if (['host', 'connection', 'content-length'].includes(lower)) continue;
    if (Array.isArray(value)) headers[key] = value.join(',');
    else if (value !== undefined) headers[key] = value;
  }

  try {
    const upstreamResponse = await fetch(upstream, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method || 'GET') ? undefined : req,
      duplex: 'half',
    });

    res.status(upstreamResponse.status);
    upstreamResponse.headers.forEach((value, key) => {
      if (!['content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    const buffer = Buffer.from(await upstreamResponse.arrayBuffer());
    res.send(buffer);
  } catch (error) {
    res.status(502).json({
      error: 'quackle_proxy_failed',
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
