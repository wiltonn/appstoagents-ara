# ADR-003: Authentication Strategy

## Status
Accepted

## Context
The ARA System needs to support two distinct user flows:
1. **Guest Users**: Users who want to complete the audit without registering
2. **Authenticated Users**: Users who sign up for enhanced features and data persistence

Key requirements:
- Seamless guest experience without forced registration
- Optional account creation with data preservation
- Session persistence across browser refreshes
- Data migration when guests convert to users
- Security for both anonymous and authenticated sessions
- Integration with modern authentication providers

The system must balance user convenience with data security and provide a smooth conversion path from guest to authenticated user.

## Decision
We have implemented a dual authentication strategy using Clerk with custom session management:

### Authentication Architecture

#### 1. Guest User Flow
- **Anonymous Sessions**: Generate UUID-based session identifiers
- **Client Storage**: Store session ID in localStorage for persistence
- **Server Validation**: Validate session ID format and existence
- **Data Association**: All audit data linked to anonymous session ID

#### 2. Authenticated User Flow
- **Clerk Integration**: OAuth providers (Google, GitHub) + email/password
- **JWT Validation**: Server-side JWT token verification
- **User Management**: Centralized user profile and session management
- **Enhanced Features**: Data persistence, history, advanced analytics

#### 3. Session Conversion
- **Data Migration**: Transfer guest session data to user account
- **Session Merging**: Combine multiple guest sessions if applicable
- **Cleanup Process**: Remove anonymous session after successful migration

### Implementation Details

#### tRPC Middleware
```typescript
// Guest or authenticated procedure
export const guestOrAuthProcedure = publicProcedure.use(
  async ({ ctx, next }) => {
    const auth = getAuth(ctx.req);
    
    if (auth.userId) {
      // Authenticated user
      return next({
        ctx: {
          ...ctx,
          user: {
            id: auth.userId,
            type: 'authenticated' as const,
          },
        },
      });
    } else {
      // Guest user - validate session ID
      const sessionId = ctx.req.headers['x-session-id'];
      if (!sessionId || !isValidUUID(sessionId)) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }
      
      return next({
        ctx: {
          ...ctx,
          user: {
            id: sessionId,
            type: 'guest' as const,
          },
        },
      });
    }
  }
);
```

#### Session Management
```typescript
export async function getOrCreateAnonymousSession(sessionId: string) {
  return await db.auditSession.upsert({
    where: { id: sessionId },
    update: { updatedAt: new Date() },
    create: {
      id: sessionId,
      isGuest: true,
      userId: null,
    },
  });
}

export async function getOrCreateUserSession(userId: string) {
  return await db.auditSession.upsert({
    where: { userId_isGuest: { userId, isGuest: false } },
    update: { updatedAt: new Date() },
    create: {
      userId,
      isGuest: false,
    },
  });
}
```

#### Data Migration
```typescript
export async function migrateGuestToUser(guestSessionId: string, userId: string) {
  return await db.$transaction(async (tx) => {
    // Find guest session
    const guestSession = await tx.auditSession.findUnique({
      where: { id: guestSessionId },
      include: { answers: true },
    });
    
    if (!guestSession || !guestSession.isGuest) {
      throw new Error('Guest session not found');
    }
    
    // Create or update user session
    const userSession = await tx.auditSession.upsert({
      where: { userId_isGuest: { userId, isGuest: false } },
      update: {
        responses: guestSession.responses,
        score: guestSession.score,
        currentStep: guestSession.currentStep,
        updatedAt: new Date(),
      },
      create: {
        userId,
        isGuest: false,
        responses: guestSession.responses,
        score: guestSession.score,
        currentStep: guestSession.currentStep,
      },
    });
    
    // Migrate answers
    await tx.auditAnswer.updateMany({
      where: { auditSessionId: guestSessionId },
      data: { auditSessionId: userSession.id },
    });
    
    // Delete guest session
    await tx.auditSession.delete({
      where: { id: guestSessionId },
    });
    
    return userSession;
  });
}
```

## Rationale

### Clerk Selection
- **Developer Experience**: Drop-in authentication with minimal configuration
- **Security**: Enterprise-grade security with OWASP compliance
- **Flexibility**: Supports multiple OAuth providers and custom flows
- **User Management**: Comprehensive dashboard for user administration
- **Scalability**: Handles authentication scaling automatically

### Guest Session Strategy
- **User Experience**: Reduces friction by eliminating forced registration
- **Data Persistence**: Maintains user progress without account requirement
- **Conversion Optimization**: Allows users to see value before committing
- **Privacy Compliance**: Clear data handling for anonymous users

### UUID Session Identifiers
- **Security**: Non-sequential, cryptographically random identifiers
- **Uniqueness**: Globally unique with negligible collision probability
- **Performance**: Efficient indexing and lookup operations
- **Compatibility**: Standard format supported across all platforms

### Dual Procedure Architecture
- **Code Reuse**: Same endpoints support both user types
- **Type Safety**: TypeScript ensures proper user context handling
- **Flexibility**: Easy to add features for specific user types
- **Maintainability**: Centralized authentication logic

## Alternatives Considered

### Authentication Provider Alternatives

1. **NextAuth.js**
   - Pros: Open source, extensive provider support
   - Cons: More configuration required, limited user management UI

2. **Auth0**
   - Pros: Enterprise features, extensive customization
   - Cons: Higher cost, more complex integration

3. **Firebase Auth**
   - Pros: Easy Google integration, real-time features
   - Cons: Vendor lock-in, limited customization

4. **Custom JWT Implementation**
   - Pros: Full control, no vendor dependencies
   - Cons: Security complexity, maintenance overhead

### Session Management Alternatives

1. **Cookies Only**
   - Pros: Automatic handling, security features
   - Cons: CORS complications, size limitations

2. **Session Tokens**
   - Pros: Server-side control, immediate revocation
   - Cons: Additional database queries, scalability concerns

3. **Local Storage + JWT**
   - Pros: Stateless server, offline capability
   - Cons: XSS vulnerabilities, manual token management

### Guest User Alternatives

1. **Forced Registration**
   - Pros: Simpler architecture, guaranteed user data
   - Cons: Higher friction, reduced conversion rates

2. **Trial Accounts**
   - Pros: Full features, easy conversion
   - Cons: Account management complexity, cleanup requirements

3. **No Guest Support**
   - Pros: Simplified user model
   - Cons: Poor user experience, reduced adoption

## Consequences

### Positive Consequences
- **Improved Conversion**: Users can experience full value before registering
- **Security**: Clerk provides enterprise-grade security features
- **Developer Experience**: Type-safe authentication with minimal boilerplate
- **User Experience**: Seamless flow between guest and authenticated states
- **Scalability**: Authentication infrastructure scales automatically
- **Compliance**: Built-in GDPR and privacy controls

### Negative Consequences
- **Complexity**: Dual authentication model requires careful handling
- **Data Migration**: Guest-to-user conversion needs transaction safety
- **Cleanup Requirements**: Guest sessions require regular cleanup
- **Vendor Dependency**: Reliance on Clerk for critical functionality

### Risk Mitigation Strategies

#### Session Security
- **Validation**: Strict UUID format validation for guest sessions
- **Expiration**: Automatic cleanup of inactive guest sessions
- **Rate Limiting**: Prevent session ID enumeration attacks
- **Monitoring**: Track authentication patterns and anomalies

#### Data Protection
- **Encryption**: Sensitive data encrypted at rest and in transit
- **Access Control**: Role-based permissions for authenticated users
- **Audit Logging**: Track data access and modifications
- **Data Retention**: Clear policies for guest data cleanup

#### Vendor Risk
- **Migration Path**: Documented process for moving away from Clerk
- **Backup Authentication**: Emergency authentication bypass procedure
- **Data Export**: Regular backups of user data and configurations
- **Service Monitoring**: Track Clerk service health and performance

## Related Decisions
- [ADR-001: Technology Stack Selection](001-technology-stack-selection.md)
- [ADR-002: Database Schema Design](002-database-schema-design.md)
- [ADR-007: Frontend Architecture](007-frontend-architecture.md)

## References
- [Clerk Documentation](https://clerk.dev/docs)
- [tRPC Authentication](https://trpc.io/docs/authentication)
- [OAuth 2.0 Security Best Practices](https://tools.ietf.org/html/draft-ietf-oauth-security-topics)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)