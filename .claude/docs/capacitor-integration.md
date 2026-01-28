# CapacitorJS Integration Plan for VolleyStats

## Executive Summary

**Complexity Assessment**: **MEDIUM-HIGH**

VolleyStats is well-positioned for Capacitor conversion due to its offline-first architecture, existing PWA configuration, and mostly client-side rendering. However, challenges exist around iOS storage limitations, native API adaptations, and authentication security.

**Recommended Approach**: Static Export with IndexedDB (migrate to SQLite if needed)

**Estimated Effort**: 14-21 development days, affecting ~15 files with ~620 LOC changes

---

## Complexity Justification

### Strengths (Making This Easier)
- ✅ **Offline-first architecture** - RxDB + Supabase sync already handles offline scenarios
- ✅ **PWA foundation** - Service worker, manifest, icons already configured
- ✅ **Client-side focused** - Minimal server dependencies, only 2 API routes
- ✅ **Mobile-ready UI** - Responsive Tailwind CSS, touch-friendly Radix UI components
- ✅ **Virtual keyboard detection** - Already has 3 fallback strategies for mobile keyboards
- ✅ **Safe area support** - `viewportFit: 'cover'` configured for notches

### Challenges (Increasing Complexity)
- ⚠️ **iOS IndexedDB quota** - 50MB hard limit (can store ~900 matches)
- ⚠️ **Native API adaptations** - Network detection, secure storage, file handling
- ⚠️ **Authentication security** - Must move from localStorage to secure storage
- ⚠️ **Build pipeline** - Static export, environment variables, platform-specific builds
- ⚠️ **App lifecycle** - Sync must respect background/foreground states

---

## Required Capacitor Plugins

### Critical (Phase 1-2)
- `@capacitor/core` - Core framework
- `@capacitor/app` - Lifecycle events (pause/resume/background)
- `@capacitor/network` - Network status (replace `navigator.onLine`)
- `@capacitor/filesystem` - File I/O for PDFs, uploads
- `@capacitor/preferences` - Key-value storage (replace localStorage for settings)
- `@capacitor-community/secure-storage` - Encrypted token storage (Supabase auth)
- `@capacitor/keyboard` - Native keyboard events

### Important (Phase 3-4)
- `@capacitor/camera` - Photo capture for avatars
- `@capacitor/splash-screen` - Native splash screen
- `@capacitor/status-bar` - Status bar styling
- `@capacitor/share` - Native share sheet
- `@capacitor/browser` - In-app browser for OAuth

### Optional (Post-Launch)
- `@capacitor/push-notifications` - Match reminders
- `@capacitor/haptics` - Tactile feedback
- `@capacitor/screen-orientation` - Force landscape
- `@capacitor-community/sqlite` - SQLite storage (if IndexedDB quota issues)

---

## Critical Files to Modify

### 1. [lib/rxdb/database.ts](lib/rxdb/database.ts)
**Purpose**: RxDB initialization and storage engine selection

**Current Issue**: Uses `window.location` query params to select storage engine
```typescript
const url = new URL(window.location.href);
let storageKey = url.searchParams.get('storage');
```

**Required Changes**:
- Add platform detection using `Capacitor.isNativePlatform()`
- Use environment variable for storage selection on native
- Keep URL-based logic for web

**Impact**: Determines IndexedDB vs SQLite usage

---

### 2. [lib/supabase/client.ts](lib/supabase/client.ts)
**Purpose**: Supabase client configuration and authentication

**Current Issue**: Uses `localStorage` for session tokens (insecure on mobile)

**Required Changes**:
- Create custom storage adapter using `@capacitor-community/secure-storage`
- Implement async getItem/setItem/removeItem
- Platform detection for native vs web storage
- Configure Supabase client to use custom storage:
```typescript
auth: {
  storage: customSecureStorage,
  persistSession: true,
}
```

**Impact**: CRITICAL for authentication security

---

### 3. [lib/rxdb/sync/manager.ts](lib/rxdb/sync/manager.ts)
**Purpose**: Orchestrates bidirectional sync between RxDB and Supabase

**Current Issue**: No app lifecycle awareness (sync continues when backgrounded)

**Required Changes**:
- Add `App.addListener('appStateChange')` for pause/resume
- Call `setOnlineStatus(false)` when app backgrounds (pauses replications)
- Call `setOnlineStatus(true)` when app foregrounds (resumes + reSync)
- Listen for `resume` event to check pending changes

**Impact**: Battery preservation, ensures fresh data on app open

---

### 4. [hooks/use-online-status.ts](hooks/use-online-status.ts)
**Purpose**: Detects network connectivity

**Current Issue**: Uses browser-only APIs (`window.addEventListener('online')`, `navigator.onLine`)

**Required Changes**:
- Add Capacitor Network plugin integration
- Use `Network.addListener('networkStatusChange')` on native
- Use `Network.getStatus()` for initial state
- Keep existing browser implementation as fallback

**Impact**: Used throughout app to control sync behavior

---

### 5. [next.config.js](next.config.js)
**Purpose**: Build configuration

**Required Changes**:
- Add static export mode when `NEXT_PUBLIC_BUILD_TARGET=capacitor`
- Disable PWA (next-pwa) for native builds
- Set `output: 'export'` for Capacitor builds
- Add `trailingSlash: true` (required for static export)

**Impact**: Controls entire build pipeline

---

## Build Pipeline Strategy

### Decision: Static Export (not Server Mode)

**Rationale**:
1. App is 100% client-side ("use client" everywhere)
2. Only 2 API routes, both replaceable:
   - `/api/import/ffvb` - Move to client or admin tool
   - `/auth/callback` - Use Supabase deep links instead
3. No Node.js runtime needed in app bundle
4. Simpler deployment to app stores

### Build Process Flow
```bash
1. Static Export:
   NEXT_PUBLIC_BUILD_TARGET=capacitor next build && next export
   → Creates /out directory with static HTML/CSS/JS

2. Capacitor Sync:
   npx cap sync ios
   npx cap sync android
   → Copies /out to native project public directories

3. Native Build:
   Xcode (iOS) or Android Studio (Android)
   → Compiles native app with embedded web assets

4. Distribution:
   App Store Connect (iOS) / Google Play Console (Android)
```

### Environment Variables
**Strategy**: Build-time injection via `.env.capacitor`

```bash
NEXT_PUBLIC_SUPABASE_URL=https://gvtjccisbwrwpjtabnyd.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
NEXT_PUBLIC_BUILD_TARGET=capacitor
NEXT_PUBLIC_STORAGE_ENGINE=dexie
```

**Security**: Only `NEXT_PUBLIC_*` variables (already public in browser), no secrets

---

## Storage Strategy

### Phase 1 Approach: Keep IndexedDB/Dexie

**Why Start Here**:
- Zero code changes to RxDB schema/collections
- Proven architecture already working
- IndexedDB available in Capacitor webview

**iOS Limitation**: 50MB quota (hard limit)

**Capacity Estimate**:
- Per match: ~55 KB (match + 5 sets + 200 score_points + 50 player_stats + 10 events)
- **Max capacity: ~900 matches** (50MB ÷ 55KB)

**Mitigations**:
1. Implement storage monitoring: `navigator.storage.estimate()`
2. Add UI warning at 80% quota
3. Auto-cleanup matches older than 6 months
4. User-controlled cleanup UI

### Phase 2 Fallback: SQLite Migration (If Needed)

**Plugin**: `@capacitor-community/sqlite`

**When to Trigger**:
- Beta testing shows >50% of users hitting quota
- Power users reporting data loss
- Storage warnings becoming common

**Implementation**:
- Change RxDB storage adapter (lib/rxdb/database.ts)
- Data migration script for existing users
- ~200 LOC changes

**Benefits**: Unlimited storage, better native performance

**Decision Point**: After 2-4 weeks of beta testing

---

## Platform-Specific Considerations

### iOS Requirements

**Info.plist Additions** (ios/App/App/Info.plist):
```xml
<key>NSPhotoLibraryUsageDescription</key>
<string>Upload player avatar photos</string>

<key>NSCameraUsageDescription</key>
<string>Take player avatar photos</string>

<key>UIBackgroundModes</key>
<array>
  <string>fetch</string>
</array>

<key>UISupportedInterfaceOrientations</key>
<array>
  <string>UIInterfaceOrientationLandscapeLeft</string>
  <string>UIInterfaceOrientationLandscapeRight</string>
</array>
```

**App Store Requirements**:
- Privacy Nutrition Label (data collection disclosure)
- Developer account ($99/year)

### Android Requirements

**AndroidManifest.xml Additions** (android/app/src/main/AndroidManifest.xml):
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.CAMERA" />

<application
  android:screenOrientation="sensorLandscape">
```

**Gradle Configuration**:
- Min SDK: 22 (Android 5.1)
- Target SDK: 34 (Android 14)

---

## Implementation Phases

### Phase 1: Core Capacitor Setup (2-3 days)
**Complexity**: LOW

**Tasks**:
1. Install Capacitor CLI and core plugins
   ```bash
   npm install @capacitor/core @capacitor/cli
   npm install @capacitor/app @capacitor/network @capacitor/filesystem
   npm install @capacitor/preferences @capacitor/splash-screen
   npm install @capacitor/status-bar @capacitor/keyboard
   ```

2. Initialize Capacitor project
   ```bash
   npx cap init "VolleyStats" "com.volleystats.app"
   ```

3. Create capacitor.config.ts
   - appId: `com.volleystats.app`
   - appName: `VolleyStats`
   - webDir: `out`

4. Modify [next.config.js](next.config.js) for static export
   - Add `output: 'export'` when `NEXT_PUBLIC_BUILD_TARGET=capacitor`
   - Disable PWA for native builds

5. Add iOS and Android platforms
   ```bash
   npx cap add ios
   npx cap add android
   ```

6. Test static export
   ```bash
   NEXT_PUBLIC_BUILD_TARGET=capacitor npm run build
   npx cap sync
   npx cap open ios  # Test in Xcode Simulator
   ```

**Deliverables**: Native project shells, static build working, app launches in simulator

---

### Phase 2: Network & Storage Adaptations (3-4 days)
**Complexity**: MEDIUM

**Tasks**:

1. **Create platform detection utility**
   - New file: `lib/capacitor/platform.ts`
   - Exports: `isNative()`, `isiOS()`, `isAndroid()`, `isWeb()`

2. **Adapt network detection** ([hooks/use-online-status.ts](hooks/use-online-status.ts))
   ```typescript
   if (Capacitor.isNativePlatform()) {
     Network.addListener('networkStatusChange', handler);
     Network.getStatus().then(setStatus);
   } else {
     // Existing browser API
   }
   ```

3. **Implement secure storage** (NEW: `lib/capacitor/secure-storage.ts`)
   - Install: `npm install @capacitor-community/secure-storage`
   - Create async storage adapter wrapping SecureStorage
   - Platform detection: native uses SecureStorage, web uses localStorage

4. **Modify Supabase client** ([lib/supabase/client.ts](lib/supabase/client.ts))
   - Import custom storage adapter
   - Configure: `auth: { storage: customSecureStorage }`

5. **Update RxDB initialization** ([lib/rxdb/database.ts](lib/rxdb/database.ts))
   - Remove URL-based storage detection
   - Use: `process.env.NEXT_PUBLIC_STORAGE_ENGINE || 'dexie'`
   - Add platform detection for future SQLite path

6. **Add app lifecycle to SyncManager** ([lib/rxdb/sync/manager.ts](lib/rxdb/sync/manager.ts))
   ```typescript
   App.addListener('appStateChange', ({ isActive }) => {
     if (isActive) this.setOnlineStatus(true);  // Resume
     else this.setOnlineStatus(false);          // Pause
   });
   ```

**Deliverables**: Network detection works, auth tokens secure, sync respects lifecycle

---

### Phase 3: File Handling & Media (2-3 days)
**Complexity**: MEDIUM

**Tasks**:

1. **Install Camera plugin**
   ```bash
   npm install @capacitor/camera
   ```

2. **Adapt avatar upload** ([components/players/avatar-upload.tsx](components/players/avatar-upload.tsx))
   ```typescript
   if (Capacitor.isNativePlatform()) {
     const photo = await Camera.getPhoto({
       quality: 90,
       source: CameraSource.Prompt  // Camera or gallery
     });
     // Convert base64 to File object
   } else {
     // Existing react-dropzone
   }
   ```

3. **Update PDF export** ([app/matches/[id]/stats/page.tsx](app/matches/[id]/stats/page.tsx))
   - Generate PDF with jsPDF (existing)
   - On native: Save with `Filesystem.writeFile()`
   - Share with `Share.share()` plugin

4. **Configure permissions**
   - iOS: Info.plist camera/photo descriptions
   - Android: AndroidManifest.xml permissions

**Deliverables**: Photo upload from camera/gallery, PDF export saves and shares

---

### Phase 4: UI Polish & Platform Integration (2-3 days)
**Complexity**: LOW-MEDIUM

**Tasks**:

1. **Configure splash screen**
   - Generate splash assets (use capacitor-assets or manual)
   - Configure SplashScreen plugin in capacitor.config.ts
   - Test loading experience

2. **Configure status bar**
   - Match theme colors (dark slate: #0f172a)
   - Use StatusBar plugin to set style
   - Handle light/dark mode

3. **Enhance keyboard handling**
   - Use Keyboard plugin instead of custom detection
   - Test in live match scoring page

4. **Add screen orientation** (optional)
   ```bash
   npm install @capacitor/screen-orientation
   ```
   - Lock to landscape for match tracking
   - Allow rotation for other screens

5. **Add haptic feedback** (optional)
   - Subtle haptics on score point actions
   - Test on physical device

**Deliverables**: Polished native experience, proper status bar, good keyboard UX

---

### Phase 5: Testing & Optimization (3-5 days)
**Complexity**: MEDIUM

**Tasks**:

1. **Storage monitoring**
   - Implement quota tracking UI
   - Add warning toast at 80% capacity
   - Test with large datasets (500+ matches)

2. **Performance testing**
   - Benchmark RxDB sync (target: 100 matches in <10s on WiFi)
   - Test initial sync on slow network (3G simulation)
   - Test app lifecycle transitions (background/foreground)

3. **Platform-specific testing**
   - iOS: iPhone, iPad, different iOS versions
   - Android: Multiple manufacturers (Samsung, Pixel, etc.)
   - Different screen sizes and orientations

4. **Offline testing**
   - Full offline match tracking workflow
   - Sync recovery after extended offline (airplane mode for hours)
   - Conflict resolution when multiple devices edit same match

5. **Beta testing prep**
   - TestFlight setup (iOS)
   - Internal testing track (Android)
   - Optional: Sentry for crash reporting

**Deliverables**: Stable beta build, performance benchmarks, known issues documented

---

### Phase 6: App Store Preparation (2-3 days)
**Complexity**: MEDIUM

**Tasks**:

1. **Create app store assets**
   - App icons (all required sizes)
   - Screenshots (iPhone, iPad, Android phone/tablet)
   - App description, keywords
   - Privacy policy URL

2. **iOS App Store Connect**
   - Create app record
   - Configure app privacy details (data collection disclosure)
   - Upload build via Xcode
   - Submit for review

3. **Google Play Console**
   - Create app listing
   - Configure content rating
   - Upload AAB (Android App Bundle)
   - Submit for review

4. **Deep link configuration**
   - Configure Universal Links (iOS) and App Links (Android)
   - Update Supabase redirect URLs
   - Test email confirmation flows

**Deliverables**: Apps submitted to both stores, all metadata complete

---

## Risk Assessment

### High-Risk Items

**1. IndexedDB Quota on iOS (50MB limit)**
- **Impact**: Data loss for power users
- **Mitigation**: Storage monitoring, auto-cleanup, SQLite migration plan
- **Probability**: MEDIUM

**2. Supabase Auth Deep Links**
- **Impact**: Users can't verify emails in native app
- **Mitigation**: Configure Universal Links/App Links, test thoroughly, browser fallback
- **Probability**: MEDIUM

**3. Service Worker Conflicts**
- **Impact**: Stale content in native app
- **Mitigation**: Disable PWA when `NEXT_PUBLIC_BUILD_TARGET=capacitor`
- **Probability**: LOW

### Medium-Risk Items

**4. Large Bundle Size**
- **Impact**: Reduced installs (cellular download limits)
- **Mitigation**: Analyze bundle, code splitting, lazy load charts/PDF
- **Probability**: MEDIUM

**5. RxDB Performance on Native**
- **Impact**: Laggy UI during sync
- **Mitigation**: Background sync, progressive sync (prioritize current match)
- **Probability**: LOW

### Low-Risk Items

**6. Platform API Differences**
- **Impact**: UX inconsistencies iOS vs Android
- **Mitigation**: Test on both platforms, use Capacitor abstractions
- **Probability**: LOW

**7. App Store Rejection**
- **Impact**: Delayed launch
- **Mitigation**: Follow guidelines, complete metadata, thorough testing
- **Probability**: LOW

---

## Verification Strategy

### Development Testing

**Simulators/Emulators**:
```bash
# iOS
npx cap run ios --livereload --external

# Android
npx cap run android --livereload --external
```

**Debugging**:
- Safari Web Inspector (iOS): Develop → Simulator → VolleyStats
- Chrome DevTools (Android): chrome://inspect
- Logs: `npx cap logs ios` or `npx cap logs android`

### Physical Device Testing

**Required Devices**:
- iPhone (iOS 15+) - Test quota, safe areas, gestures
- iPad - Test landscape layout, split view
- Android Phone (Android 10+) - Test various manufacturers
- Android Tablet - Test large screens

**Test Scenarios**:
1. ✅ Fresh install (no data)
2. ✅ Offline match tracking (airplane mode)
3. ✅ Large dataset (500+ matches)
4. ✅ App backgrounding during sync
5. ✅ Photo uploads (camera + gallery)
6. ✅ PDF export and sharing
7. ✅ Deep links (email confirmation)
8. ✅ Storage quota warnings

### Beta Testing

**iOS TestFlight**:
- 10,000 external testers (max)
- Automatic updates
- Crash reporting included

**Android Internal Testing**:
- 100 testers
- Manual update prompts

**Metrics to Track**:
- Crash rate (target: <1%)
- Storage usage (monitor quota hits)
- Sync performance (avg time to sync 100 matches)
- Battery drain
- Memory usage

---

## Success Criteria

### Technical KPIs
- ✅ App launches in <3 seconds on mid-range device
- ✅ Sync 100 matches in <10 seconds on WiFi
- ✅ Storage usage <50MB for typical user (500 matches)
- ✅ Crash rate <1%
- ✅ 60 FPS UI during live match tracking
- ✅ 100% offline capability for core features

### User Experience KPIs
- ✅ App Store rating >4.0 stars (after 50+ reviews)
- ✅ <5% beta tester churn
- ✅ <10% support tickets related to native issues

### Business KPIs
- ✅ Both apps approved on first submission
- ✅ Launch within 6 weeks of start
- ✅ <$5000 total cost (plugins + accounts + devices)

---

## Effort Breakdown

| Phase | Days | Complexity | Files Changed |
|-------|------|-----------|---------------|
| 1. Core Setup | 2-3 | LOW | 2 |
| 2. Network/Storage | 3-4 | MEDIUM | 5 |
| 3. File Handling | 2-3 | MEDIUM | 3 |
| 4. UI Polish | 2-3 | LOW-MEDIUM | 4 |
| 5. Testing | 3-5 | MEDIUM | 1 |
| 6. App Store | 2-3 | MEDIUM | 0 |
| **TOTAL** | **14-21 days** | **MEDIUM-HIGH** | **~15 files** |

**Total LOC Changes**: ~620 lines across 15 files

---

## Post-Launch Roadmap (Optional)

### Phase 7: Enhancements
- Push notifications for match reminders
- Background sync (fetch latest matches while app closed)
- Widgets (show current match score on home screen)
- Apple Watch companion app (quick score entry)

### Phase 8: Storage Migration (If Needed)
- SQLite implementation via `@capacitor-community/sqlite`
- Data migration for existing users
- Testing with large datasets

---

## Conclusion

VolleyStats is **well-suited** for Capacitor conversion with a **MEDIUM-HIGH complexity** rating. The offline-first architecture and PWA foundation provide a strong starting point, while challenges around iOS storage quota and native API adaptations are manageable with clear mitigation strategies.

**Recommended path forward**:
1. Start with IndexedDB (zero code changes to RxDB)
2. Implement storage monitoring and cleanup
3. Plan SQLite migration as Phase 2 fallback
4. Use static export build strategy
5. Launch with beta testing to validate storage assumptions

**Key success factors**:
- Thorough testing on physical devices (both iOS and Android)
- Early beta program to identify quota issues
- Clear migration path to SQLite if needed
- Proper deep link configuration for Supabase auth

Total implementation: **3-4 weeks** of focused development.
