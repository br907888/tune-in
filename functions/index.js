const { setGlobalOptions } = require("firebase-functions");
const { onRequest } = require("firebase-functions/https");
const logger = require("firebase-functions/logger");
const axios = require("axios");

setGlobalOptions({ maxInstances: 10 });

// ---------------------------------------------------------------------------
// CORS helper — only allow requests from your own domain (and localhost dev)
// ---------------------------------------------------------------------------
function setCors(req, res) {
  const allowed = [
    "http://localhost:5000",
    "http://127.0.0.1:5000",
    "https://tune-in-d636f.web.app",
    "https://tune-in-d636f.firebaseapp.com"
  ];
  const origin = req.headers.origin;
  if (allowed.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
  }
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
}

// ---------------------------------------------------------------------------
// Simple in-memory cache  { key -> { data, expiresAt } }
// ---------------------------------------------------------------------------
const cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null; }
  return entry.data;
}

function setCached(key, data) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ---------------------------------------------------------------------------
// TMDb proxy
// POST /tmdbSearch  { "query": "Bohemian Rhapsody" }
// ---------------------------------------------------------------------------
exports.tmdbSearch = onRequest({ invoker: "public" }, async (req, res) => {
  setCors(req, res);

  // Handle preflight
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }
  if (req.method !== "POST")    { res.status(405).json({ error: "Method not allowed" }); return; }

  const query = (req.body?.query || "").trim();
  if (!query) {
    res.status(400).json({ error: "Missing query parameter" });
    return;
  }

  // Sanitize — strip anything that isn't a normal search string
  const safeQuery = query.replace(/[<>"'`;]/g, "").slice(0, 100);
  if (!safeQuery) {
    res.status(400).json({ error: "Invalid query parameter" });
    return;
  }

  // Check cache first
  const cacheKey = `tmdb:${safeQuery.toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) {
    logger.info("TMDb cache hit", { query: safeQuery });
    res.json({ results: cached, fromCache: true });
    return;
  }

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    logger.error("TMDB_API_KEY not set");
    res.status(500).json({ error: "Server configuration error" });
    return;
  }

  try {
    const response = await axios.get("https://api.themoviedb.org/3/search/movie", {
      params: {
        api_key: apiKey,
        query: safeQuery,
        include_adult: false,
        language: "en-US",
        page: 1
      },
      timeout: 8000
    });

    // Return only the fields the frontend needs
    const results = (response.data.results || []).slice(0, 6).map(m => ({
      id: m.id,
      title: m.title,
      year: m.release_date ? m.release_date.slice(0, 4) : null,
      overview: m.overview,
      poster: m.poster_path
        ? `https://image.tmdb.org/t/p/w200${m.poster_path}`
        : null,
      tmdbUrl: `https://www.themoviedb.org/movie/${m.id}`
    }));

    setCached(cacheKey, results);
    res.json({ results });

  } catch (err) {
    if (err.response) {
      const status = err.response.status;
      if (status === 401) {
        logger.error("TMDb 401 — invalid API key");
        res.status(502).json({ error: "Movie database authentication failed" });
      } else if (status === 429) {
        logger.warn("TMDb 429 — rate limited");
        res.status(429).json({ error: "Too many requests — please wait a moment and try again" });
      } else {
        logger.error("TMDb error", { status });
        res.status(502).json({ error: "Movie database returned an error" });
      }
    } else if (err.code === "ECONNABORTED") {
      res.status(504).json({ error: "Movie database request timed out" });
    } else {
      logger.error("TMDb unexpected error", err);
      res.status(500).json({ error: "Unexpected server error" });
    }
  }
});

// ---------------------------------------------------------------------------
// Groq proxy
// POST /inspire  { "type": "song" | "album" }
// ---------------------------------------------------------------------------
exports.inspire = onRequest({ invoker: "public" }, async (req, res) => {
  setCors(req, res);

  if (req.method === "OPTIONS") { res.status(204).send(""); return; }
  if (req.method !== "POST")    { res.status(405).json({ error: "Method not allowed" }); return; }

  const type = req.body?.type === "album" ? "album" : "song";
  const avoid = Array.isArray(req.body?.avoid)
    ? req.body.avoid.slice(0, 10).map(s => String(s).slice(0, 100))
    : [];

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    logger.error("GROQ_API_KEY not set");
    res.status(500).json({ error: "Server configuration error" });
    return;
  }

  const avoidClause = avoid.length > 0
    ? `\nDo NOT suggest any of these — they were already recommended: ${avoid.join(", ")}.`
    : "";

  const prompt = `You are a music recommendation assistant for a music review app called Tune-In.
Suggest one ${type} that a music fan would genuinely enjoy discovering and reviewing.
Be diverse — span different genres, eras, and levels of popularity across suggestions.
Pick something interesting — it could be classic, recent, obscure, or widely loved.${avoidClause}
Respond with ONLY valid JSON in this exact shape, no markdown, no extra text:
{"title":"<${type} title>","artist":"<artist name>","reason":"<one sentence explaining why it's worth listening to>"}`;

  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 1.0,
        max_tokens: 200
      },
      {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        timeout: 15000
      }
    );

    const text = response.data.choices[0].message.content.trim();

    // Parse and validate the JSON the model returns
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Model sometimes wraps JSON in a code block — strip it
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Model returned non-JSON response");
      parsed = JSON.parse(match[0]);
    }

    if (!parsed.title || !parsed.artist || !parsed.reason) {
      throw new Error("Model response missing required fields");
    }

    res.json({
      type,
      title: String(parsed.title).slice(0, 200),
      artist: String(parsed.artist).slice(0, 200),
      reason: String(parsed.reason).slice(0, 500)
    });

  } catch (err) {
    if (err.response?.status === 429) {
      logger.warn("Groq rate limited");
      res.status(429).json({ error: "AI service is busy — please try again in a moment" });
    } else if (err.response?.status === 401) {
      logger.error("Groq invalid API key");
      res.status(502).json({ error: "AI service authentication failed" });
    } else if (err.code === "ECONNABORTED") {
      res.status(504).json({ error: "AI service request timed out" });
    } else {
      logger.error("Groq unexpected error", err);
      res.status(500).json({ error: "Couldn't generate a recommendation right now" });
    }
  }
});
