# DebugDream Finance — Setup Guide

---

## Prerequisites

- Node.js 18+ installed
- A Google account (for Firebase and sign-in)
- A Vercel account (free tier, for deployment)

---

## Step 1 — Create Firebase Project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add Project** → name it `debugdream-finance`
3. Disable Google Analytics (not needed) → **Create Project**

### Enable Authentication
1. Left sidebar → **Authentication** → **Get Started**
2. **Sign-in method** tab → Enable **Google**
3. Set project support email → **Save**

### Enable Firestore
1. Left sidebar → **Firestore Database** → **Create database**
2. Choose **Production mode** → select a region (e.g. `asia-south1` for Nepal)
3. **Enable**

### Apply Security Rules
1. In Firestore → **Rules** tab
2. Replace all content with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthorized() {
      return request.auth != null &&
             request.auth.token.email == 'YOUR_EMAIL@gmail.com';
    }
    match /{collection}/{document=**} {
      allow read, write: if isAuthorized();
    }
  }
}
```

**Replace `YOUR_EMAIL@gmail.com` with your actual Google email.** → **Publish**

### Get Firebase Config
1. Project Settings (gear icon) → **General** tab
2. Scroll to **Your apps** → Click **</>** (Web)
3. Register app (name: `debugdream-finance-web`) → **Continue to console**
4. Copy the `firebaseConfig` values — you'll need them next

---

## Step 2 — Configure Environment Variables

Copy `.env.example` to `.env.local` in the project root:

```bash
cp .env.example .env.local
```

Fill in your Firebase values:

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=debugdream-finance.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=debugdream-finance
VITE_FIREBASE_STORAGE_BUCKET=debugdream-finance.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123

VITE_ALLOWED_EMAIL=rikesh@debugdream.com
```

**Set `VITE_ALLOWED_EMAIL` to your actual Google email.**

---

## Step 3 — Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

Sign in with Google → the **5-step onboarding** will appear.

### Onboarding Steps
1. **Opening Balances** — enter your current bank balance and cash in hand
2. **Company Details** — pre-filled with DebugDream defaults, edit if needed
3. **Logo** — upload your DebugDream logo PNG (transparent preferred)
4. **Employees** — Pranesh, Samana, Sapana, Rikesh are pre-populated
5. **Car Loan** — enter lender, loan amount, EMI (62,372 pre-filled), tenure

After completing onboarding, you land on the Dashboard.

---

## Step 4 — Deploy to Vercel

### Option A — Vercel CLI (recommended)

```bash
npm install -g vercel
vercel login
vercel --prod
```

When prompted:
- Project name: `debugdream-finance`
- Framework: **Vite**
- Build command: `npm run build`
- Output directory: `dist`

Then add environment variables in the Vercel dashboard:
1. Project → **Settings** → **Environment Variables**
2. Add all 7 variables from your `.env.local`

### Option B — GitHub + Vercel Dashboard

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **New Project** → Import from GitHub
3. Framework: **Vite** → **Deploy**
4. Add environment variables in Settings

### Add Vercel Domain to Firebase Auth

After deploying, Firebase needs to whitelist your Vercel URL:
1. Firebase Console → **Authentication** → **Settings** → **Authorized domains**
2. Add `your-project.vercel.app` (and your custom domain if you have one)

---

## Module Reference

| Module | Path | Description |
|--------|------|-------------|
| Dashboard | `/` | Overview, charts, recent transactions |
| Income | `/income` | Log income by client, link to invoices |
| Expenses | `/expenses` | Log expenses by category, cash withdrawal |
| My Expenses | `/my-expenses` | Rikesh's personal expense tracker + reimbursement |
| Payroll | `/payroll` | Nepal payroll calc, SSF, TDS, payslips |
| Invoices | `/invoices` | Create/send/mark-paid, generate PDF |
| Office Setup | `/office-setup` | Grouped capital purchase projects |
| Salary Ledger | `/salary-ledger` | Rikesh's salary accrual + EMI deductions |
| Inventory | `/inventory` | Office asset register |
| Car Loan | `/car-loan` | EMI tracker, auto-linked from Expenses |
| Reminders | `/reminders` | TDS/SSF/rent alerts, manual reminders |
| Settings | `/settings` | Company profile, categories, logo, backup |

---

## Key Behaviors to Know

**Balances:** Set opening Bank + Cash in Settings. All transactions calculate forward from there. The top bar always shows live balances.

**Dates:** Every entry stores both AD and BS dates. The month selector in the top bar filters all modules simultaneously.

**Car Loan EMI:** Log an expense under category "Car Loan EMI" and it auto-records a payment in the Car Loan tracker.

**Rikesh's Salary:** Salary accrues monthly in the Salary Ledger. Car Loan EMI is deducted from it. TDS is only calculated when you actually log a payment, not monthly.

**Payroll → Salary Ledger:** Run payroll for a month, and Rikesh's entry is auto-added to the Salary Ledger with gross, SSF, and EMI deductions.

**Invoice → Income:** When you mark an invoice as Paid, you can optionally create an Income entry automatically.

**My Expenses → Company Expenses:** When you close a month in My Expenses, a "Personal Reimbursement – Rikesh" expense is auto-created in Company Expenses.

**Backup:** Settings → Export Full Backup downloads all Firestore data as a timestamped JSON file.

---

## Nepali Number Formatting

All NPR amounts display in Nepali lakh format:
- `122500` → `NPR 1,22,500`
- `5000000` → `NPR 50,00,000`

AUD amounts display as: `AUD 550.00`

---

## Nepal Payroll Rules (Built-in)

- SSF: Employee 11%, Employer 20% of Basic. Capped at NPR 50,000 basic.
- TDS threshold: NPR 5,00,000/yr (Single), NPR 6,00,000/yr (Married)
- Female employees: 10% TDS reduction
- Trainees/Interns: No SSF, no TDS — flat pay only
- TDS & SSF deposit due: 25th of following month
- Rikesh: SSF calculated but TDS only on actual salary withdrawals

---

*DebugDream Finance · Built for debugdream · Kathmandu, Nepal · 2082 BS*
