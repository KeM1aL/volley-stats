/**
 * Keyboard Detection Test Page
 *
 * Interactive test page for validating virtual keyboard detection
 * across different devices and browsers.
 *
 * Test on:
 * - Android Chrome 94+ (VirtualKeyboard API)
 * - iOS Safari 13+ (Visual Viewport API)
 * - Firefox Mobile (Visual Viewport API)
 * - Older browsers (Focus detection)
 *
 * Access at: /keyboard-test
 */

'use client'

import { useKeyboard } from '@/contexts/keyboard-context'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

export default function KeyboardTestPage() {
  const keyboardState = useKeyboard()
  const { height, visible, rect, method } = keyboardState

  // Get detection method color
  const getMethodColor = () => {
    switch (method) {
      case 'virtualKeyboard':
        return 'bg-green-500'
      case 'visualViewport':
        return 'bg-blue-500'
      case 'focus':
        return 'bg-yellow-500'
      case 'unsupported':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getMethodLabel = () => {
    switch (method) {
      case 'virtualKeyboard':
        return 'VirtualKeyboard API'
      case 'visualViewport':
        return 'Visual Viewport API'
      case 'focus':
        return 'Focus Detection'
      case 'unsupported':
        return 'Unsupported'
      default:
        return 'Unknown'
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-8">
      {/* Fixed Status Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${visible ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}
                title={visible ? 'Keyboard visible' : 'Keyboard hidden'}
              />
              <span className="font-semibold text-sm">
                Keyboard: {visible ? 'Visible' : 'Hidden'}
              </span>
            </div>
            <Badge variant="outline" className={`${getMethodColor()} text-white`}>
              {getMethodLabel()}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Height: {height}px
            {rect && ` | Top: ${rect.top}px | Width: ${rect.width}px`}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto pt-24 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Virtual Keyboard Test</h1>
          <p className="text-muted-foreground">
            Test keyboard detection across different devices and browsers
          </p>
        </div>

        {/* Device Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Device Information</CardTitle>
            <CardDescription>Current device and browser details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">User Agent:</span>
              <span className="text-right text-xs max-w-xs truncate">
                {typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Screen Size:</span>
              <span>
                {typeof window !== 'undefined'
                  ? `${window.screen.width} × ${window.screen.height}px`
                  : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Window Size:</span>
              <span>
                {typeof window !== 'undefined'
                  ? `${window.innerWidth} × ${window.innerHeight}px`
                  : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Viewport Height:</span>
              <span>
                {typeof window !== 'undefined' && window.visualViewport
                  ? `${window.visualViewport.height}px`
                  : 'N/A'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Keyboard State Card */}
        <Card>
          <CardHeader>
            <CardTitle>Keyboard State</CardTitle>
            <CardDescription>Current virtual keyboard detection details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-muted-foreground">Detection Method</Label>
                <div className="font-mono text-sm">{method}</div>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">Visibility</Label>
                <div className="font-mono text-sm">{visible ? 'true' : 'false'}</div>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">Height</Label>
                <div className="font-mono text-sm">{height}px</div>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">Has Rect</Label>
                <div className="font-mono text-sm">{rect ? 'yes' : 'no'}</div>
              </div>
            </div>

            {rect && (
              <>
                <Separator />
                <div>
                  <Label className="text-muted-foreground">Bounding Rectangle</Label>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-mono">
                    <div>x: {rect.x}px</div>
                    <div>y: {rect.y}px</div>
                    <div>width: {rect.width}px</div>
                    <div>height: {rect.height}px</div>
                    <div>top: {rect.top}px</div>
                    <div>bottom: {rect.bottom}px</div>
                    <div>left: {rect.left}px</div>
                    <div>right: {rect.right}px</div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Layout Information Card */}
        <Card>
          <CardHeader>
            <CardTitle>Layout Information</CardTitle>
            <CardDescription>CSS Grid layout and keyboard space management</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Grid Layout:</span>
              <Badge variant="outline" className="bg-green-500 text-white">Active</Badge>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Keyboard Spacer Height:</span>
              <span className="font-mono">{height}px</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">VirtualKeyboard overlaysContent:</span>
              <span className="font-mono text-xs">
                {typeof navigator !== 'undefined' && 'virtualKeyboard' in navigator && navigator.virtualKeyboard
                  ? (navigator.virtualKeyboard.overlaysContent ? 'true' : 'false')
                  : 'not supported'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">env(keyboard-inset-height):</span>
              <span className="font-mono text-xs">
                {method === 'virtualKeyboard' ? 'available' : 'not available'}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">CSS --keyboard-height:</span>
              <span className="font-mono">{height}px</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Body class keyboard-visible:</span>
              <span className="font-mono text-xs">
                {typeof document !== 'undefined' && document.body.classList.contains('keyboard-visible')
                  ? 'true'
                  : 'false'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Test Inputs Card */}
        <Card>
          <CardHeader>
            <CardTitle>Test Inputs</CardTitle>
            <CardDescription>
              Focus on these inputs to test keyboard detection
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="test-text">Text Input</Label>
              <Input
                id="test-text"
                type="text"
                placeholder="Focus here to show keyboard..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="test-email">Email Input</Label>
              <Input
                id="test-email"
                type="email"
                placeholder="test@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="test-number">Number Input</Label>
              <Input
                id="test-number"
                type="number"
                placeholder="123"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="test-tel">Phone Input</Label>
              <Input
                id="test-tel"
                type="tel"
                placeholder="+1 (555) 000-0000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="test-url">URL Input</Label>
              <Input
                id="test-url"
                type="url"
                placeholder="https://example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="test-search">Search Input</Label>
              <Input
                id="test-search"
                type="search"
                placeholder="Search..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="test-textarea">Textarea</Label>
              <Textarea
                id="test-textarea"
                placeholder="Type multiple lines here..."
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Testing Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <ol className="list-decimal list-inside space-y-2">
              <li>Focus on any input field above</li>
              <li>Observe the status bar at the top update in real-time</li>
              <li>Check the keyboard height value</li>
              <li>Verify the detection method matches your device</li>
              <li>Try rotating your device (portrait ↔ landscape)</li>
              <li>Test in both PWA installed mode and browser</li>
            </ol>
          </CardContent>
        </Card>

        {/* Expected Results */}
        <Card>
          <CardHeader>
            <CardTitle>Expected Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="bg-green-500">VirtualKeyboard API</Badge>
                  <span className="font-semibold">Android Chrome 94+</span>
                </div>
                <p className="text-muted-foreground">
                  Should detect keyboard with exact geometry (DOMRect available)
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="bg-blue-500">Visual Viewport API</Badge>
                  <span className="font-semibold">iOS Safari 13+, Firefox</span>
                </div>
                <p className="text-muted-foreground">
                  Should calculate keyboard height from viewport changes
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="bg-yellow-500">Focus Detection</Badge>
                  <span className="font-semibold">Older Browsers</span>
                </div>
                <p className="text-muted-foreground">
                  Basic detection based on input focus and window resize
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Spacer for keyboard */}
        <div className="h-20" />
      </div>

      {/* Visual Keyboard Height Indicator */}
      {visible && height > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 bg-primary/20 border-t-4 border-primary transition-all duration-300 pointer-events-none"
          style={{ height: `${height}px` }}
        >
          <div className="flex items-center justify-center h-full">
            <div className="bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-semibold">
              Keyboard Area: {height}px
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
