# German Learning App - Deployment Guide

## 🚀 Deploying to Cloudflare Pages via GitHub Actions

This guide will help you deploy the German Learning Application to Cloudflare Pages using GitHub Actions.

### Prerequisites

1. **GitHub Account**: You'll need a GitHub account to host your repository
2. **Cloudflare Account**: Sign up at [Cloudflare](https://cloudflare.com)
3. **Cloudflare API Token**: Required for automated deployment

### Step 1: Set up Cloudflare API Token

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
2. Click "Create Token"
3. Use the "Edit Cloudflare Workers" template or create a custom token with:
   - `Zone:Zone:Read`
   - `Zone:Page Rules:Edit`
   - `Account:Cloudflare Pages:Edit`
4. Copy your API token (you'll need this for GitLab)

### Step 2: Get your Cloudflare Account ID

1. Go to your [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select any domain (or the right sidebar if you don't have domains)
3. Copy your Account ID from the right sidebar

### Step 3: Configure GitHub Repository

1. **Create a new GitHub repository**
2. **Add the project files** to your GitHub repository
3. **Set up GitHub Secrets**:
   - Go to Settings → Secrets and variables → Actions
   - Add these repository secrets:
     - `CLOUDFLARE_API_TOKEN`: Your API token from Step 1
     - `CLOUDFLARE_ACCOUNT_ID`: Your Account ID from Step 2

### Step 4: Deploy

1. **Push your code** to the main branch
2. **Go to Actions tab** in your GitHub repository
3. **GitHub Actions will automatically deploy**:
   - The workflow will trigger on every push to main
   - Or you can manually trigger it from Actions tab
4. **Your app will be deployed** to: `https://deutschlern-app.pages.dev`

### Files Included for Deployment

- ✅ `index.html` - Main application file
- ✅ `styles.css` - Complete styling with dark/light themes
- ✅ `app.js` - Compiled TypeScript application
- ✅ `dataJson/` - All German vocabulary files (A1-B1)
- ✅ `.github/workflows/deploy.yml` - GitHub Actions workflow
- ✅ `wrangler.toml` - Cloudflare Pages configuration
- ✅ `_redirects` - Client-side routing configuration
- ✅ `.gitignore` - Git ignore patterns

### Features Included

🎯 **Core Features**:
- Dashboard view with level-based card organization
- Practice mode with spaced repetition algorithm
- Statistics page with comprehensive analytics
- Dark/light theme support with system detection

📚 **Learning Features**:
- German vocabulary with proper articles (der, die, das)
- Level progression system (A1.1 → A1.2 → A2.1 → A2.2 → B1.1 → B1.2)
- Voice pronunciation for German words
- 5-level difficulty rating system
- Progress tracking with GitHub-style heatmap

🎨 **UI/UX Features**:
- Responsive design for mobile and desktop
- Smooth animations and transitions
- Clean, learning-conducive interface
- Click-to-flip flashcards
- Voice button positioning that follows German text

### Troubleshooting

**If deployment fails**:
1. Check that your API token has the correct permissions
2. Verify your Account ID is correct
3. Ensure all files are committed to the repository
4. Check the GitLab CI/CD logs for specific error messages

**If the app doesn't load**:
1. Check browser console for errors
2. Verify all JSON files are accessible
3. Check that the `_redirects` file is properly configured

### Custom Domain (Optional)

To use a custom domain:
1. Go to Cloudflare Pages dashboard
2. Select your deutschlern-app project
3. Go to Custom domains
4. Add your domain and follow the verification steps

---

**Note**: The application is designed to work as a static site and doesn't require any server-side processing. All data is loaded from JSON files and stored in the browser's local storage.