/**
 * Keyboard Context
 *
 * Provides global keyboard state management for the application.
 * - Updates CSS custom property `--keyboard-height`
 * - Toggles `keyboard-visible` class on body element
 * - Makes keyboard state available to all components via Context
 */

'use client'

import React, { createContext, useContext, useEffect } from 'react'
import { useVirtualKeyboard } from '@/hooks/use-virtual-keyboard'
import type { VirtualKeyboardState } from '@/lib/keyboard/types'

/**
 * Keyboard Context type
 */
type KeyboardContextType = VirtualKeyboardState

/**
 * Create context with undefined default (will be provided by KeyboardProvider)
 */
const KeyboardContext = createContext<KeyboardContextType | undefined>(
  undefined
)

/**
 * KeyboardProvider Props
 */
interface KeyboardProviderProps {
  children: React.ReactNode
}

/**
 * KeyboardProvider Component
 *
 * Wraps the application to provide keyboard state globally.
 * Must be used within a client component.
 *
 * @example
 * ```tsx
 * <KeyboardProvider>
 *   <App />
 * </KeyboardProvider>
 * ```
 */
export function KeyboardProvider({ children }: KeyboardProviderProps) {
  const keyboardState = useVirtualKeyboard()

  // Enable VirtualKeyboard API manual layout mode
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'virtualKeyboard' in navigator && navigator.virtualKeyboard) {
      // Tell browser we'll handle keyboard layout ourselves
      // This enables env(keyboard-inset-height) CSS variable on supported browsers
      navigator.virtualKeyboard.overlaysContent = true
    }

    return () => {
      // Reset to default on cleanup
      if (typeof navigator !== 'undefined' && 'virtualKeyboard' in navigator && navigator.virtualKeyboard) {
        navigator.virtualKeyboard.overlaysContent = false
      }
    }
  }, [])

  useEffect(() => {
    // Only run in browser
    if (typeof document === 'undefined') {
      return
    }

    const { height, visible } = keyboardState

    // Update CSS custom property for keyboard height
    document.documentElement.style.setProperty(
      '--keyboard-height',
      `${height}px`
    )

    // Toggle body class for keyboard visibility
    if (visible) {
      document.body.classList.add('keyboard-visible')
    } else {
      document.body.classList.remove('keyboard-visible')
    }

    // Cleanup function (reset when component unmounts)
    return () => {
      document.documentElement.style.setProperty('--keyboard-height', '0px')
      document.body.classList.remove('keyboard-visible')
    }
  }, [keyboardState])

  return (
    <KeyboardContext.Provider value={keyboardState}>
      {children}
    </KeyboardContext.Provider>
  )
}

/**
 * useKeyboard Hook
 *
 * Access keyboard state from any component within KeyboardProvider.
 *
 * @throws Error if used outside of KeyboardProvider
 * @returns Current keyboard state
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { height, visible, method } = useKeyboard()
 *
 *   return (
 *     <div>
 *       Keyboard height: {height}px
 *       Status: {visible ? 'visible' : 'hidden'}
 *       Method: {method}
 *     </div>
 *   )
 * }
 * ```
 */
export function useKeyboard(): KeyboardContextType {
  const context = useContext(KeyboardContext)

  if (context === undefined) {
    throw new Error('useKeyboard must be used within a KeyboardProvider')
  }

  return context
}
