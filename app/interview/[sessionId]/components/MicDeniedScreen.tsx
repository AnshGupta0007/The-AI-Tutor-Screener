'use client'

interface MicDeniedScreenProps {
  onRetry: () => void
  browser: string
}

const BROWSER_INSTRUCTIONS: Record<string, { steps: string[] }> = {
  chrome: {
    steps: [
      'Click the lock icon in your browser address bar',
      'Click "Site settings"',
      'Find "Microphone" and change it to "Allow"',
      'Refresh this page',
    ],
  },
  firefox: {
    steps: [
      'Click the lock icon in your browser address bar',
      'Click the arrow next to "Connection secure"',
      'Click "More Information"',
      'Go to "Permissions" tab and find Microphone',
      'Select "Allow" and close the window',
    ],
  },
  safari: {
    steps: [
      'Open Safari → Settings (or Preferences)',
      'Click "Websites" in the top menu',
      'Find "Microphone" on the left side',
      'Find this website and change it to "Allow"',
    ],
  },
  ios: {
    steps: [
      'Open the Settings app on your iPhone/iPad',
      'Scroll down and tap "Safari"',
      'Under "Settings for Websites", tap "Microphone"',
      'Set it to "Allow"',
      'Return to Safari and refresh this page',
    ],
  },
  edge: {
    steps: [
      'Click the lock icon in your browser address bar',
      'Click "Permissions for this site"',
      'Find "Microphone" and change it to "Allow"',
      'Refresh this page',
    ],
  },
  other: {
    steps: [
      'Look for a microphone or lock icon in your browser address bar',
      'Click it and change microphone permissions to "Allow"',
      'If you cannot find it, try opening your browser settings',
      'Search for "Microphone" or "Site Permissions"',
    ],
  },
}

export default function MicDeniedScreen({ onRetry, browser }: MicDeniedScreenProps) {
  const instructions = BROWSER_INSTRUCTIONS[browser] || BROWSER_INSTRUCTIONS.other

  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-4"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8 text-center"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{ backgroundColor: '#FEF2F2' }}
        >
          <svg
            className="w-8 h-8"
            style={{ color: 'var(--danger)' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
        </div>

        <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          Microphone access needed
        </h2>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          This interview requires your microphone. Here&apos;s how to enable it:
        </p>

        <ol className="text-left space-y-2 mb-8">
          {instructions.steps.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm" style={{ color: 'var(--text-primary)' }}>
              <span
                className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium text-white mt-0.5"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>

        <button
          onClick={onRetry}
          className="w-full h-12 rounded-xl font-semibold text-white transition-all"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          Try Again
        </button>
      </div>
    </div>
  )
}
