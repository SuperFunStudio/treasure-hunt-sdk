# ThriftSpot User Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      NEW USER LANDS                         │
│                    index.html (SCAN mode)                   │
│                                                             │
│  ┌──────────────┐              ┌──────────────┐           │
│  │  SCAN (📸)   │ ← Active     │   FIND (🗺️)   │           │
│  └──────────────┘              └──────────────┘           │
│                                                             │
│         [Upload Circle - Photo Capture]                     │
│                                                             │
│  💡 Guest Notice: "Try it free! No signup required"       │
└─────────────────────────────────────────────────────────────┘
                             ↓
              ┌──────────────┴──────────────┐
              │                             │
        Guest User                   Signed-In User
              │                             │
              ↓                             ↓
┌─────────────────────────┐   ┌─────────────────────────┐
│  Upload Photos          │   │  Upload Photos          │
│  (no signup required)   │   │  (auto-saved)           │
└─────────────────────────┘   └─────────────────────────┘
              ↓                             ↓
┌─────────────────────────────────────────────────────────────┐
│               AI ANALYSIS (scan-editor.html)                │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────┐  │
│  │ Upload │→│   AI   │→│Category│→│ Pricing│→│Done│  │
│  └────────┘  └────────┘  └────────┘  └────────┘  └────┘  │
└─────────────────────────────────────────────────────────────┘
              ↓                             ↓
┌─────────────────────────┐   ┌─────────────────────────┐
│  VIEW RESULTS           │   │  VIEW RESULTS           │
│                         │   │  ✅ Auto-saved          │
│  ❌ Cannot save         │   │                         │
│  ❌ Cannot list         │   │  Check Tokens: 🪙 5     │
│                         │   │                         │
│  ⚠️ Auth Prompt:        │   │  [List for 1 token]    │
│  "Sign up to save       │   │  [Add to Map +2]       │
│   and list items"       │   │  [Scan Another +1]     │
│                         │   │                         │
│  [Sign In / Sign Up]    │   └─────────────────────────┘
│  [Continue as Guest]    │                 ↓
│  [Scan Another]         │   ┌─────────────────────────┐
│                         │   │   DASHBOARD              │
│  → Scan Another loops   │   │                         │
│     back to index.html  │   │  🪙 Token Balance: 5    │
│                         │   │  📱 Total Scans: 12     │
│                         │   │  💰 Earnings: $234      │
│                         │   │  📍 Pins Created: 3     │
│                         │   │                         │
│                         │   │  [Recent Scans List]    │
│                         │   └─────────────────────────┘
└─────────────────────────┘                 ↓
         │                        ┌─────────┴──────────┐
         │                        │                    │
         │                  Click Token Card    Click Action
         │                        │                    │
         │                        ↓                    ↓
         │              ┌──────────────────┐   ┌──────────────┐
         └─Sign Up─────→│  TOKEN MODAL     │   │ List Item    │
                        │                  │   │ (costs token)│
                        │  Current: 🪙 5   │   └──────────────┘
                        │                  │          ↓
                        │  Earn Tokens:    │   ┌──────────────┐
                        │  • Scan (+1)     │   │ Item Listed  │
                        │  • Pin (+2)      │   │ 🪙 4 remain  │
                        │  • Ship (+3)     │   │              │
                        │                  │   │ When ships:  │
                        │  Buy Packs:      │   │ Earn +3 🪙   │
                        │  • 10 - $4.99    │   └──────────────┘
                        │  • 25 - $9.99    │
                        │  • 50 - $14.99   │
                        │  • 100 - $24.99  │
                        │                  │
                        │  Subscribe:      │
                        │  • Pro - $9.99   │
                        │  • Premium $19.99│
                        └──────────────────┘
```

## Token Flow Examples

### Example 1: New User Journey
```
1. Sign Up        → Balance: 5 tokens (starting bonus)
2. Scan 3 items   → +3 tokens = 8 total
3. List 2 items   → -2 tokens = 6 total
4. Drop 1 pin     → +2 tokens = 8 total
5. Ship 1 item    → +3 tokens = 11 total
```

### Example 2: Power User
```
1. Has 2 tokens remaining
2. Wants to list 10 items
3. Purchases Value Pack (25 tokens) for $9.99
4. Balance: 27 tokens
5. Lists 10 items → -10 tokens = 17 total
```

### Example 3: Subscription User
```
1. Subscribes to Go Pro ($9.99/month)
2. Unlimited listing tokens
3. Can still earn tokens for other features
4. Uses 2 featured listings per month (included)
```

## Screen Flow Summary

```
┌────────────┐    ┌─────────────┐    ┌──────────┐    ┌───────────┐
│   INDEX    │───→│ SCAN-EDITOR │───→│ LISTING  │───→│ DASHBOARD │
│ (Find/Scan)│    │ (Analysis)  │    │ PREVIEW  │    │ (Tokens)  │
└────────────┘    └─────────────┘    └──────────┘    └───────────┘
      ↑                                                      │
      └──────────────────────────────────────────────────────┘
                    (Return to scan more)
```

## Key Differences from Old Flow

| Old                          | New                              |
|------------------------------|----------------------------------|
| Separate scan/find pages     | Combined toggle on index.html    |
| Required login to scan       | Guests can scan freely           |
| No token system              | Token economy rewards engagement |
| Dashboard didn't show tokens | Prominent token card             |
| No way to earn free listings | Earn tokens through activity     |

