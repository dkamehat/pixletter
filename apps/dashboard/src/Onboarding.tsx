import React, { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface Props {
  onComplete: () => void;
}

interface Step {
  title: string;
  description: string;
  action: string;
}

const STEPS: Step[] = [
  {
    title: '1. Generate API Key',
    description: 'Create an API key for the Chrome extension to authenticate with your account.',
    action: 'Generate Key',
  },
  {
    title: '2. Install Chrome Extension',
    description: 'Load the extension in Chrome to start tracking emails from Gmail.',
    action: 'Open Instructions',
  },
  {
    title: '3. Send a Test Email',
    description: 'Compose an email in Gmail with tracking enabled to verify everything works.',
    action: 'Go to Gmail',
  },
];

export function Onboarding({ onComplete }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleStep() {
    if (currentStep === 0) {
      setLoading(true);
      try {
        const { authFetch } = await import('./auth');
        const res = await authFetch('/api/keys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Chrome Extension' }),
        });
        if (res.ok) {
          const data = await res.json() as { key: string };
          setApiKey(data.key);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    } else if (currentStep === 1) {
      // Show extension install instructions inline
      setCurrentStep(2);
      return;
    } else if (currentStep === 2) {
      window.open('https://mail.google.com', '_blank');
      onComplete();
      return;
    }
  }

  function nextStep() {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
      setApiKey(null);
      setCopied(false);
    }
  }

  const step = STEPS[currentStep]!;

  return (
    <div style={{ maxWidth: 520, margin: '60px auto', padding: '0 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>🚀</div>
        <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 4 }}>Welcome to mailtrack-pf</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Let&apos;s get you set up in 3 quick steps
        </p>
      </div>

      {/* Progress */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
        {STEPS.map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: i <= currentStep ? '#2563eb' : 'var(--border)',
              transition: 'background 0.3s',
            }}
          />
        ))}
      </div>

      <div className="card">
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>{step.title}</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          {step.description}
        </p>

        {/* Step 1: API Key */}
        {currentStep === 0 && apiKey && (
          <div style={{ marginBottom: 16 }}>
            <div style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '8px 12px',
              fontFamily: 'monospace',
              fontSize: 12,
              wordBreak: 'break-all',
              marginBottom: 8,
            }}>
              {apiKey}
            </div>
            <button
              className="btn"
              style={{ fontSize: 12, padding: '6px 16px', background: copied ? '#16a34a' : undefined }}
              onClick={() => {
                navigator.clipboard.writeText(apiKey);
                setCopied(true);
              }}
            >
              {copied ? 'Copied!' : 'Copy to Clipboard'}
            </button>
            <p style={{ fontSize: 11, color: '#d97706', marginTop: 8 }}>
              Save this key now — it won&apos;t be shown again.
            </p>
          </div>
        )}

        {/* Step 2: Extension instructions */}
        {currentStep === 1 && (
          <ol style={{ fontSize: 13, paddingLeft: 20, lineHeight: 1.8 }}>
            <li>Open <code>chrome://extensions</code> in Chrome</li>
            <li>Enable <strong>Developer mode</strong> (top right toggle)</li>
            <li>Click <strong>Load unpacked</strong></li>
            <li>Select the <code>apps/extension/</code> folder from the repo</li>
            <li>Open the extension popup and paste your API key</li>
          </ol>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {!apiKey && (
            <button className="btn" onClick={handleStep} disabled={loading}>
              {loading ? 'Generating...' : step.action}
            </button>
          )}
          {(apiKey || currentStep > 0) && currentStep < STEPS.length - 1 && (
            <button className="btn" onClick={nextStep}>
              Next Step →
            </button>
          )}
          {currentStep === STEPS.length - 1 && (
            <button className="btn" onClick={handleStep}>
              {step.action}
            </button>
          )}
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <button
          onClick={onComplete}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: 12,
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          Skip setup — go to dashboard
        </button>
      </div>
    </div>
  );
}
