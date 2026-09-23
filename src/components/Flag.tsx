import { useState } from 'react';

interface FlagProps {
  src: string | undefined;
  /** Shown as a neutral text badge if the SVG is missing or fails to load. */
  code: string;
  size?: 'sm' | 'md';
}

/** Decorative: the language name is always rendered as text next to it. */
export function Flag({ src, code, size = 'md' }: FlagProps) {
  const [failed, setFailed] = useState(false);
  const className = `flag flag--${size}`;
  if (!src || failed) {
    return (
      <span className={`${className} flag--fallback`} aria-hidden="true">
        {code.slice(0, 2).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      className={className}
      src={src}
      alt=""
      aria-hidden="true"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
