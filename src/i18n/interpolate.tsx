import { Fragment, type ReactNode } from 'react';

/** Like `format`, but placeholders may be replaced with React elements. */
export function interpolate(template: string, params: Record<string, ReactNode>): ReactNode[] {
  return template.split(/(\{\w+\})/g).map((part, index) => {
    const key = /^\{(\w+)\}$/.exec(part)?.[1];
    return <Fragment key={index}>{key && key in params ? params[key] : part}</Fragment>;
  });
}
