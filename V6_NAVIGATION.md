# ThriftSpot v6 - Page Navigation Map

## Page Structure

```
┌─────────────────────────────────────────────────────────────┐
│                     ThriftSpot v6 Pages                      │
└─────────────────────────────────────────────────────────────┘

                    ┌──────────────────┐
                    │  signin.html     │
                    │  (Entry Point)   │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │  index-v6.html   │◄──────────┐
                    │  (Spot/Scan)     │           │
                    │  • Scan Circle   │           │
                    │  • Analyze       │           │
                    │  • Mode Toggle   │           │
                    └────────┬─────────┘           │
                             │                     │
                    ┌────────▼─────────┐           │
                    │   Results View   │           │
                    │  (in index-v6)   │           │
                    │  • Item Details  │           │
                    │  • eBay Listings │           │
                    │  • Create List   │           │
                    └────────┬─────────┘           │
                             │                     │
                    ┌────────▼─────────┐           │
                    │ dashboard-v6.html│           │
                    │  (Dashboard)     │           │
                    │  • Stats Grid    │           │
                    │  • Listings      │           │
                    │  • Scan New      │───────────┘
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │ profile-v6.html  │
                    │  (Profile)       │
                    │  • Personal Info │
                    │  • eBay Settings │
                    │  • Stats         │
                    └──────────────────┘

                    ┌──────────────────┐
                    │  pin-map.html    │◄───── (Mode Toggle)
                    │  (Thrift/Map)    │
                    │  • Map View      │
                    │  • Pins/Spots    │
                    │  • Filters       │
                    └──────────────────┘
```

## Navigation Flow

### 1. **index-v6.html** (Main Scan Page)
- **Header**: Logo → index-v6.html
- **User Menu Dropdown**:
  - Profile → profile-v6.html ✅
  - Dashboard → dashboard-v6.html ✅
  - Sign Out → signin.html
- **Mode Toggle**:
  - Spot (current) → stays on index-v6.html
  - Thrift → pin-map.html
- **Scan Another Button**: → index-v6.html

### 2. **dashboard-v6.html**
- **Header**: Logo → index-v6.html ✅
- **User Menu Dropdown**:
  - Profile → profile-v6.html ✅
  - Dashboard → dashboard-v6.html ✅
  - Sign Out → signin.html
- **Scan New Item Button**: → index-v6.html ✅
- **Scan Your First Item**: → index-v6.html ✅

### 3. **profile-v6.html**
- **Header**: Logo → index-v6.html ✅
- **User Menu Dropdown**:
  - Profile → profile-v6.html ✅
  - Dashboard → dashboard-v6.html ✅
  - Sign Out → signin.html
- **Connect eBay**: → ebay-connect.html

### 4. **signin.html**
- **After Sign In**: → dashboard-v6.html
- **After Sign Up**: → dashboard-v6.html

### 5. **pin-map.html** (To be updated to v6)
- **Mode Toggle Back**: → index-v6.html
- **User Menu**: Links to v6 pages

## Features Common Across All v6 Pages

✅ **Consistent Header**
- ThriftSpot logo with home icon
- User avatar with dropdown menu

✅ **User Dropdown Menu**
- Profile → profile-v6.html
- Dashboard → dashboard-v6.html
- Sign Out → signin.html

✅ **Design System**
- v6 CSS (thriftspot-v6.css)
- Indigo/purple gradient theme
- Clean card-based layouts
- Responsive mobile/desktop

✅ **Firebase Integration**
- Auth state management
- User data loading
- Real-time updates

## Current Status

### ✅ Completed
- [x] index-v6.html - Scan interface with mode toggle
- [x] dashboard-v6.html - Stats and listings
- [x] profile-v6.html - User settings
- [x] All v6 pages linked correctly
- [x] Consistent navigation across pages
- [x] User menu dropdowns working

### 🔄 To Do
- [ ] Update pin-map.html to v6 styling
- [ ] Add mode toggle to pin-map.html
- [ ] Ensure pin-map links back to v6 pages
