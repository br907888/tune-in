# Tune-In Project Overview (Week 7)

An online web platform that allows users to create personalized accounts to review and rate music they have listened to. The platform functions similarly to a social media experience — think Letterboxd, but for music. Users will be able to connect with each other, share music and reviews, and build community.

## Key Features (Week 7)

- **User Accounts** — Create and manage a personalized profile to track your music reviews and listening history.
- **Reviews & Ratings** — Write reviews and assign ratings to music you have listened to.
- **Social Interaction** — Search for other user profiles, follow them, and interact with their reviews.
- **Review Lists** — Organize your reviews into curated lists for easy browsing and sharing.
- **Listening Queue** — Build a queue of songs and albums you have yet to review, so you never lose track of what's next.

## Additional Features (Week7/8)

- **Dark Mode** — Users are able to toggle between dark and light mode, augmenting the visual style to their preference.
- **Additional Profile Customization** — Edit information inside the user's profile, like display name.

## What I Learned (Week 8)

---

## Technologies Used

**Frontend**
- HTML5, CSS3, Vanilla JavaScript (ES Modules)
- Google Fonts — Inter

**Backend / Infrastructure**
- Firebase Authentication — email/password sign-up and login
- Cloud Firestore — NoSQL document database for all app data
- Firebase Hosting (optional static deployment)

---

## Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/br907888/tune-in.git
   cd tune-in
   ```

2. **Configure Firebase**
   - Create a project at [firebase.google.com](https://firebase.google.com)
   - Enable **Authentication** (Email/Password provider)
   - Enable **Cloud Firestore** (start in test mode or apply the included `firestore.rules`)
   - Copy your Firebase config object into `js/firebase-config.js`

3. **Serve the app locally**
   ```bash
   npx serve .
   ```
   Open `http://localhost:3000` in your browser.

> **Note:** The app must be served over HTTP — opening HTML files directly via `file://` will block Firebase module imports.

---

## Architecture Overview

### Frontend
The app is a multi-page static web application. Each page is a standalone `.html` file that loads its own JavaScript module. There is no build step or bundler — all JS is written as native ES modules imported directly in the browser.

Shared concerns are handled by two lightweight modules loaded on every page:
- `js/theme.js` — light/dark mode toggle with `localStorage` persistence
- `js/nav.js` — mobile hamburger menu toggle

Page-specific logic lives in individual modules (`feed.js`, `reviews.js`, `profile.js`, etc.) that each manage their own Firestore queries and DOM rendering.

### Backend
There is no custom server. Firebase provides both authentication and the database. All data reads and writes happen directly from the browser via the Firebase JS SDK. Access control is enforced through Firestore Security Rules (`firestore.rules`), which restrict users to only reading and writing their own data.

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

## Known Bugs / Limitations

- **No real-time updates** — Feed, follows, and review counts reflect data at page load only. Changes made by other users require a page refresh to appear.
- **Firestore `in` query limit** — The feed chunks following IDs into groups of 10 to work within Firestore's limit. Users following more than 100 people may see incomplete feeds.
- **No pagination** — All reviews, queue items, and list entries are fetched in a single query. Large datasets may result in slower load times.
- **No image support** — User profiles and reviews do not support album art or avatars.
- **Search is name-only** — User search matches on display name only; there is no way to search by email or partial username across all fields.
