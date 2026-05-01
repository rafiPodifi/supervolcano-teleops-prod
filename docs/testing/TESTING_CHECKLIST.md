# Complete Testing Checklist

## Admin Portal Tests

### Organization Creation
- [ ] Create organization with all fields
- [ ] Create organization with minimal fields (name + manager)
- [ ] Manager account created automatically
- [ ] Temporary password displayed
- [ ] Organization appears in list
- [ ] Can navigate to organization detail

### Organization Management
- [ ] View organization dashboard
- [ ] See team members with correct roles
- [ ] Add additional manager
- [ ] Add teleoperator
- [ ] Remove team member (with confirmation)
- [ ] View locations assigned to org
- [ ] View task completions

### Location Management
- [ ] Create location
- [ ] Assign location to organization
- [ ] Create tasks at location
- [ ] Create instructions with images/videos
- [ ] Edit location details
- [ ] Change organization assignment
- [ ] Delete location (with confirmation)

## Organization Portal Tests

### Manager Access
- [ ] Log in as org_manager
- [ ] Redirects to /org/dashboard
- [ ] Dashboard shows analytics view
- [ ] See all metrics (locations, team, completions)
- [ ] See top performers
- [ ] See recent activity
- [ ] Navigate to Locations
- [ ] View all assigned locations
- [ ] View tasks at locations
- [ ] CANNOT see "Mark Complete" button
- [ ] Navigate to Team
- [ ] See all team members with roles
- [ ] See teleoperator stats
- [ ] Navigate to Task History
- [ ] See all task completions
- [ ] Filter by date range

### Teleoperator Access
- [ ] Log in as teleoperator
- [ ] Redirects to /org/dashboard
- [ ] Dashboard shows task-focused view
- [ ] See personal stats
- [ ] See quick access to locations
- [ ] See own recent tasks
- [ ] Navigate to Locations
- [ ] View assigned locations
- [ ] Click location
- [ ] View tasks
- [ ] Expand task to see instructions
- [ ] See images/videos in instructions
- [ ] See "Mark Complete" button
- [ ] Click "Mark Complete"
- [ ] Modal opens
- [ ] Fill in completion form
- [ ] Submit completion
- [ ] Success feedback
- [ ] Dashboard updates

### Task Completion Flow
- [ ] Complete task with "Completed" status
- [ ] Complete task with "Partial" status (issues required)
- [ ] Complete task with "Issues" status (issues required)
- [ ] Duration validation (must be > 0)
- [ ] Duration comparison shows (over/under estimate)
- [ ] Notes save correctly
- [ ] Issues save correctly
- [ ] Completion appears in manager dashboard
- [ ] Completion appears in teleoperator dashboard
- [ ] Analytics update correctly
- [ ] Task can be completed multiple times (recurring)
- [ ] Completion history shows all completions
- [ ] Session auto-creates on first completion
- [ ] Session updates on subsequent completions

## Cross-Organization Security

### Data Isolation
- [ ] Create 2 organizations: Org A and Org B
- [ ] Assign locations to each
- [ ] Add managers to each
- [ ] Add teleoperators to each
- [ ] Log in as Org A manager
- [ ] See only Org A data
- [ ] Try accessing Org B location by URL
- [ ] Access denied
- [ ] Log in as Org B teleoperator
- [ ] See only Org B locations
- [ ] Try accessing Org A location by URL
- [ ] Access denied
- [ ] Complete task in Org B
- [ ] Completion NOT visible to Org A
- [ ] Org A analytics unchanged

### Firestore Rules
- [ ] Open browser DevTools > Network
- [ ] As Org A user, try Org B location
- [ ] Firestore returns permission denied
- [ ] No data leaked in response
- [ ] Only authorized queries succeed

## Mobile Testing

### Responsive Design (Test on 375px, 768px, 1024px)
- [ ] Admin portal responsive
- [ ] Organization creation form readable
- [ ] Location detail readable
- [ ] Org portal responsive
- [ ] Dashboard readable on mobile
- [ ] Locations list readable
- [ ] Location detail readable
- [ ] Task completion modal works
- [ ] Navigation menu works
- [ ] All interactions work on touch
- [ ] Mobile menu toggles correctly
- [ ] Forms are usable on mobile

## Error Handling

### Network Errors
- [ ] Disconnect network
- [ ] Try loading dashboard
- [ ] Error message shown
- [ ] Retry button works
- [ ] Reconnect network
- [ ] Data loads successfully

### Invalid Data
- [ ] Submit empty form
- [ ] Validation errors shown
- [ ] Submit invalid email
- [ ] Error message clear
- [ ] Submit invalid duration (0)
- [ ] Validation prevents submission
- [ ] Submit completion with end time before start time
- [ ] Validation prevents submission

### Permission Errors
- [ ] Try accessing admin as org user
- [ ] Redirected appropriately
- [ ] Try accessing org portal as admin
- [ ] Redirected appropriately
- [ ] Try completing task as manager
- [ ] Button not visible

## Performance

### Load Times
- [ ] Dashboard loads < 3 seconds
- [ ] Locations list loads < 2 seconds
- [ ] Location detail loads < 3 seconds
- [ ] Task completion submits < 1 second
- [ ] No memory leaks after 10 minutes
- [ ] Skeleton loaders appear immediately
- [ ] Images lazy load correctly

### Build & Production
- [ ] Run `npm run build`
- [ ] Build succeeds with 0 errors
- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] Run `npm start`
- [ ] Production mode works
- [ ] All features functional

## UI/UX Polish

### Loading States
- [ ] Loading spinners appear during data fetch
- [ ] Skeleton loaders for lists
- [ ] No blank screens
- [ ] Smooth transitions

### Empty States
- [ ] Helpful messages when no data
- [ ] Action buttons where appropriate
- [ ] Clear guidance for next steps

### Error States
- [ ] Clear error messages
- [ ] Retry buttons work
- [ ] Error boundaries catch React errors
- [ ] No stack traces in production

### Accessibility
- [ ] Keyboard navigation works
- [ ] Screen reader compatible
- [ ] ARIA labels present
- [ ] Focus indicators visible
- [ ] Color contrast sufficient

## Final Checks

### Console
- [ ] Zero errors in admin portal
- [ ] Zero errors in org portal
- [ ] Zero warnings
- [ ] No 404s in Network tab
- [ ] No permission denied errors

### User Experience
- [ ] Loading states smooth
- [ ] Empty states helpful
- [ ] Error messages clear
- [ ] Success feedback satisfying
- [ ] Transitions smooth
- [ ] No layout shifts
- [ ] Buttons have hover states
- [ ] Forms have focus states
- [ ] Mobile menu works
- [ ] All modals accessible

## Sign-Off

- [ ] All tests passing
- [ ] No console errors
- [ ] Mobile tested
- [ ] Security verified
- [ ] Performance acceptable
- [ ] Ready for deployment

**Tested by:** _______________

**Date:** _______________

**Status:** ⬜ PASS  ⬜ FAIL

