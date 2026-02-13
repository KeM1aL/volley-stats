/**
 * Virtual Keyboard Detection Utilities
 *
 * Implements three detection strategies with automatic fallback:
 * 1. VirtualKeyboard API (Android Chrome 94+) - Most accurate
 * 2. Visual Viewport API (iOS Safari 13+, Firefox) - Good accuracy
 * 3. Focus/Resize detection (Fallback) - Basic detection
 */

import type {
  VirtualKeyboardState,
  KeyboardEventCallback,
  KeyboardDetectorOptions,
} from './types'

/**
 * Default options for keyboard detection
 */
const DEFAULT_OPTIONS: Required<KeyboardDetectorOptions> = {
  debounceDelay: 100,
  minHeightChange: 100,
}

/**
 * Debounce utility for event handlers
 */
function debounce<T extends (...args: any[]) => void>(
  func: T,
  delay: number
): T {
  let timeoutId: NodeJS.Timeout | null = null

  return ((...args: any[]) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      func(...args)
      timeoutId = null
    }, delay)
  }) as T
}

/**
 * Strategy 1: VirtualKeyboard API Detection (Android Chrome 94+)
 *
 * Provides exact keyboard geometry via the VirtualKeyboard API.
 * Most accurate method with direct access to keyboard dimensions.
 */
function createVirtualKeyboardDetector(
  callback: KeyboardEventCallback
): () => void {
  const vk = navigator.virtualKeyboard

  if (!vk) {
    // Error identifier maps to translation key: errors.keyboard.virtualKeyboardNotAvailable
    throw new Error('virtualKeyboardNotAvailable')
  }

  // Enable manual overlay handling - keyboard won't resize viewport
  vk.overlaysContent = true

  const handleGeometryChange = () => {
    const rect = vk.boundingRect
    const height = rect.height
    const visible = height > 0

    callback({
      height,
      visible,
      rect,
      method: 'virtualKeyboard',
    })
  }

  // Listen for keyboard geometry changes
  vk.addEventListener('geometrychange', handleGeometryChange)

  // Initial state
  handleGeometryChange()

  // Return cleanup function
  return () => {
    vk.removeEventListener('geometrychange', handleGeometryChange)
    // Reset to default behavior
    vk.overlaysContent = false
  }
}

/**
 * Strategy 2: Visual Viewport API Detection (iOS Safari 13+, Firefox)
 *
 * Calculates keyboard height from viewport height changes.
 * Good accuracy but doesn't provide exact geometry.
 */
function createVisualViewportDetector(
  callback: KeyboardEventCallback,
  options: Required<KeyboardDetectorOptions>
): () => void {
  const viewport = window.visualViewport

  if (!viewport) {
    // Error identifier maps to translation key: errors.keyboard.visualViewportNotAvailable
    throw new Error('visualViewportNotAvailable')
  }

  let lastHeight = viewport.height
  let initialInnerHeight = window.innerHeight

  const handleViewportChange = debounce(() => {
    const currentHeight = viewport.height
    const keyboardHeight = Math.max(
      0,
      initialInnerHeight - currentHeight
    )

    const visible = keyboardHeight >= options.minHeightChange

    callback({
      height: visible ? keyboardHeight : 0,
      visible,
      rect: null,
      method: 'visualViewport',
    })

    lastHeight = currentHeight
  }, options.debounceDelay)

  // Listen for viewport resize and scroll events
  viewport.addEventListener('resize', handleViewportChange)
  viewport.addEventListener('scroll', handleViewportChange)

  // Also listen for window resize (orientation changes)
  const handleOrientationChange = () => {
    initialInnerHeight = window.innerHeight
    handleViewportChange()
  }
  window.addEventListener('resize', handleOrientationChange)

  // Initial state
  handleViewportChange()

  // Return cleanup function
  return () => {
    viewport.removeEventListener('resize', handleViewportChange)
    viewport.removeEventListener('scroll', handleViewportChange)
    window.removeEventListener('resize', handleOrientationChange)
  }
}

/**
 * Strategy 3: Focus/Resize Detection (Fallback)
 *
 * Basic detection using focus events and window resize.
 * Less reliable but works on older browsers.
 */
function createFocusResizeDetector(
  callback: KeyboardEventCallback,
  options: Required<KeyboardDetectorOptions>
): () => void {
  let initialHeight = window.innerHeight
  let isInputFocused = false

  const updateState = debounce(() => {
    const currentHeight = window.innerHeight
    const heightDiff = initialHeight - currentHeight

    // Only consider keyboard visible if an input is focused AND height changed significantly
    const visible = isInputFocused && heightDiff >= options.minHeightChange

    callback({
      height: visible ? Math.max(0, heightDiff) : 0,
      visible,
      rect: null,
      method: 'focus',
    })
  }, options.debounceDelay)

  const handleFocus = (event: FocusEvent) => {
    const target = event.target as HTMLElement

    // Check if focused element is an input
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target.isContentEditable
    ) {
      isInputFocused = true
      // Update initial height when input is focused
      initialHeight = window.innerHeight
      // Delay state update to allow keyboard animation
      setTimeout(updateState, 300)
    }
  }

  const handleBlur = () => {
    isInputFocused = false
    updateState()
  }

  const handleResize = () => {
    if (isInputFocused) {
      updateState()
    } else {
      // Update baseline height when not focused
      initialHeight = window.innerHeight
    }
  }

  // Listen for focus/blur on all inputs
  document.addEventListener('focusin', handleFocus, true)
  document.addEventListener('focusout', handleBlur, true)

  // Listen for window resize
  window.addEventListener('resize', handleResize)

  // Initial state - keyboard not visible
  callback({
    height: 0,
    visible: false,
    rect: null,
    method: 'focus',
  })

  // Return cleanup function
  return () => {
    document.removeEventListener('focusin', handleFocus, true)
    document.removeEventListener('focusout', handleBlur, true)
    window.removeEventListener('resize', handleResize)
  }
}

/**
 * Main factory function that creates the appropriate keyboard detector
 *
 * Automatically selects the best available detection method:
 * 1. VirtualKeyboard API (if available)
 * 2. Visual Viewport API (if available)
 * 3. Focus/Resize detection (fallback)
 * 4. Unsupported (no detection available)
 *
 * @param callback - Function to call when keyboard state changes
 * @param options - Configuration options
 * @returns Cleanup function to remove event listeners
 */
export function createKeyboardDetector(
  callback: KeyboardEventCallback,
  options: KeyboardDetectorOptions = {}
): () => void {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options }

  // Strategy 1: Try VirtualKeyboard API (Android Chrome 94+)
  if (typeof navigator !== 'undefined' && 'virtualKeyboard' in navigator) {
    try {
      return createVirtualKeyboardDetector(callback)
    } catch (error) {
      console.warn('VirtualKeyboard API failed, falling back:', error)
    }
  }

  // Strategy 2: Try Visual Viewport API (iOS Safari 13+, Firefox)
  if (typeof window !== 'undefined' && 'visualViewport' in window) {
    try {
      return createVisualViewportDetector(callback, mergedOptions)
    } catch (error) {
      console.warn('Visual Viewport API failed, falling back:', error)
    }
  }

  // Strategy 3: Focus/Resize fallback (older browsers)
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    try {
      return createFocusResizeDetector(callback, mergedOptions)
    } catch (error) {
      console.warn('Focus/Resize detection failed:', error)
    }
  }

  // No detection available
  console.warn('No keyboard detection method available')
  callback({
    height: 0,
    visible: false,
    rect: null,
    method: 'unsupported',
  })

  // Return no-op cleanup function
  return () => {}
}
