# AI Tutor Screener

An OpenRouter-powered tutor interview app for Cuemath screening.

## Backend

1. Open `backend`.
2. Run `npm install`.
3. Copy `backend/.env.example` to `backend/.env` and fill in your local secrets.
4. Start with `npm run dev`.
5. The backend runs on `http://localhost:3000`.

## Frontend

1. Open `frontend`.
2. Run `npm install`.
3. Start with `npm run dev`.

The frontend proxies `/api` requests to `http://localhost:3000`.

## Security

- Never commit `backend/.env` or any real secrets.
- Keep API keys, database credentials, and JWT secrets only in local environment files or deployment secrets.
- Rotate any key that has been pasted into chat, screenshots, commits, or public files.
