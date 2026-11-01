# $0 Deployment Guide: GitHub Discovery

This step-by-step guide walks you through deploying GitHub Discovery at **$0 hosting cost** using GitHub Actions and Vercel Hobby.

---

## Prerequisites
- A free [GitHub](https://github.com) account.
- A free [Vercel](https://vercel.com) account (Hobby tier).
- (Optional) A Telegram account if you wish to receive instant mobile alerts.
- (Optional) A free [Resend](https://resend.com) account if you wish to receive email alerts.

---

## Step 1: Create a Public GitHub Repository

1. Create a new public repository on GitHub (e.g., `github-discovery`).
2. Clone or initialize the project locally:
   ```bash
   git remote add origin https://github.com/<your-username>/github-discovery.git
   git branch -M main
   git add .
   git commit -m "Initial commit of GitHub Discovery"
   git push -u origin main
   ```

---

## Step 2: Configure GitHub Actions Permissions & Secrets

1. In your GitHub repository, go to **Settings** &rarr; **Actions** &rarr; **General**.
2. Under **Workflow permissions**, select **Read and write permissions** (required so the workflow can publish the `data` branch).
3. (Optional) Go to **Settings** &rarr; **Secrets and variables** &rarr; **Actions** and add secrets:
   - `GH_API_TOKEN`: Fine-grained personal access token with **NO** scopes (public data only). This increases GitHub REST rate limits from 60 req/hr to 5,000 req/hr.
   - `TELEGRAM_BOT_TOKEN`: Token from [@BotFather](https://t.me/BotFather).
   - `TELEGRAM_CHAT_ID`: Your chat ID (or channel ID).
   - `RESEND_API_KEY`: API key from [Resend](https://resend.com).
   - `NOTIFY_EMAIL`: Your destination email address.

---

## Step 3: Trigger the First Discovery Run

1. In your GitHub repository, navigate to the **Actions** tab.
2. Select the **Discover Repositories** workflow from the left sidebar.
3. Click **Run workflow** &rarr; click the green **Run workflow** button.
4. The workflow will:
   - Run the discovery engine.
   - Query GitHub for newly created repositories.
   - Create and push the `data` branch with `manifest.json` and day shards.
5. After the workflow completes, verify that a `data` branch exists in your repository.

---

## Step 4: Deploy Frontend on Vercel Hobby

1. Log in to your [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New...** &rarr; **Project**.
2. Import your `github-discovery` repository.
3. Configure the project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click *Edit* and select `apps/web`.
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Expand **Environment Variables** and add:
   - `VITE_DATA_BASE_URL`: `https://raw.githubusercontent.com/<your-username>/<your-repo-name>/data`
     *(Replace `<your-username>` and `<your-repo-name>` with your GitHub details)*
5. Click **Deploy**.
6. When the build finishes, open your production URL! You will see live, continuously discovered GitHub projects.

> [!NOTE]
> GitHub Raw CDN (`raw.githubusercontent.com`) caches files for up to 5 minutes. The web app includes cache-busting timestamps and TanStack Query refetching to keep data fresh. Alternatively, you can use `https://cdn.jsdelivr.net/gh/<user>/<repo>@data/`.

---

## Scheduled Workflows & Free-Tier Caveats

- **Best-Effort Scheduling**: GitHub treats `schedule` cron jobs as best-effort. Under heavy GitHub Actions platform load, runs may occasionally be delayed or skipped.
- **Inactivity Deactivation**: If a public repository receives no git pushes to `main` for 60 consecutive days, GitHub may automatically disable scheduled actions. If this occurs, simply visit the **Actions** tab and click **Enable workflow**.
- **Non-Commercial Use**: Vercel Hobby is intended for non-commercial personal projects.
- **Cost**: The entire setup runs within the free tiers of GitHub and Vercel ($0.00/month).

---

## Local Development (Without Docker)

You can run the entire system locally:

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Run a discovery cycle locally**:
   ```bash
   npm run discover:once
   ```
   This creates local shards in `./data`.
3. **Start the web application**:
   ```bash
   npm run dev
   ```
   The Vite dev server will start at `http://localhost:3000` and automatically serve data from your local `./data` directory.
