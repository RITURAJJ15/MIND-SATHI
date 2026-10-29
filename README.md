# MIND SATHI

**Khelo. Socho. Saath Badho.**

MIND SATHI is a cognitive wellness and family support application designed to help older adults build healthy daily routines, stay socially connected, and let authorized caregivers support them. It includes a patient experience and a separate caregiver portal, with web and Capacitor-based mobile app support.

> **Demo:** [mind-sathi-eight.vercel.app](https://mind-sathi-eight.vercel.app) · **Repository:** [RITURAJJ15/MIND-SATHI](https://github.com/RITURAJJ15/MIND-SATHI)

## Features

- **Daily cognitive activities:** brain games, personalized daily plans, progress tracking, and reminders.
- **Memory and family support:** memory vault, family calling, and caregiver connections.
- **AI companion:** conversational assistance and plan personalization through server-side Gemini integration.
- **Caregiver portal:** patient oversight and a Care Navigator for finding health resources.
- **Care Navigator:** TinyFish-powered web search for care resources, medicines, public schemes, and health notices.
- **Appointment assistance:** Help Me Book guides caregivers through provider information and appointment workflows, subject to the app's authorization and confirmation rules. Availability depends on provider websites and configured services.
- **Offline support:** local storage and queued changes are designed to remain available offline and synchronize when connectivity returns.
- **Accessibility and language support:** voice features, adjustable text, and multilingual interface support.
- **Mobile packaging:** Android and iOS projects are managed with Capacitor.

Feature availability can depend on account permissions, backend configuration, and third-party service availability.

## Tech stack

- React, TypeScript, and Vite
- Tailwind CSS
- Supabase for authentication and application data
- Dexie and IndexedDB for local offline data
- Vercel serverless functions for backend endpoints
- Gemini, TinyFish, and Bhashini integrations (when configured)
- Capacitor for Android and iOS packaging

## Getting started

### Requirements

- Node.js and npm
- A Supabase project for authentication and data features
- Optional provider credentials for Gemini, TinyFish, and Bhashini features
- Android Studio and a Java/Android toolchain for Android builds

### Install and run locally

```bash
git clone https://github.com/RITURAJJ15/MIND-SATHI.git
cd MIND-SATHI
npm install
```

Create a local environment file from the example:

```bash
cp .env.example .env.local
```

Fill in the values required for the features you want to run. Keep `.env.local` private and never commit service-role keys, provider API keys, admin credentials, or other secrets.

Start the development server:

```bash
npm run dev
```

The patient app is served from `index.html`. The caregiver portal is served from `caregiver.html`.

## Environment variables

The repository's `.env.example` documents the core variables:

| Variable | Purpose | Exposure |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL | Client configuration |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key | Client configuration; protect data with Supabase policies |
| `GEMINI_API_KEY` | Gemini-backed assistant and personalization endpoints | Server-side only |
| `TINYFISH_API_KEY` | Care Navigator web search and booking assistance | Server-side only |

Depending on enabled endpoints, the server may also use `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server-side only), `SUPABASE_ANON_KEY`, `SUPABASE_KEY`, `VITE_SUPABASE_ANON_KEY`, `BHASHINI_INFERENCE_API_KEY`, `BHASHINI_UDYAT_KEY`, `BHASHINI_USER_ID`, `BHASHINI_PIPELINE_ID`, `ADMIN_USER_ID`, `ADMIN_PASSWORD`, and `ADMIN_JWT_SECRET`. Configure only the variables required by your deployment and keep all secrets in the hosting provider's environment-variable settings.

## Build and verification

```bash
npm run build
```

The build runs the TypeScript compiler and creates production assets in `dist/`.

Focused verification scripts are available in `scripts/`. For example:

```bash
node scripts/verify-help-me-book.mjs
```

Run only scripts present in your checkout; these checks do not replace testing against a configured Supabase project or deployed environment.

## Mobile builds

Android debug build (requires Android tooling):

```bash
npm run build:android
```

Open native projects in the platform IDEs:

```bash
npm run cap:open:android
npm run cap:open:ios
```

The iOS build requires macOS and Xcode. Debug APKs are for testing and are not production release packages.

## Privacy and safety

MIND SATHI handles account and wellness-related information. Configure Supabase access policies and deployment secrets carefully. Caregiver access must follow the application's authorization and consent checks. Do not place patient records, access tokens, or private credentials in client-side configuration or logs.

MIND SATHI is a support and wellness application, not a substitute for professional medical advice, diagnosis, or treatment. AI-generated or web-retrieved information can be incomplete or incorrect; confirm care and appointment details directly with the provider. The application does not guarantee appointment availability or completion.

## Contributing

1. Fork the repository and create a focused branch.
2. Keep changes scoped and avoid committing secrets, personal data, or generated credentials.
3. Run the relevant checks and `npm run build` before opening a pull request.
4. Describe behavior changes, verification performed, and any required environment variables.

## License

No license is specified in this repository. Contact the repository owner before redistributing or reusing the code.
