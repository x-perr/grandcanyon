'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div style={{ textAlign: 'center', maxWidth: '400px', padding: '2rem' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
              Something went wrong / Une erreur est survenue
            </h2>
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>
              An unexpected error occurred. Please try again.
              <br />
              Une erreur inattendue s&apos;est produite. Veuillez r&eacute;essayer.
            </p>
            <button
              onClick={() => reset()}
              style={{
                padding: '0.5rem 1.5rem',
                backgroundColor: '#0f172a',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Try again / R&eacute;essayer
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
