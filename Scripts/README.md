# Admin Scripts

This directory contains administrative scripts for managing the ThriftSpot application.

## Token Management Script

The `manage-tokens.js` script allows you to manage user token balances for testing and administrative purposes.

### Prerequisites

Make sure you have a `serviceAccountKey.json` file in the root directory of the project with your Firebase Admin SDK credentials.

### Usage

```bash
node scripts/manage-tokens.js <command> [arguments]
```

### Commands

#### Set Token Balance
Set a user's token balance to a specific amount:
```bash
node scripts/manage-tokens.js set <userId> <amount>
```

Example:
```bash
node scripts/manage-tokens.js set abc123def456 15
```

#### Award Tokens
Award tokens to a user (adds to their current balance):
```bash
node scripts/manage-tokens.js award <userId> <amount> [reason]
```

Examples:
```bash
node scripts/manage-tokens.js award abc123def456 50
node scripts/manage-tokens.js award abc123def456 100 "contest_winner"
```

#### Get Token Balance
View a user's token balance and statistics:
```bash
node scripts/manage-tokens.js get <userId>
```

Example:
```bash
node scripts/manage-tokens.js get abc123def456
```

Output:
```
📊 Token info for user: abc123def456
   Email: user@example.com
   Current balance: 15
   Total earned: 15
   Total spent: 0
   Total purchased: 0
   Tier: free
   Monthly allocation: 100
```

#### Reset All Users to 15 Tokens
Reset all users' token balances to the initial 15 tokens:
```bash
node scripts/manage-tokens.js reset-all-to-15
```

⚠️ **Warning**: This will reset ALL users to 15 tokens, overwriting their current balances.

#### List All Users
Display all users and their token balances:
```bash
node scripts/manage-tokens.js list
```

### Finding Your User ID

To find your user ID:

1. **From Firebase Console**:
   - Go to Firebase Console → Authentication
   - Find your email in the user list
   - Copy the UID

2. **From Browser Console**:
   - Log into your app
   - Open browser DevTools console
   - Type: `firebase.auth().currentUser.uid`
   - Copy the displayed UID

### Examples

Reset your test account to 15 tokens:
```bash
node scripts/manage-tokens.js set YOUR_USER_ID 15
```

Award yourself 100 tokens for testing:
```bash
node scripts/manage-tokens.js award YOUR_USER_ID 100 testing
```

Check your current balance:
```bash
node scripts/manage-tokens.js get YOUR_USER_ID
```

Reset all test users to starting balance:
```bash
node scripts/manage-tokens.js reset-all-to-15
```

### Transaction Logging

All token adjustments made through this script are logged in the `tokenTransactions` collection in Firestore, maintaining a complete audit trail.
