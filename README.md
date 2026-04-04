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
PORT=5000
MONGODB_URI=mongodb://localhost:27017/whiteboard
JWT_SECRET=your_jwt_secret_key_here
```
