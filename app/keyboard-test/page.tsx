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

import { useTranslations } from 'next-intl'
import { useKeyboard } from '@/contexts/keyboard-context'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

export default function KeyboardTestPage() {
  const t = useTranslations('debug')
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
        return t('keyboard.methods.virtualKeyboard')
      case 'visualViewport':
        return t('keyboard.methods.visualViewport')
      case 'focus':
        return t('keyboard.methods.focus')
      case 'unsupported':
        return t('keyboard.methods.unsupported')
      default:
        return t('keyboard.methods.unknown')
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
          <h1 className="text-3xl font-bold">{t('keyboard.title')}</h1>
          <p className="text-muted-foreground">
            {t('keyboard.description')}
          </p>
        </div>

        {/* Device Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>{t('keyboard.deviceInfo')}</CardTitle>
            <CardDescription>{t('keyboard.deviceInfoDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('keyboard.userAgent')}:</span>
              <span className="text-right text-xs max-w-xs truncate">
                {typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('keyboard.screenSize')}:</span>
              <span>
                {typeof window !== 'undefined'
                  ? `${window.screen.width} × ${window.screen.height}px`
                  : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('keyboard.windowSize')}:</span>
              <span>
                {typeof window !== 'undefined'
                  ? `${window.innerWidth} × ${window.innerHeight}px`
                  : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('keyboard.viewportHeight')}:</span>
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
            <CardTitle>{t('keyboard.state')}</CardTitle>
            <CardDescription>{t('keyboard.stateDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-muted-foreground">{t('keyboard.detectionMethod')}</Label>
                <div className="font-mono text-sm">{method}</div>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">{t('keyboard.visibility')}</Label>
                <div className="font-mono text-sm">{visible ? 'true' : 'false'}</div>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">{t('keyboard.height')}</Label>
                <div className="font-mono text-sm">{height}px</div>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">{t('keyboard.hasRect')}</Label>
                <div className="font-mono text-sm">{rect ? 'yes' : 'no'}</div>
              </div>
            </div>

            {rect && (
              <>
                <Separator />
                <div>
                  <Label className="text-muted-foreground">{t('keyboard.boundingRect')}</Label>
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
            <CardTitle>{t('keyboard.layoutInfo')}</CardTitle>
            <CardDescription>{t('keyboard.layoutInfoDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('keyboard.gridLayout')}:</span>
              <Badge variant="outline" className="bg-green-500 text-white">{t('keyboard.active')}</Badge>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('keyboard.spacerHeight')}:</span>
              <span className="font-mono">{height}px</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('keyboard.overlaysContent')}:</span>
              <span className="font-mono text-xs">
                {typeof navigator !== 'undefined' && 'virtualKeyboard' in navigator && navigator.virtualKeyboard
                  ? (navigator.virtualKeyboard.overlaysContent ? 'true' : 'false')
                  : 'not supported'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('keyboard.envInsetHeight')}:</span>
              <span className="font-mono text-xs">
                {method === 'virtualKeyboard' ? 'available' : 'not available'}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('keyboard.cssHeight')}:</span>
              <span className="font-mono">{height}px</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('keyboard.bodyClass')}:</span>
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
            <CardTitle>{t('keyboard.testInputs')}</CardTitle>
            <CardDescription>
              {t('keyboard.testInputsDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="test-text">{t('keyboard.textInput')}</Label>
              <Input
                id="test-text"
                type="text"
                placeholder={t('keyboard.focusPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="test-email">{t('keyboard.emailInput')}</Label>
              <Input
                id="test-email"
                type="email"
                placeholder={t('keyboard.emailPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="test-number">{t('keyboard.numberInput')}</Label>
              <Input
                id="test-number"
                type="number"
                placeholder={t('keyboard.numberPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="test-tel">{t('keyboard.phoneInput')}</Label>
              <Input
                id="test-tel"
                type="tel"
                placeholder={t('keyboard.phonePlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="test-url">{t('keyboard.urlInput')}</Label>
              <Input
                id="test-url"
                type="url"
                placeholder={t('keyboard.urlPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="test-search">{t('keyboard.searchInput')}</Label>
              <Input
                id="test-search"
                type="search"
                placeholder={t('keyboard.searchPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="test-textarea">{t('keyboard.textarea')}</Label>
              <Textarea
                id="test-textarea"
                placeholder={t('keyboard.textareaPlaceholder')}
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>{t('keyboard.instructions')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <ol className="list-decimal list-inside space-y-2">
              <li>{t('keyboard.step1')}</li>
              <li>{t('keyboard.step2')}</li>
              <li>{t('keyboard.step3')}</li>
              <li>{t('keyboard.step4')}</li>
              <li>{t('keyboard.step5')}</li>
              <li>{t('keyboard.step6')}</li>
            </ol>
          </CardContent>
        </Card>

        {/* Expected Results */}
        <Card>
          <CardHeader>
            <CardTitle>{t('keyboard.expectedResults')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="bg-green-500">{t('keyboard.virtualKeyboardAPI')}</Badge>
                  <span className="font-semibold">{t('keyboard.androidChrome')}</span>
                </div>
                <p className="text-muted-foreground">
                  {t('keyboard.result1')}
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="bg-blue-500">{t('keyboard.visualViewportAPI')}</Badge>
                  <span className="font-semibold">{t('keyboard.iosSafari')}</span>
                </div>
                <p className="text-muted-foreground">
                  {t('keyboard.result2')}
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="bg-yellow-500">{t('keyboard.focusDetection')}</Badge>
                  <span className="font-semibold">{t('keyboard.olderBrowsers')}</span>
                </div>
                <p className="text-muted-foreground">
                  {t('keyboard.result3')}
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
              {t('keyboard.area')}: {height}px
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
