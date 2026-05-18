import { useState, useCallback, useEffect } from 'preact/hooks';
import type { FunctionalComponent } from 'preact';
import { render } from 'preact';

export type BannerState = {
  currentLang: 'original' | 'translated';
  isLoading: boolean;
};

type Props = {
  onToggle: () => void;
  onRetranslate: () => void;
  initialState: BannerState;
  forwardedRef?: (api: BannerImperativeAPI) => void;
};

export type BannerImperativeAPI = {
  setState: (updater: (prev: BannerState) => BannerState) => void;
  closeBanner: () => void;
};

const Banner: FunctionalComponent<Props> = ({ onToggle, onRetranslate, initialState, forwardedRef }) => {
  const [state, setState] = useState<BannerState>(initialState);

  const handleToggle = useCallback(() => {
    setState((prev) => ({ ...prev, currentLang: prev.currentLang === 'original' ? 'translated' : 'original' }));
    onToggle();
  }, [onToggle]);

  const handleRetranslate = useCallback(() => {
    setState((prev) => ({ ...prev, isLoading: true }));
    onRetranslate();
  }, [onRetranslate]);

  const closeBanner = useCallback(() => {
    setState((prev) => ({ ...prev, isLoading: false }));
  }, []);

  useEffect(() => {
    if (forwardedRef) {
      forwardedRef({ setState, closeBanner });
    }
  }, [forwardedRef, closeBanner]);

  return (
    <div className="inkwell-banner">
      <span className="inkwell-title">Inkwell Translation</span>
      <div className="inkwell-buttons">
        <button onClick={handleToggle} disabled={state.isLoading} className="inkwell-btn inkwell-btn-primary">
          {state.currentLang === 'translated' ? '原文' : '译文'}
        </button>
        <button onClick={handleRetranslate} disabled={state.isLoading} className="inkwell-btn inkwell-btn-secondary">
          {state.isLoading ? (
            <>
              <span className="inkwell-spinner" />
              翻譯中...
            </>
          ) : (
            '重新翻譯'
          )}
        </button>
      </div>
    </div>
  );
};

const BANNER_STYLES = `
  @media (prefers-color-scheme: dark) {
    .inkwell-banner {
      --iw-bg: #1a1a2e;
      --iw-text: #eee;
      --iw-btn-bg: #3b82f6;
      --iw-btn-text: #fff;
      --iw-btn-secondary-bg: #4b5563;
      --iw-btn-secondary-text: #fff;
      --iw-border: rgba(255,255,255,0.1);
    }
  }
  @media (prefers-color-scheme: light) {
    .inkwell-banner {
      --iw-bg: #ffffff;
      --iw-text: #111827;
      --iw-btn-bg: #3b82f6;
      --iw-btn-text: #fff;
      --iw-btn-secondary-bg: #e5e7eb;
      --iw-btn-secondary-text: #374151;
      --iw-border: rgba(0,0,0,0.1);
    }
  }
  .inkwell-banner {
    position: sticky;
    top: 0;
    z-index: 2147483647;
    background: var(--iw-bg);
    color: var(--iw-text);
    padding: 10px 16px;
    font-size: 14px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: center;
    border-bottom: 1px solid var(--iw-border);
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    opacity: 0;
    transform: translateY(-20px);
    animation: inkwell-slide-in 0.3s ease forwards;
  }
  @keyframes inkwell-slide-in {
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .inkwell-banner.inkwell-closing {
    animation: inkwell-slide-out 0.3s ease forwards;
  }
  @keyframes inkwell-slide-out {
    to {
      opacity: 0;
      transform: translateY(-20px);
    }
  }
  .inkwell-title {
    font-weight: 600;
    margin-right: auto;
  }
  .inkwell-buttons {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .inkwell-btn {
    border: none;
    padding: 5px 14px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: opacity 0.15s, transform 0.1s;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .inkwell-btn:active {
    transform: scale(0.96);
  }
  .inkwell-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .inkwell-btn-primary {
    background: var(--iw-btn-bg);
    color: var(--iw-btn-text);
  }
  .inkwell-btn-secondary {
    background: var(--iw-btn-secondary-bg);
    color: var(--iw-btn-secondary-text);
  }
  .inkwell-spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: currentColor;
    border-radius: 50%;
    animation: inkwell-spin 0.8s linear infinite;
  }
  @keyframes inkwell-spin {
    to { transform: rotate(360deg); }
  }
`;

let _bannerRoot: HTMLElement | null = null;
let _shadowApi: BannerImperativeAPI | null = null;

export function mountInkwellBanner(props: Omit<Props, 'forwardedRef'>): void {
  if (_bannerRoot) return;

  const host = document.createElement('div');
  host.id = 'inkwell-toggle-host';
  // Use closed shadow DOM to prevent host page JS from traversing inside
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = BANNER_STYLES;
  shadow.appendChild(style);

  const root = document.createElement('div');
  root.id = 'inkwell-toggle-root';
  shadow.appendChild(root);

  document.body.prepend(host);
  _bannerRoot = host;

  const apiRef = (api: BannerImperativeAPI) => {
    _shadowApi = api;
  };

  render(<Banner {...props} forwardedRef={apiRef} />, root);
}

export function unmountInkwellBanner(): void {
  if (!_bannerRoot) return;
  _bannerRoot.remove();
  _bannerRoot = null;
  _shadowApi = null;
}

export function updateInkwellBanner(state: Partial<BannerState>): void {
  if (_shadowApi) {
    _shadowApi.setState((prev: BannerState) => ({ ...prev, ...state }));
  }
}

export function hideInkwellBanner(): void {
  if (_shadowApi) {
    // Add closing animation class - we'd need to access shadow DOM element
    // For simplicity, just close and remove after animation
    _shadowApi.closeBanner();
  }
  // Remove after animation completes
  setTimeout(() => {
    if (_bannerRoot) {
      _bannerRoot.remove();
      _bannerRoot = null;
      _shadowApi = null;
    }
  }, 300);
}
