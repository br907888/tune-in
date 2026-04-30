# Tune-In

An online music review platform — think Letterboxd, but for music. Users create personalized accounts to review and rate songs and albums, follow other listeners, and build community around shared taste.

## Table of Contents

- [Features](#features)
- [Technologies Used](#technologies-used)
- [Architecture Overview](#architecture-overview)
- [Database Structure](#database-structure)
- [API Features (Week 12)](#api-features-week-12)
- [Setup Instructions](#setup-instructions)
- [Known Bugs & Limitations](#known-bugs--limitations-week-8)
- [What I Learned](#what-i-learned-week-8)

---

## Features

### Core Features (Week 7)

- **User Accounts** — Create and manage a personalized profile to track your music reviews and listening history.
- **Reviews & Ratings** — Write reviews and assign ratings to music you have listened to.
- **Social Interaction** — Search for other user profiles, follow them, and view their reviews.
- **Review Lists** — Organize your reviews into curated lists for easy browsing and sharing.
- **Listening Queue** — Build a queue of songs and albums you have yet to review, so you never lose track of what's next.

### Additional Features (Week 7/8)

- **Dark Mode** — Users are able to toggle between dark and light mode, augmenting the visual style to their preference.
- **Additional Profile Customization** — Users are able to edit information inside the user's profile, like display name.
- **User Review Search** — Users are able to search for their own reviews by name within the "My Reviews" page.

### API Integrations (Week 12)

- **Find in Movies** — Search for biopics, concert films, and documentaries related to an artist while writing a review. Powered by the TMDb API.
- **Inspire Me** — An AI widget on the home page that suggests a song or album to review next and pre-fills the review form with the result. Powered by the Groq API.

> Full implementation details, security notes, and local setup steps are in the [API Features](#api-features-week-12) section below.

### Profile Photos (Week 15)

- **Profile Photo / Avatar** — Users can upload a profile photo directly from their profile page. Photos are stored in Firebase Storage and surface across the entire app: on the user's own profile, on public profiles, in the following feed alongside each review, in search results, and in the followers/following lists. Users without a photo automatically receive an initials-based placeholder that adapts to both light and dark mode.
- **Improved UI and White Flash Bug Fix** — Added visual clarity and contrast to the different sections of the site. These chnages include glowing gradients on hover and more defined edges that aid in visibility. A previous bug in which switching between pages would cause the diplay to flash whitebefore loading content was fixed.

---

## Technologies Used

**Frontend**
- HTML5, CSS3, Vanilla JavaScript (ES Modules)

**Backend / Infrastructure**
- Firebase Authentication — email/password sign-up and login
- Cloud Firestore — database for all app data
- Firebase Storage — stores user profile photo uploads
- Firebase Cloud Functions — server-side proxy for TMDb and Groq API calls

---

## Architecture Overview

### Frontend

The app is a multi-page static web application. Each page functions as its own standalone HTML file that coincides with an individual JavaScript module. All JS is imported directly into the browser, so no bundling is required.

Shared modules loaded on each page include:
- `js/theme.js` — light/dark mode toggle with localStorage persistence
- `js/nav.js` — mobile hamburger menu toggle

Page-specific logic lives in individual modules (`feed.js`, `reviews.js`, `profile.js`, etc.) that each manage their own Firestore queries and DOM rendering.

### Backend

There is no custom server. Firebase provides both authentication and the database. All data reads and writes happen directly from the browser via the Firebase JS SDK. Control and security is managed through Firestore Security Rules, which restrict users to only reading and writing their own data, as opposed to accessing the information of another user.

---

## Database Structure

All collections live in Cloud Firestore.

### `users`
| Field | Type | Description |
|---|---|---|
| `uid` | string | Firebase Auth UID |
| `displayName` | string | Public display name |
| `displayNameLower` | string | Lowercase copy used for search |
| `email` | string | Account email |
| `createdAt` | timestamp | Account creation time |
| `photoURL` | string | Firebase Storage URL of the user's profile photo (optional) |

### `reviews`
| Field | Type | Description |
|---|---|---|
| `userId` | string | Author UID |
| `title` | string | Song or album title |
| `artist` | string | Artist name |
| `type` | string | `"song"` or `"album"` |
| `rating` | number | 1–5 star rating |
| `reviewText` | string | Optional written review |
| `createdAt` | timestamp | Submission time |

### `follows`
Document ID format: `{followerId}_{followingId}`

| Field | Type | Description |
|---|---|---|
| `followerId` | string | UID of the user following |
| `followingId` | string | UID of the user being followed |
| `createdAt` | timestamp | Follow time |

### `lists`
| Field | Type | Description |
|---|---|---|
| `userId` | string | Owner UID |
| `name` | string | List name |
| `description` | string | Optional description |
| `createdAt` | timestamp | Creation time |

### `listItems`
Document ID format: `{listId}_{reviewId}`

| Field | Type | Description |
|---|---|---|
| `listId` | string | Parent list ID |
| `reviewId` | string | Referenced review ID |
| `userId` | string | Owner UID |
| `title`, `artist`, `type`, `rating`, `reviewText` | various | Denormalized review data |
| `addedAt` | timestamp | Time added to list |

### `queue`
| Field | Type | Description |
|---|---|---|
| `userId` | string | Owner UID |
| `title` | string | Song or album title |
| `artist` | string | Artist name |
| `type` | string | `"song"` or `"album"` |
| `addedAt` | timestamp | Time added to queue |

---

## API Features (Week 12)

### Feature 1: Find in Movies (TMDb Integration)

On the **Write a Review** page, a "Find in Movies" panel appears below the review form. After entering an artist name, clicking **Find Movies** searches for biopics, documentaries, and concert films related to that artist. Results display as cards showing the movie poster, title, release year, and a brief overview — each card links directly to the film's page on TMDb.

**API Used:** [The Movie Database (TMDb) API v3](https://developer.themoviedb.org/docs) — specifically the `/search/movie` endpoint.

### Feature 2: Inspire Me (Groq LLM Integration)

On the **Home** page, an "Inspire Me" widget lets users ask an AI to suggest a song or album to review next. Users can toggle between Song and Album mode before clicking **Inspire Me**. The AI returns a title, artist, and a one-sentence reason why it's worth listening to. A **Review this →** button pre-fills the review form with the suggestion so users can jump straight into writing.

The widget tracks recent suggestions within the session and passes them to the AI to avoid repeating recommendations.

**API Used:** [Groq API](https://console.groq.com/docs/openai) with the `llama-3.3-70b-versatile` model via an OpenAI-compatible chat completions endpoint.

### How It Works (Security)

Both API keys are stored exclusively in Firebase Cloud Functions environment variables (`functions/.env`) and never exposed to the browser. All requests from the frontend go to proxy Cloud Functions deployed at `us-central1-tune-in-d636f.cloudfunctions.net`, which handle the actual API calls server-side. CORS is restricted to the app's own Firebase Hosting domain.

### How to Run the API Features Locally

1. **Install the Firebase CLI** if you haven't already:
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

2. **Add your API keys** to `functions/.env`:
   ```
   TMDB_API_KEY=your_tmdb_key_here
   GROQ_API_KEY=your_groq_key_here
   ```

3. **Install function dependencies:**
   ```bash
   cd functions
   npm install
   ```

4. **Start the emulator:**
   ```bash
   firebase emulators:start --only functions,hosting
   ```
   Open `http://127.0.0.1:5000` in your browser. Both features will call the locally running Cloud Functions.

> **Note:** TMDb API keys are free at [themoviedb.org](https://www.themoviedb.org/settings/api). Groq API keys are free at [console.groq.com](https://console.groq.com).

---

## Setup Instructions

> These instructions cover running the app locally without GitHub Pages. The API features (TMDb, Groq) require additional steps — see [API Features (Week 12)](#api-features-week-12) above.

1. **Clone the repository**
   ```bash
   git clone https://github.com/br907888/tune-in.git
   cd tune-in
   ```

2. **Configure Firebase**
   - Create a project at [firebase.google.com](https://firebase.google.com)
   - Enable **Authentication** (Email/Password provider)
   - Enable **Cloud Firestore** (start in test mode or apply the included `firestore.rules`)
   - Enable **Firebase Storage** and apply the following security rule:
     ```
     rules_version = '2';
     service firebase.storage {
       match /b/{bucket}/o {
         match /avatars/{userId} {
           allow read: if request.auth != null;
           allow write: if request.auth != null && request.auth.uid == userId;
         }
       }
     }
     ```
   - Copy your Firebase config object into `js/firebase-config.js`

3. **Serve the app locally**
   ```bash
   npx serve .
   ```
   Open `http://localhost:3000` in your browser.

> **Note:** The app must be served over HTTP — opening HTML files directly via `file://` will block Firebase module imports.

---

## Known Bugs & Limitations (Week 8)

- **No real-time updates** — Feed, follows, and review counts reflect data at page load only. Changes made by other users require a page refresh to appear.
- **Single page rendering** — Queries and data retrieved are rendered on a single page, which might lead to long load times or strain if a user has over 100 followers or an extensive amount of reviews.
- **No image support** — User reviews and profiles currently do not support image uploads/display or customized avatars. *(Resolved in Week 15 — see [Profile Photos](#profile-photos-week-15) above.)*
- **Search is name-only** — User search matches on display name only. There is no way to search by email or username.

---

## What I Learned (Week 8)

This was my first large scale project utilizing AI to help me plan and generate code, and while this experience definitely showcased some of the greater limitations of the technology, I also recognized how powerful AI can be used in terms of debugging massive apps, similar to our discussion in class that argued for AI debugging when dealing with unknown concepts and larger projects. My main difficulty with AI in helping me plan and code my features, especially when it came to cloud-based storage and retrieval, was the fact that as an LLM, Claude Code is really limited to the scope of the Internet. Several steps in the debugging process required me to correct and context that Claude lacked, because the Firebase interface and layout had changed compared to the information that Claude was sourcing from. However, building upon the context of the multiple sessions it took to develop the app, Claude grew to become more responsive and almost agentic in its approach to solving problems. When recognizing that I would ask it to pull a self-review of its code, Claude would initiate it without me asking, and a project of this scope and scale taught me the value of iterative conversation, as over an extended period of time, AI grows accustomed to one's design tendencies and procedures.
