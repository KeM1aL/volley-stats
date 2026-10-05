---
title: Use Activity Component for Show/Hide
impact: MEDIUM
impactDescription: preserves state/DOM
tags: rendering, activity, visibility, state-preservation
---

## Use Activity Component for Show/Hide

Use React's `<Activity>` to preserve state/DOM for expensive components that frequently toggle visibility.

**Requires React 19.2+.** This project is on React 18.3.1, where `Activity` is not exported. Here, preserve state by keeping the component mounted and toggling visibility with CSS (the `hidden` attribute or a class). The example below applies only after a React 19.2 upgrade.

**Usage (React 19.2+):**

```tsx
import { Activity } from 'react'

function Dropdown({ isOpen }: Props) {
  return (
    <Activity mode={isOpen ? 'visible' : 'hidden'}>
      <ExpensiveMenu />
    </Activity>
  )
}
```

Avoids expensive re-renders and state loss.
