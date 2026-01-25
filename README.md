# CONFIRMED 2.0 Backend API

Backend service for the CONFIRMED 2.0 mobile payment tracking application.

## Features

- 🔐 User authentication (signup/login with OTP)
- 💰 Transaction syncing and management
- 📊 Sales analytics and reporting
- 🛒 Purchase tracking
- 💳 Debt management
- ☁️ Cloud backup with Supabase

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL)
- **Authentication**: JWT + OTP
- **Deployment**: Render

## Getting Started

### Prerequisites

- Node.js 16+ installed
- Supabase account and project
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd Backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add your configuration:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_KEY`: Your Supabase anon/public key
- `JWT_SECRET`: A secure random string for JWT signing
- `PORT`: Server port (default: 5000)

4. Run the development server:
```bash
npm run dev
```

The server will start at `http://localhost:5000`

## API Endpoints

### Health Check
- `GET /` - API information
- `GET /health` - Health check endpoint

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/verify` - Verify JWT token
- `GET /api/auth/profile` - Get user profile

### Sync
- `POST /api/sync` - Sync transactions to cloud
- `GET /api/transactions` - Get user transactions
- `GET /api/transactions/stats` - Get transaction statistics

### Purchases
- `POST /api/purchases` - Create purchase
- `GET /api/purchases` - Get user purchases
- `PUT /api/purchases/:id` - Update purchase
- `DELETE /api/purchases/:id` - Delete purchase

### Debts
- `POST /api/debts` - Create debt record
- `GET /api/debts` - Get user debts
- `PUT /api/debts/:id` - Update debt
- `DELETE /api/debts/:id` - Delete debt

## Deployment to Render

### Step 1: Prepare Your Repository

1. Push your code to GitHub:
```bash
git add .
git commit -m "Prepare backend for deployment"
git push origin main
```

### Step 2: Deploy on Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `confirmed-backend` (or your preferred name)
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (or paid for better performance)

5. Add environment variables in Render:
   - `NODE_ENV` = `production`
   - `PORT` = `5000`
   - `SUPABASE_URL` = Your Supabase URL
   - `SUPABASE_KEY` = Your Supabase anon key
   - `JWT_SECRET` = Your secure JWT secret

6. Click "Create Web Service"

### Step 3: Set Up Keep-Alive (Optional)

To prevent the free tier from sleeping:

1. In your GitHub repository, go to Settings → Secrets and variables → Actions
2. Add a new secret:
   - Name: `RENDER_URL`
   - Value: Your Render service URL (e.g., `https://confirmed-backend.onrender.com`)

3. The GitHub Action will automatically ping your service every 12 minutes with randomized timing

## Database Setup

Run the `schema.sql` file in your Supabase SQL editor to create the necessary tables:

```sql
-- See schema.sql for the complete database schema
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port | No (default: 5000) |
| `NODE_ENV` | Environment (development/production) | No |
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_KEY` | Supabase anon key | Yes |
| `JWT_SECRET` | Secret for JWT signing | Yes |
| `MPESA_CONSUMER_KEY` | M-Pesa API consumer key | No |
| `MPESA_CONSUMER_SECRET` | M-Pesa API consumer secret | No |

## Development

```bash
# Run in development mode with auto-reload
npm run dev

# Run in production mode
npm start

# Run tests
npm test
```

## Project Structure

```
Backend/
├── config/          # Configuration files
│   └── supabase.js  # Supabase client setup
├── controllers/     # Request handlers
├── middleware/      # Express middleware
├── routes/          # API routes
├── services/        # Business logic
├── index.js         # Entry point
├── package.json     # Dependencies
└── schema.sql       # Database schema
```

## Troubleshooting

### Connection Issues
- Verify your Supabase credentials are correct
- Check that your Supabase project is active
- Test the connection: `GET /api/test-connection`

### Authentication Errors
- Ensure JWT_SECRET is set and consistent
- Check that the user exists in the database
- Verify the token hasn't expired

### Deployment Issues
- Check Render logs for errors
- Verify all environment variables are set
- Ensure the build completed successfully

## Support

For issues or questions, please open an issue on GitHub.

## License

ISC
