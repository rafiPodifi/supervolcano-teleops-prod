# Security Audit Checklist

## Environment Variables

### ✅ Checklist
- [ ] All Firebase API keys in `.env.local` (NOT in code)
- [ ] Service account keys server-side only (never in frontend)
- [ ] Admin credentials never exposed to frontend
- [ ] `.env.local` in `.gitignore`
- [ ] No secrets in `package.json` or config files
- [ ] Production environment variables set in deployment platform

### Verification
```bash
# Check for exposed secrets
grep -r "FIREBASE_ADMIN_PRIVATE_KEY" src/ --exclude-dir=node_modules
grep -r "AIzaSy" src/ --exclude-dir=node_modules

# Should return no results
```

## API Endpoints Security

### ✅ All Endpoints Must:
- [ ] Verify authentication token
- [ ] Check user role with `requireRole()`
- [ ] Validate `organizationId` matches user's organization
- [ ] Sanitize all user inputs
- [ ] Return appropriate error messages (no sensitive data)
- [ ] Rate limit sensitive endpoints
- [ ] Validate request body with Zod schemas

### Key Endpoints to Audit:
- `/api/v1/locations` - Verify org access
- `/api/v1/locations/[id]` - Verify org access
- `/api/v1/organizations/[id]/dashboard` - Verify org access
- `/api/v1/task-completions` - Verify teleoperator ownership
- `/api/v1/sessions` - Verify org/teleoperator access
- `/api/admin/*` - Verify admin role

## Firestore Security Rules

### ✅ Rules Checklist
- [ ] Organizations: Only admins can write, org users can read their own
- [ ] Locations: Org users can read their org's locations only
- [ ] Tasks: Org users can read their org's tasks only
- [ ] Task Completions: Teleoperators can create for their org only
- [ ] Sessions: Org users can read their org's sessions only
- [ ] Teleoperators: Org managers can read their org's teleoperators

### Deploy and Test
```bash
# Deploy rules
firebase deploy --only firestore:rules --project super-volcano-oem-portal

# Test in Firebase Console > Firestore > Rules playground
```

### Test Cases
1. **Org A user tries to read Org B location**
   - Expected: Permission denied
   
2. **Teleoperator tries to create completion for different org**
   - Expected: Permission denied
   
3. **Manager tries to create task completion**
   - Expected: Permission denied (only teleoperators can)

## Content Security

### ✅ Input Sanitization
- [ ] All user inputs validated with Zod
- [ ] No raw HTML rendering from user input
- [ ] Image URLs validated before display
- [ ] File uploads validated (type, size)
- [ ] SQL injection not applicable (using Firestore)
- [ ] XSS prevention (React escapes by default)

### If Displaying User HTML (Future)
```typescript
import DOMPurify from 'dompurify';
const clean = DOMPurify.sanitize(userInput);
```

## Authentication & Authorization

### ✅ Auth Checks
- [ ] All protected routes check authentication
- [ ] Custom claims verified on every request
- [ ] Token refresh handled correctly
- [ ] Logout clears all session data
- [ ] No sensitive data in JWT tokens
- [ ] Role-based access control enforced

### Role Verification
- [ ] `superadmin` - Full access
- [ ] `admin` - Full access
- [ ] `partner_admin` - Partner-scoped access
- [ ] `org_manager` - Organization-scoped access
- [ ] `teleoperator` - Organization-scoped, task execution only

## Data Privacy

### ✅ Privacy Checklist
- [ ] No PII logged in console (production)
- [ ] Error messages don't expose sensitive data
- [ ] API responses don't leak other orgs' data
- [ ] User data encrypted in transit (HTTPS)
- [ ] Passwords never logged or exposed
- [ ] Session data properly isolated

## Network Security

### ✅ Network Checklist
- [ ] All API calls use HTTPS
- [ ] CORS configured correctly
- [ ] No mixed content (HTTP/HTTPS)
- [ ] Secure headers set (if using middleware)
- [ ] API rate limiting (if applicable)

## Dependencies

### ✅ Dependency Audit
```bash
# Run security audit
npm audit

# Check for known vulnerabilities
npm audit --audit-level=moderate

# Review and update vulnerable packages
npm update <package>
```

## Production Deployment

### ✅ Pre-Deployment Checks
- [ ] Environment variables set in production
- [ ] Firestore rules deployed
- [ ] Storage rules deployed (if using)
- [ ] Build succeeds without errors
- [ ] No console.log statements in production code
- [ ] Error tracking configured (Sentry, etc.)
- [ ] Monitoring and alerts set up

## Security Best Practices

### ✅ General
- [ ] Principle of least privilege enforced
- [ ] Defense in depth (multiple security layers)
- [ ] Fail securely (deny by default)
- [ ] Security updates applied regularly
- [ ] Secrets rotated periodically
- [ ] Access logs reviewed regularly

## Incident Response

### ✅ Preparedness
- [ ] Incident response plan documented
- [ ] Security contact information available
- [ ] Rollback procedure documented
- [ ] Data breach notification process defined

## Sign-Off

**Audited by:** _______________

**Date:** _______________

**Status:** ⬜ PASS  ⬜ FAIL

**Notes:**
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

