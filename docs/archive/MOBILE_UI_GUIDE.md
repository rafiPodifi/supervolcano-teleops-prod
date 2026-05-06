# Mobile UI Polish Guide

## Overview

This guide shows how to use the new animation components and Heroicons throughout the application.

## Quick Reference

### Animated Components

#### AnimatedButton
```tsx
import AnimatedButton from '@/components/ui/AnimatedButton';
import Icon from '@/components/ui/Icon';

<AnimatedButton 
  variant="primary" 
  size="md" 
  fullWidth={false}
  onClick={handleClick}
>
  <Icon name="check" size="sm" />
  Submit
</AnimatedButton>
```

**Variants:** `primary` | `secondary` | `ghost` | `danger`  
**Sizes:** `sm` | `md` | `lg`

#### AnimatedCard
```tsx
import AnimatedCard from '@/components/ui/AnimatedCard';

<AnimatedCard onClick={handleClick} delay={0.1}>
  <div className="p-4">
    Content here
  </div>
</AnimatedCard>
```

#### AnimatedIconButton
```tsx
import AnimatedIconButton from '@/components/ui/AnimatedIconButton';
import Icon from '@/components/ui/Icon';

<AnimatedIconButton 
  onClick={handleDelete}
  variant="danger"
  size="md"
>
  <Icon name="trash" size="sm" />
</AnimatedIconButton>
```

**Variants:** `ghost` | `primary` | `danger`  
**Sizes:** `sm` | `md` | `lg`

### Animation Wrappers

#### FadeIn
```tsx
import FadeIn from '@/components/animations/FadeIn';

<FadeIn delay={0.1} duration={0.4}>
  <div>Content that fades in</div>
</FadeIn>
```

#### ScaleIn
```tsx
import ScaleIn from '@/components/animations/ScaleIn';

<ScaleIn delay={0.2}>
  <div>Content that scales in</div>
</ScaleIn>
```

### Icon Component

```tsx
import Icon from '@/components/ui/Icon';

<Icon name="home" size="md" className="text-blue-600" />
```

**Available Icons:**
- `home`, `location`, `settings`, `user`
- `plus`, `close`, `check`
- `chevron-right`, `chevron-left`, `chevron-down`, `chevron-up`
- `search`, `bell`, `arrow-right`, `arrow-left`
- `trash`, `edit`, `document`, `clipboard`
- `building`, `calendar`, `clock`
- `photo`, `video`, `chat`, `envelope`, `phone`
- `menu`, `more-vertical`, `filter`, `adjustments`

**Sizes:** `xs` | `sm` | `md` | `lg` | `xl`

### Skeleton Loading

```tsx
import Skeleton from '@/components/ui/Skeleton';

<Skeleton variant="rectangular" className="h-20 w-full" />
<Skeleton variant="circular" className="w-12 h-12" />
<Skeleton variant="text" className="w-3/4" />
```

## Migration Examples

### Before → After

#### Button
```tsx
// Before
<button className="bg-blue-600 text-white px-4 py-2 rounded-lg">
  Submit
</button>

// After
<AnimatedButton variant="primary" size="md">
  <Icon name="check" size="sm" />
  Submit
</AnimatedButton>
```

#### Icon Button
```tsx
// Before
<button onClick={handleDelete}>
  <TrashIcon className="w-5 h-5" />
</button>

// After
<AnimatedIconButton onClick={handleDelete} variant="danger">
  <Icon name="trash" size="sm" />
</AnimatedIconButton>
```

#### Card
```tsx
// Before
<div className="bg-white p-4 rounded-lg shadow">
  {content}
</div>

// After
<AnimatedCard delay={0.1}>
  <div className="p-4">
    {content}
  </div>
</AnimatedCard>
```

#### List Items
```tsx
// Before
{items.map((item) => (
  <div key={item.id}>{item.name}</div>
))}

// After
{items.map((item, index) => (
  <FadeIn key={item.id} delay={index * 0.05}>
    <div>{item.name}</div>
  </FadeIn>
))}
```

## Mobile Navigation

The `MobileNav` component is available for use in mobile layouts:

```tsx
import MobileNav from '@/components/MobileNav';

// Add to your layout
<MobileNav />
```

## Performance Notes

- All animations respect `prefers-reduced-motion`
- Animations are optimized for 60fps on mobile devices
- Framer Motion uses hardware acceleration automatically
- Bundle size impact: ~45kb gzipped

## Accessibility

- All animated components maintain keyboard navigation
- Focus states are preserved
- Screen reader compatibility maintained
- Reduced motion preferences are respected



