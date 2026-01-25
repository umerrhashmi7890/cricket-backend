# Cricket Booking System - Backend API

Backend API for Jeddah Nets Cricket Court Booking System built with Node.js, Express, TypeScript, and MongoDB.

## Prerequisites

- Node.js (v18 or higher)
- MongoDB (local or Atlas)
- npm or yarn

## Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
   - Copy `.env` and update with your settings
   - Update `MONGODB_URI` with your MongoDB connection string

3. Start development server:
```bash
npm run dev
```

The server will start on `http://localhost:5000`

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server

## API Endpoints

### Test Endpoints
- `GET /` - API information
- `GET /api/health` - Health check
- `GET /api/test` - Test endpoint

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** MongoDB with Mongoose
- **Validation:** Zod
- **Authentication:** JWT
