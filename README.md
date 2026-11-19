# Whiteboard Backend

A Node.js/Express backend for the whiteboard application, handling user authentication, canvas operations, and data management.

## Features

- User management (registration, login, etc.)
- Canvas drawing and collaboration
- RESTful API endpoints

## Technologies

- Node.js
- Express.js
- MongoDB (or your database)
- JWT for authentication

## Setup

1. Clone the repository and navigate to the `Backend/` folder.
2. Install dependencies: `npm install`
3. Create a `.env` file based on `.env.example` (see below).
4. Start the server: `npm start` (or `node index.js`)

## Environment Variables

Create a `.env` file with the following (example values; customize as needed):

```
PORT=3030
MONGODB_URI=mongodb://localhost:27017/whiteboard
JWT_SECRET=your_jwt_secret_key_here
```

## Running and checking the backend

The server connects to MongoDB before listening on port `3030` (or `PORT`).
`GET /health` returns `200` when connected and `503` when unavailable. API requests
also return `503` during a database outage instead of waiting in Mongoose's queue.
Set `FRONTEND_ORIGIN` if your frontend runs somewhere other than
`http://localhost:5173`.

```sh
npm test
npm run test:integration
```

Unit tests do not use MongoDB. Integration tests use the configured MongoDB
credentials with a randomly named `wbt_...` database and an ephemeral local port.
They remove their own `Users` and `Canvas` collections afterward; they never use
or delete the application's collections. The integration suite uses the existing
Socket.IO client installed in the sibling frontend, so install both projects'
dependencies first.

Requests must contain valid JSON. HTTP and Socket.IO payloads are limited to
2 MB. Canvas elements must use the drawing tool format produced by the frontend.
Sharing is owner-only and goes through `PUT /api/canvases/share/:id`.
