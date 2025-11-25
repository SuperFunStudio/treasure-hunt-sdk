# ThriftSpot Domain Setup Guide

## Connecting thriftspot.app to Firebase Hosting

Your domain **thriftspot.app** purchased through Squarespace needs to be connected to your Firebase project `treasurehunter-sdk`.

---

## Step 1: Add Custom Domain in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **treasurehunter-sdk**
3. Navigate to **Hosting** in the left sidebar
4. Click **Add custom domain**
5. Enter: `thriftspot.app`
6. Also add: `www.thriftspot.app`

Firebase will provide you with DNS records that need to be added to Squarespace.

---

## Step 2: DNS Records from Firebase

Firebase will give you records similar to these (exact values will be different):

### For `thriftspot.app`:
- **Type:** A
- **Host:** @
- **Value:** `151.101.1.195` and `151.101.65.195` (Firebase IPs)

### For `www.thriftspot.app`:
- **Type:** CNAME
- **Host:** www
- **Value:** `thriftspot-app.web.app` (or your Firebase subdomain)

### SSL Verification:
- **Type:** TXT
- **Host:** @
- **Value:** (Firebase will provide a verification code)

---

## Step 3: Configure DNS in Squarespace

1. Log in to [Squarespace Domains](https://account.squarespace.com/)
2. Go to **Settings** → **Domains**
3. Click on **thriftspot.app**
4. Click **DNS Settings** or **Advanced Settings**
5. Add the DNS records provided by Firebase:

### Add A Records:
```
Type: A
Host: @
Points to: 151.101.1.195
TTL: 1 hour

Type: A
Host: @
Points to: 151.101.65.195
TTL: 1 hour
```

### Add CNAME Record:
```
Type: CNAME
Host: www
Points to: thriftspot-app.web.app
TTL: 1 hour
```

### Add TXT Record (for verification):
```
Type: TXT
Host: @
Content: [Firebase verification string]
TTL: 1 hour
```

---

## Step 4: Update Firebase Configuration (Already Done)

Your `firebase.json` is already configured correctly for hosting:

```json
{
  "hosting": {
    "public": "public",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "/api/**",
        "function": "app"
      }
    ]
  }
}
```

---

## Step 5: Deploy to Firebase

Run these commands in your project directory:

```bash
# Install Firebase CLI (if not already installed)
npm install -g firebase-tools

# Login to Firebase
firebase login

# Deploy hosting
firebase deploy --only hosting

# Or deploy everything (functions + hosting)
firebase deploy
```

---

## Step 6: Verify Domain Connection

After DNS propagation (can take 24-48 hours, but often faster):

1. Visit `https://thriftspot.app` in your browser
2. Verify SSL certificate is active (🔒 in address bar)
3. Test both `thriftspot.app` and `www.thriftspot.app`

---

## Troubleshooting

### Domain not connecting:
- **Check DNS propagation:** Use [WhatsMyDNS](https://www.whatsmydns.net/) to check if DNS changes have propagated
- **Clear cache:** Clear your browser cache and try incognito mode
- **Check Squarespace settings:** Ensure domain is not pointed to Squarespace website

### SSL certificate issues:
- Firebase automatically provisions SSL certificates via Let's Encrypt
- Can take a few hours after DNS verification
- Check Firebase Console → Hosting for SSL status

### API calls failing:
- Ensure Cloud Functions are deployed: `firebase deploy --only functions`
- Check CORS settings in your functions
- Verify API rewrite rules in `firebase.json`

---

## Additional Configuration

### Redirect apex to www (optional):
If you want `thriftspot.app` to redirect to `www.thriftspot.app`, add this to your `firebase.json`:

```json
{
  "hosting": {
    "public": "public",
    "redirects": [
      {
        "source": "/",
        "destination": "https://www.thriftspot.app",
        "type": 301
      }
    ]
  }
}
```

### Environment Variables:
Update your Firebase config file (`public/js/firebase-config.js`) to use the production domain if needed.

---

## Quick Command Reference

```bash
# Check current Firebase project
firebase projects:list

# Switch to correct project
firebase use treasurehunter-sdk

# Deploy hosting only
firebase deploy --only hosting

# Deploy functions only
firebase deploy --only functions

# Deploy everything
firebase deploy

# View hosting URL
firebase hosting:channel:list
```

---

## Timeline

- **DNS Records Added:** 0-5 minutes
- **DNS Propagation:** 1-48 hours (usually 1-4 hours)
- **SSL Certificate:** Automatic after DNS verification (1-2 hours)
- **Full Availability:** 2-48 hours

---

## Support Links

- [Firebase Hosting Documentation](https://firebase.google.com/docs/hosting)
- [Custom Domain Setup](https://firebase.google.com/docs/hosting/custom-domain)
- [Squarespace DNS Settings](https://support.squarespace.com/hc/en-us/articles/205812348-Connecting-a-domain-to-your-site)

---

## Notes

- Keep your Squarespace domain registration active (for DNS management)
- You're using Squarespace ONLY for domain registration and DNS, not for hosting
- All hosting is handled by Firebase
- Firebase provides free SSL certificates
- Domain changes can take time - be patient!

