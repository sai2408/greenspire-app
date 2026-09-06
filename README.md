# 🌿 GreenSpire

**GreenSpire** is a healthy-eating companion app — plan meals, browse recipes, and auto-generate your grocery list, all in one place.

Built with **Expo / React Native** on the frontend and **FastAPI + MongoDB** on the backend, with Google Sign-In for authentication.

---

## ✨ Features

- 🔐 **Google Sign-In** — secure auth with signed session tokens
- 🍳 **Recipe browser** — searchable recipe catalog with details view
- 📅 **Meal planner** — plan meals across the week
- 🛒 **Smart grocery list** — generated automatically from your planned meals
- 🛠️ **Admin panel** — add/edit/manage recipes (restricted to admin emails)
- 📱 **Cross-platform** — one codebase for iOS, Android, and Web (via Expo)

---

## 🧱 Tech Stack

| Layer     | Technology                                                   |
|-----------|---------------------------------------------------------------|
| Frontend  | Expo (React Native), TypeScript, Expo Router                 |
| Backend   | FastAPI (Python), Motor (async MongoDB driver)                |
| Database  | MongoDB                                                        |
| Auth      | Google OAuth + JWT session tokens                              |

---

## 📁 Project Structure

```
Greenspire/
├── backend/
│   ├── server.py            # FastAPI app: auth, profile & planner endpoints
│   ├── requirements.txt     # Python dependencies
│   ├── scripts/             # Data seeding scripts (e.g. recipes)
│   └── tests/               # Pytest API tests
└── frontend/
    ├── app/                 # Expo Router screens (tabs, admin, auth, etc.)
    ├── src/                 # Components, hooks, store, utils, lib
    ├── assets/              # Fonts & images
    └── constants/           # Shared constants
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ and [Yarn](https://yarnpkg.com/)
- [Python](https://www.python.org/) 3.11+
- A [MongoDB](https://www.mongodb.com/atlas/database) database (Atlas free tier works great)
- A [Google Cloud OAuth 2.0 Web Client ID](https://console.cloud.google.com/apis/credentials)
- [Expo Go](https://expo.dev/go) app on your phone, or an iOS/Android simulator, to run the mobile app

### 1. Clone the repo

```bash
git clone <your-repo-url>
cd Greenspire
```

### 2. Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# then edit .env with your MongoDB URL, Google client ID, admin emails, etc.

uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

The API will be live at `http://localhost:8000/api`.

### 3. Frontend setup

```bash
cd frontend
yarn install

cp .env.example .env
# then edit .env with your backend URL and Google client ID

yarn start
```

This opens the Expo dev tools — press `w` for web, `a` for Android, `i` for iOS, or scan the QR code with Expo Go.

> ⚠️ **Note on `EXPO_PUBLIC_BACKEND_URL`:** if you load the app over HTTPS (e.g. via a tunnel), your backend URL must also be HTTPS, or the browser will block it as mixed content. For plain local development, `http://<your-LAN-IP>:8000` works fine.

### 4. Run backend tests (optional)

```bash
cd backend
pytest
```

---

## 🔑 Environment Variables

### `backend/.env`

| Variable            | Description                                              |
|---------------------|------------------------------------------------------------|
| `MONGO_URL`         | MongoDB connection string                                  |
| `DB_NAME`           | Database name                                               |
| `GOOGLE_CLIENT_ID`  | Google OAuth Web Client ID (must match frontend's)          |
| `ADMIN_EMAILS`      | Comma-separated emails granted admin access                 |
| `SESSION_SECRET`    | Random secret used to sign session JWTs                     |
| `SESSION_TTL_DAYS`  | Session token lifetime, in days                              |

### `frontend/.env`

| Variable                       | Description                                  |
|---------------------------------|-----------------------------------------------|
| `EXPO_PUBLIC_BACKEND_URL`       | Base URL of the running backend API           |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID`  | Google OAuth Web Client ID (must match backend's) |

See `.env.example` in each folder for full details.

---

## 🤝 Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request.

## 📄 License

This project is available under the MIT License — feel free to use it as a starting point for your own projects.
