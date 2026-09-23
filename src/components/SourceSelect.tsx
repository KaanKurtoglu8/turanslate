/**
 * Accessible listbox for the source language, with flags and regional variants
 * grouped beneath their parent language. (A native <select> cannot show flags.)
 */
import {
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type Ref,
} from 'react';
import type { SourceMode } from '../../shared/languages';
import { LANGUAGES, REGIONAL_OPTIONS, sourceFlag, sourceLabel } from '../config/languages';
import { useI18n } from '../i18n/I18nContext';
import { Flag } from './Flag';

export interface SourceSelectHandle {
  /** Focuses the control and opens the list (used by "Değiştir / Change"). */
  open: () => void;
}

interface Option {
  value: SourceMode;
  label: string;
  flag: string | undefined;
  nested: boolean;
  /** Position in the flat keyboard-navigation order. */
  index: number;
}

interface Group {
  heading: { label: string; flag: string | undefined; code: string } | null;
  options: Option[];
}

interface SourceSelectProps {
  value: SourceMode;
  onChange: (value: SourceMode) => void;
  labelId: string;
  disabled?: boolean;
  ref?: Ref<SourceSelectHandle>;
}

export function SourceSelect({ value, onChange, labelId, disabled, ref }: SourceSelectProps) {
  const { lang, t } = useI18n();
  const baseId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const groups = useMemo<Group[]>(() => {
    let next = 0;
    const result: Group[] = [
      {
        heading: null,
        options: [
          { value: 'auto', label: t.autoDetect, flag: undefined, nested: false, index: next++ },
        ],
      },
    ];
    for (const language of LANGUAGES) {
      const regional = REGIONAL_OPTIONS[language.id];
      if (regional) {
        result.push({
          heading: { label: language.labels[lang], flag: language.flagPath, code: language.id },
          options: regional.map((option) => ({
            value: option.sourceId,
            label: option.labels[lang],
            flag: sourceFlag(option.sourceId),
            nested: true,
            index: next++,
          })),
        });
      } else {
        result.push({
          heading: null,
          options: [
            {
              value: language.id,
              label: language.labels[lang],
              flag: language.flagPath,
              nested: false,
              index: next++,
            },
          ],
        });
      }
    }
    return result;
  }, [lang, t.autoDetect]);

  const options = useMemo(() => groups.flatMap((group) => group.options), [groups]);
  const optionId = (index: number) => `${baseId}-opt-${index}`;
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  function openList() {
    setActive(selectedIndex);
    setOpen(true);
  }

  function close(focusButton: boolean) {
    setOpen(false);
    if (focusButton) buttonRef.current?.focus();
  }

  function choose(index: number) {
    const option = options[index];
    if (option) onChange(option.value);
    close(true);
  }

  useImperativeHandle(ref, () => ({
    open: () => {
      buttonRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      buttonRef.current?.focus();
      openList();
    },
  }));

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' });
    // optionId is derived from a stable useId value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active]);

  function onButtonKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openList();
    }
  }

  function onListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const last = options.length - 1;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActive((index) => Math.min(index + 1, last));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActive((index) => Math.max(index - 1, 0));
        break;
      case 'Home':
        event.preventDefault();
        setActive(0);
        break;
      case 'End':
        event.preventDefault();
        setActive(last);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        choose(active);
        break;
      case 'Escape':
        event.preventDefault();
        close(true);
        break;
      case 'Tab':
        close(false);
        break;
    }
  }

  const selected = options[selectedIndex]!;

  return (
    <div className="source-select" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        className="source-select__button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${labelId} ${baseId}-value`}
        disabled={disabled}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={onButtonKeyDown}
      >
        {selected.value === 'auto' ? (
          <span className="source-select__auto-icon" aria-hidden="true">
            ✦
          </span>
        ) : (
          <Flag src={selected.flag} code={selected.value} size="sm" />
        )}
        <span id={`${baseId}-value`} className="source-select__value">
          {selected.value === 'auto' ? t.autoDetect : sourceLabel(selected.value, lang, true)}
        </span>
        <span className="source-select__chevron" aria-hidden="true" />
      </button>

      {open && (
        <div
          ref={listRef}
          className="source-select__list"
          role="listbox"
          tabIndex={-1}
          aria-labelledby={labelId}
          aria-activedescendant={optionId(active)}
          onKeyDown={onListKeyDown}
        >
          {groups.map((group, groupIndex) => {
            const items = group.options.map(({ index, ...option }) => {
              return (
                <div
                  key={option.value}
                  id={optionId(index)}
                  role="option"
                  aria-selected={option.value === value}
                  className={[
                    'source-select__option',
                    option.nested && 'source-select__option--nested',
                    index === active && 'is-active',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onPointerMove={() => setActive(index)}
                  onClick={() => choose(index)}
                >
                  {option.value === 'auto' ? (
                    <span className="source-select__auto-icon" aria-hidden="true">
                      ✦
                    </span>
                  ) : (
                    <Flag src={option.flag} code={option.value} size="sm" />
                  )}
                  <span>{option.label}</span>
                  {option.value === value && (
                    <span className="source-select__check" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </div>
              );
            });
            if (!group.heading) return items;
            const headingId = `${baseId}-group-${groupIndex}`;
            return (
              <div key={headingId} role="group" aria-labelledby={headingId}>
                <div id={headingId} className="source-select__group-heading" role="presentation">
                  <Flag src={group.heading.flag} code={group.heading.code} size="sm" />
                  <span>{group.heading.label}</span>
                </div>
                {items}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
