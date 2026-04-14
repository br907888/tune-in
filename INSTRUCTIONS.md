Overview
Add a real feature to a web application using one of the techniques from this week’s readings: an LLM API call, third-party authentication, or an external API integration. You can extend your midterm project, build on your Week 10-11 exercise, or start something new.

The goal is to go from “I’ve read about APIs” to “I’ve called one from my own code and it works.”

Choose Your Feature
Option A: AI-Powered Feature (LLM API)
Add a feature that calls an LLM. You can use Ollama running locally or a cloud API – either counts. Examples: - Text classification (categorize feedback, sort support tickets, tag content) - Caption or description generation (product captions, image alt-text, social posts) - Smart search that understands natural language queries - A chatbot that knows about your app’s specific domain

Ollama is the easiest way to start. No account, no API key, no cost. See the Using LLM APIs reading for setup instructions.

Option B: Authentication
Add user login/logout to an existing app. Examples: - Email/password auth with Firebase or Supabase - Protected routes that redirect to login - User-specific data (each user sees only their own content)

Option C: External API Integration
Connect your app to an external service. Examples: - Weather data, maps, movie database, or news feed - Payment processing (Stripe test mode) - Email notifications (SendGrid)

Requirements
Base Tier (26 points)
Criterion	Points	Description
Feature Works	8	The feature functions correctly (deployed or demonstrated locally via video)
Reflection	10	Written reflection (see below): what you built, what you learned, what surprised you, and what you’d do differently
Documentation	8	README explains what the feature does, which API/service you used, and how to run it
Complete Tier (30 points)
Everything in Base, plus:

Criterion	Points	Description
Advanced Integration	4	Combines 2+ APIs, adds streaming responses, implements caching, or includes a second auth provider

The Integration Pattern
Every API integration follows the same steps:

Sign up for the service and get an API key
Read the docs (or have your AI tool read them – this is where Context7 MCP shines)
Make a test call to verify your key works
Build the integration into your app with error handling
Secure the key so it never reaches the browser
The code is usually straightforward – the hard part is choosing the right service and handling errors gracefully.

What Users Should See
Loading: A spinner or skeleton while the request is in flight
Error: A helpful message (“Couldn’t load weather data – check the city name and try again”), not a blank screen or a raw error dump
Empty result: A clear message (“No results found”) with a suggestion for what to try next
Ask your AI tool: “Add loading, error, and empty states to this component.” It’s one of the things AI handles well – the pattern is well-established and the generated code is usually solid.

Rate Limiting and Caching
Most free API tiers have rate limits. If your app makes too many requests, you’ll get blocked (usually a 429 status code).

Simple fixes:

Cache responses – if the weather for Orlando doesn’t change in 10 minutes, don’t call the API every time the user refreshes
Debounce user input – if the user is typing a search query, wait 300ms after they stop typing before making the API call, instead of calling on every keystroke
Show cached data first – display the last known good data while fetching fresh data in the background
Combining Multiple APIs
The most interesting projects combine services. A few examples:

Recipe app: TMDb for food-related movies + OpenAI for recipe suggestions based on ingredients the user has
Travel planner: Mapbox for maps + OpenWeatherMap for destination weather + an LLM for itinerary suggestions
Portfolio site: Unsplash for hero images + an LLM to generate project descriptions from bullet points
The pattern: each API call is independent. Make them in parallel (with Promise.all) when they don’t depend on each other, or sequentially when one call’s output feeds into the next.

// Parallel -- both calls happen at the same time
const [weather, news] = await Promise.all([
  fetchWeather('Orlando'),
  fetchNews('Orlando')
]);

// Sequential -- second call uses first call's result
const location = await geocode('Orlando');
const weather = await fetchWeather(location.lat, location.lon);