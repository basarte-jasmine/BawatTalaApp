# Bawat Tala Mobile Web Deployment

This Expo Router app can be deployed to Vercel as a static website.

## Local web build

```bash
npm install
npm run build:web
```

The generated website will be written to `dist/`.

## Vercel setup

Create a new Vercel project and use these settings:

- Framework Preset: `Other`
- Root Directory: `mobile-app`
- Build Command: `npm run build:web`
- Output Directory: `dist`
- Install Command: `npm install`

## Environment variable

Add this environment variable in the Vercel project settings before deploying:

```env
EXPO_PUBLIC_API_BASE_URL=https://your-backend-url.onrender.com
```

For this repository, the current live backend URL is:

```env
EXPO_PUBLIC_API_BASE_URL=https://bawattalaapp.onrender.com
```

## Backend CORS

Your backend must allow requests from the deployed Vercel domain. Set `CORS_ORIGIN` in the backend service to your Vercel URL, for example:

```env
CORS_ORIGIN=https://your-project.vercel.app
```

If you use both the preview and production domains, you can provide both:

```env
CORS_ORIGIN=https://your-project.vercel.app,https://your-custom-domain.com
```

## Deploy with Vercel dashboard

1. Push this repository to GitHub.
2. In Vercel, click `Add New -> Project`.
3. Import the repository.
4. Set the root directory to `mobile-app`.
5. Add `EXPO_PUBLIC_API_BASE_URL` in Environment Variables.
6. Deploy.

## Deploy with Vercel CLI

From the repository root:

```bash
cd mobile-app
vercel
```

For production deployment:

```bash
vercel --prod
```
