# Environment Variables Setup

This document explains how to configure the required environment variables for the Royal Express Fleet Manager application.

## Required Environment Variables

The following environment variables are required for the application to function properly:

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | `https://xyzproject.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anonymous key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |

## Setting Up Environment Variables

### Local Development

1. Create a `.env.local` file in the root directory of the project
2. Add the required variables to this file:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Production Deployment

When deploying to production, add these environment variables to your deployment platform's configuration.

## Verifying Environment Variables

You can verify that you've set up the environment variables correctly by running:

```bash
npm run check-env
```

This script will check if all required environment variables are properly set and provide appropriate feedback.

## Error Handling

The application includes built-in validation for environment variables:

1. **Development Environment**: If variables are missing in development, warning messages will be displayed in the console, but the application will continue to run.

2. **Production Build**: During `npm run build` or deployment, missing environment variables will cause the build to fail with clear error messages.

## Troubleshooting

If you encounter issues related to environment variables:

1. Verify that you've created the `.env.local` file in the root directory of the project
2. Check for typos in your variable names and values
3. Ensure your Supabase project URL and anonymous key are correct
4. For production deployments, confirm that the environment variables are properly configured in your deployment platform

For more information on Supabase configuration, refer to the [Supabase documentation](https://supabase.com/docs). 