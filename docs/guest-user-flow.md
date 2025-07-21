# Guest User Flow Enhancement - Task 2.4

**Implementation Status**: ✅ Complete  
**Phase**: 2 (Core Feature Development)  
**Duration**: 5 days  

## Overview

The Guest User Flow Enhancement provides a seamless experience for users who want to use the Agent Readiness Audit without creating an account upfront. Users can complete the entire assessment as guests while maintaining the option to create an account to preserve their progress.

## Features Implemented

### 🔄 Seamless Guest Experience
- **Anonymous Session Management**: Automatic creation and tracking of guest sessions using secure anonymous IDs
- **Cookie-Based Persistence**: Sessions persist across browser sessions for 30 days
- **Progress Preservation**: All wizard answers and chat messages are saved for guest users
- **No Registration Required**: Complete audit flow available without account creation

### 💾 Session Persistence Without Registration
- **Automatic Session Creation**: Guest sessions created on first wizard visit
- **Browser Persistence**: 30-day cookie expiration with secure, httpOnly settings
- **Progress Tracking**: Real-time progress calculation and milestone tracking
- **Cross-Page Navigation**: Session state maintained across all pages

### 🔄 Optional Account Creation with Data Preservation
- **Seamless Conversion**: Guest sessions automatically convert to user accounts
- **Data Migration**: All answers, chat messages, and progress preserved during conversion
- **Merge Handling**: Smart merging if user already has existing data
- **Account Benefits**: Additional features unlocked upon account creation

### 📧 Email Capture for Report Delivery
- **Optional Email Collection**: Capture email addresses for report delivery without account creation
- **Smart Prompting**: Contextual prompts at 80% completion and when requesting reports
- **Email Validation**: Client and server-side email format validation
- **Report Delivery**: PDF reports can be sent to captured email addresses

### 🧹 Guest Session Cleanup and Data Retention
- **Automated Cleanup**: Scheduled cleanup of old guest sessions
- **Retention Policies**: Different retention periods for sessions with/without email
- **Data Privacy**: Compliance with data retention requirements
- **Admin Controls**: Administrative tools for managing guest data

## Implementation Details

### Database Schema Changes

```sql
-- Added to AuditSession model
guestEmail       String?   -- Email for guest users to receive reports
emailCapturedAt  DateTime? -- When email was captured
companyName      String?   -- Optional company name

-- Index for guest email lookups
CREATE INDEX idx_audit_sessions_guest_email ON audit_sessions(guest_email);
```

### API Endpoints

#### Guest Email Capture
```
POST /api/guest/save-email
```
- Captures guest email addresses for report delivery
- Validates email format and session existence
- Associates email with anonymous session

#### Session Conversion
```
POST /api/guest/convert-session
```
- Converts anonymous guest sessions to user accounts
- Preserves all data during conversion
- Handles session merging for existing users

#### Admin Cleanup
```
GET  /api/admin/cleanup-guest-sessions  # Statistics
POST /api/admin/cleanup-guest-sessions  # Perform cleanup
```
- Administrative endpoints for managing guest session cleanup
- Supports dry-run mode and configurable retention policies

### Key Components

#### Enhanced Wizard Page (`/wizard`)
- Unified experience for guest and authenticated users
- Real-time progress tracking with visual indicators
- Contextual account creation prompts
- Email capture modal integration

#### Guest Session Utilities (`src/utils/guestSession.ts`)
- Comprehensive guest session management
- Progress calculation and analytics
- Cleanup and retention policy enforcement
- Session conversion and data preservation

#### Cleanup Script (`src/scripts/cleanup-guest-sessions.ts`)
- Command-line tool for managing guest data retention
- Configurable cleanup policies and batch processing
- Dry-run mode for safe testing
- Comprehensive statistics and reporting

## Usage Examples

### Starting as Guest User
```typescript
// Automatic anonymous session creation
const { session, anonymousId } = await createGuestSession();

// Session persists via cookie
const cookieValue = setAnonymousIdCookie(anonymousId);
response.headers.set('Set-Cookie', cookieValue);
```

### Converting to User Account
```typescript
// During account creation
const convertedSession = await convertGuestToUserSession(
  anonymousId,
  userId,
  preserveEmail: true
);
```

### Email Capture
```typescript
// Optional email collection
await captureGuestEmail(sessionId, email, companyName);
```

### Scheduled Cleanup
```bash
# Dry run to see what would be deleted
npm run cleanup:guests -- --dry-run

# Delete sessions older than 30 days (excluding those with email)
npm run cleanup:guests -- --force

# Delete all sessions older than 60 days
npm run cleanup:guests -- --days=60 --include-email --force
```

## Configuration

### Guest Session Settings
```typescript
export const GUEST_SESSION_CONFIG = {
  // Cookie expiration (30 days)
  COOKIE_MAX_AGE: 30 * 24 * 60 * 60 * 1000,
  
  // Session cleanup policies
  CLEANUP_AFTER_DAYS: 30,
  PRESERVE_WITH_EMAIL_DAYS: 90,
  
  // Progress thresholds for prompts
  ACCOUNT_PROMPT_THRESHOLD: 0.5, // 50% completion
  EMAIL_CAPTURE_THRESHOLD: 0.8,  // 80% completion
} as const;
```

### Environment Variables
```bash
# Required for admin cleanup endpoint
ADMIN_API_KEY=your-admin-key-here
```

## User Experience Flow

### Guest User Journey
1. **Landing Page**: User clicks "Start Free Audit"
2. **Anonymous Session**: System creates guest session with cookie
3. **Wizard Progress**: User completes assessment with auto-save
4. **Smart Prompts**: 
   - Account creation prompt at 50% completion
   - Email capture prompt at 80% completion
5. **Completion**: User can view results and optionally create account

### Account Conversion Journey
1. **Prompt Interaction**: User clicks "Save Progress" or similar CTA
2. **Account Creation**: Standard Clerk signup flow with benefits display
3. **Data Preservation**: System automatically converts guest session
4. **Confirmation**: User sees success message confirming data preservation
5. **Enhanced Features**: Access to dashboard, PDFs, and analytics

## Data Retention & Privacy

### Retention Policies
- **Guest sessions without email**: 30 days from last activity
- **Guest sessions with email**: 90 days from email capture
- **Converted sessions**: Permanent (under user account)

### Privacy Compliance
- Anonymous IDs are cryptographically secure
- Email addresses only stored with explicit consent
- Automated cleanup ensures data minimization
- Clear data retention policies communicated to users

### Security Measures
- Secure, httpOnly cookies for session persistence
- CSRF protection on all guest endpoints
- Input validation and sanitization
- Rate limiting on email capture endpoints

## Monitoring & Analytics

### Guest Session Analytics
```typescript
const analytics = await getGuestSessionAnalytics(30);
// Returns completion rates, conversion rates, email capture rates
```

### Key Metrics
- **Completion Rate**: % of guest sessions that finish the audit
- **Email Capture Rate**: % of sessions that provide email addresses
- **Conversion Rate**: % of guest sessions that become user accounts
- **Retention Rate**: % of guest users who return to complete assessment

## Testing

### Manual Testing Scenarios
1. **Guest Flow**: Complete audit without account creation
2. **Email Capture**: Provide email and verify storage
3. **Account Conversion**: Create account mid-audit and verify data preservation
4. **Session Persistence**: Close browser, return, verify progress maintained
5. **Cleanup**: Run cleanup script and verify data removal

### Automated Tests
```bash
# Run guest flow tests
npm test src/test/guest-flow.test.ts

# Run cleanup script tests
npm test src/test/cleanup.test.ts
```

## Deployment Notes

### Database Migration
```bash
# Apply schema changes
npm run db:migrate
```

### Scheduled Cleanup
Set up cron job for regular cleanup:
```cron
# Run cleanup daily at 2 AM
0 2 * * * cd /path/to/app && npm run cleanup:guests -- --force
```

### Monitoring
- Monitor guest session creation rates
- Track conversion and email capture metrics
- Alert on cleanup failures or data retention violations

## Troubleshooting

### Common Issues
1. **Sessions not persisting**: Check cookie settings and domain configuration
2. **Conversion failures**: Verify Clerk user ID format and database constraints
3. **Cleanup not running**: Check admin API key and database permissions

### Debug Commands
```bash
# Check guest session statistics
curl -X GET "/api/admin/cleanup-guest-sessions?olderThanDays=30"

# Test email capture
curl -X POST "/api/guest/save-email" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","sessionId":"session-id"}'
```

## Success Criteria

All acceptance criteria from Task 2.4 have been met:

- ✅ Guest users can complete entire flow without signing up
- ✅ Data persists across browser sessions  
- ✅ Account creation preserves existing progress
- ✅ Email delivery works for guest users
- ✅ Data cleanup follows retention policies

The guest user flow enhancement significantly improves user experience by removing barriers to entry while maintaining data integrity and providing clear paths to account creation when users are ready.