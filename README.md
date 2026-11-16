# Mailflow — Bulk Email Sender

A small Vercel web application with a static HTML/CSS/JavaScript frontend and a Python FastAPI backend. Emails are sent individually through Resend's batch endpoint, so recipients do not see each other's addresses.

## Features

- Upload `.txt` and `.csv` contact lists
- Extract and normalize email addresses
- Remove duplicates and show a preview
- Compose subject and plain-text message
- Send up to 100 individual emails per campaign
- Require an app access password and recipient-consent confirmation
- Keep the Resend API key on the server

## 1. Create a Resend account

1. Sign up at https://resend.com/
2. Create an API key.
3. For production, add and verify a domain in Resend.
4. Set a sender address on that verified domain, for example `Your Name <hello@yourdomain.com>`.

Resend's test sender (`onboarding@resend.dev`) is restricted to test use and is not a general-purpose sender for arbitrary recipients. Follow Resend's current onboarding and domain verification requirements.

## 2. Configure Vercel environment variables

In Vercel, open your project → Settings → Environment Variables and add:

- `RESEND_API_KEY`: your Resend API key
- `FROM_EMAIL`: a sender identity accepted by Resend, e.g. `Your Name <hello@yourdomain.com>`
- `APP_PASSWORD`: a long, private password used to access the send endpoint

Do not put the Resend API key in frontend code, commit it to Git, or share it with anyone. After changing environment variables, redeploy.

## 3. Deploy to Vercel

### Option A — GitHub (recommended)

1. Extract this ZIP.
2. Create a new GitHub repository.
3. Upload the contents of this folder to the repository root (not the parent folder).
4. In Vercel, choose **Add New → Project** and import the repository.
5. Deploy. Vercel should detect the FastAPI backend and serve the static files from `public/`.
6. Add the three environment variables above and redeploy.

### Option B — Vercel CLI

Install Node.js and the Vercel CLI, then from this folder run:

```bash
npm i -g vercel
vercel
```

Follow the prompts, add environment variables in the Vercel dashboard, then deploy:

```bash
vercel --prod
```

Use `vercel dev` for local development so requests are routed the same way as Vercel.

## 4. Local development

Use Python 3.12+:

```bash
python -m venv .venv
source .venv/bin/activate       # Linux/macOS
# .venv\Scripts\Activate.ps1    # Windows PowerShell

pip install -r requirements.txt
```

Run the API locally:

```bash
uvicorn index:app --reload
```

The API will be at `http://127.0.0.1:8000`. The static frontend is in `public/`; for a complete local experience, use Vercel CLI (`vercel dev`) from the project root.

## Contact file formats

TXT (one address per line):

```text
person1@example.com
person2@example.com
person3@example.com
```

CSV with an `email` header:

```csv
name,email
Amina,amina@example.com
Rahim,rahim@example.com
```

A simple one-column CSV is also accepted.

## Important limits and responsible sending

- This starter limits a single campaign to 100 recipients to keep one Vercel request short and predictable. Resend's batch API currently accepts up to 100 individual emails per request.
- All recipients must have agreed to receive your emails. Do not use purchased, scraped, or unsolicited mailing lists.
- Provide a clear way for recipients to unsubscribe in your message and honor requests promptly. For recurring or marketing campaigns, use a proper unsubscribe workflow and consider Resend Broadcasts/Audiences.
- Resend accepting a request does not mean every message was delivered. Check the Resend dashboard for delivery, bounce, and complaint events.
- The app password is a basic access gate, not a full user account system. Do not publish the URL widely. For a public multi-user product, add proper authentication, rate limiting, persistent campaign records, and abuse controls.
- A Vercel function request is not a durable background queue. Do not use this starter for very large campaigns. For that, use a queue/worker architecture and persistent job state.

## Troubleshooting

- **503 app not configured:** check `APP_PASSWORD`, `RESEND_API_KEY`, and `FROM_EMAIL` in Vercel, then redeploy.
- **401 incorrect password:** use the exact `APP_PASSWORD` value.
- **Resend 403/validation error:** verify the sending domain and the sender address in `FROM_EMAIL`.
- **Resend rate/usage error:** check your Resend account limits and sending quota.
- **No valid addresses:** check that the TXT/CSV contains email addresses and that a CSV header is named `email`.
