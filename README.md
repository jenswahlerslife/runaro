# Runaro - Running Game Application

A gamified running application with Strava integration, built with modern web technologies.

## 🏃‍♂️ Features

- **Strava Integration**: Connect your Strava account to import running activities
- **Gamification**: Earn points for your running activities
- **Activity Transfer**: Select and transfer specific activities to the game
- **User Authentication**: Secure user management with Supabase
- **Responsive Design**: Works on desktop and mobile devices

## 🚀 Live Application

- **Production**: https://runaro.dk
- **Debug Interface**: https://runaro.dk/debug/strava

## 🛠 Technologies Used

- **Frontend**: Vite + React + TypeScript
- **UI**: shadcn-ui + Tailwind CSS  
- **Backend**: Supabase (Database + Edge Functions)
- **Deployment**: Cloudflare Pages
- **Integration**: Strava OAuth API

## 🏗 Getting Started

```bash
# Clone the repository
git clone https://github.com/jenswahlerslife/runaro.git

# Navigate to project directory
cd runaro

# Install dependencies
npm install

# Start development server
npm run dev
```

## 📁 Project Structure

```
├── src/                    # React application source
├── supabase/              # Database migrations & edge functions
├── public/                # Static assets
├── DEPLOYMENT_GUIDE.md    # Production deployment guide
└── INTEGRATION_STATUS.md  # Strava integration documentation
```

## 🔧 Development

The application includes comprehensive debugging tools:

- React Debug Interface: `/debug/strava`
- HTML Test Suite: `/test-strava-integration.html`
- Flow Test Page: `/FLOW_FIXED_TEST.html`

## 🚀 Deployment

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for detailed deployment instructions.

Critical: The `public/_redirects` file is essential for Strava OAuth callbacks to work correctly on Cloudflare Pages.

## 📋 Strava Integration

Complete OAuth 2.0 flow with:
- Secure state-based redirects
- Automatic token refresh
- Activity filtering (running only)
- Point calculation system
- Database persistence

## 🔒 Security & Performance Hardening

The database has been hardened with comprehensive security and performance optimizations:

### Security Measures
- **RLS (Row Level Security)** enabled on all application tables
- **Function Security**: All stored procedures use `SECURITY DEFINER` with locked `search_path`
- **PostGIS Security**: System tables secured from unauthorized access
- **Privilege Management**: Minimal privileges granted to `anon`/`authenticated` roles
- **Secure Policies**: Fine-grained access control policies for data protection

### Performance Optimizations
- **Strategic Indexing**: Foreign key, status, and composite indexes for common queries
- **Partial Indexes**: Optimized indexes for filtered queries (pending requests, admin roles)
- **Query Optimization**: Updated table statistics and index hints
- **Text Search**: Case-insensitive search indexes for league discovery

### How to Add New Functions Securely
When creating new stored procedures:

```sql
CREATE OR REPLACE FUNCTION public.your_function(param uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER  -- Important!
SET search_path = public, pg_temp  -- Lock search_path
AS $$
BEGIN
  -- Your logic here
END;
$$;

-- Set proper ownership and privileges
ALTER FUNCTION public.your_function(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.your_function(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.your_function(uuid) TO authenticated;
```

### Verification
Run the verification script to check security status:
```bash
# Check current security status
npm run db:status
```

See `supabase/verification/after_hardening.sql` for detailed verification queries.

## 🤝 Contributing

This project was built with assistance from Claude Code for rapid development and debugging.

---
**Built with ❤️ for the running community**
