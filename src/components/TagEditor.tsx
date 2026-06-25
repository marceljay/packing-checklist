import { useId, useState } from 'react';
import { tagKey } from '../types';

interface Props {
  /** Current tag keys. */
  value: string[];
  onChange: (next: string[]) => void;
  /** Known tag keys across the library, offered as autocomplete. */
  suggestions?: string[];
  ariaLabel?: string;
}

/**
 * Chip-based tag input: current tags show as chips with a tiny ✕; typing a label
 * and pressing Enter or comma adds it immediately (normalized, de-duped). Backspace
 * on an empty field removes the last chip. Known tags autocomplete via a datalist.
 */
export default function TagEditor({ value, onChange, suggestions = [], ariaLabel = 'Tags' }: Props) {
  const [input, setInput] = useState('');
  const listId = useId();

  function add(raw: string) {
    const key = tagKey(raw);
    if (key && !value.includes(key)) onChange([...value, key]);
    setInput('');
  }

  function remove(key: string) {
    onChange(value.filter((k) => k !== key));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (input.trim()) add(input);
    } else if (e.key === 'Backspace' && input === '' && value.length > 0) {
      remove(value[value.length - 1]);
    }
  }

  const open = suggestions.filter((s) => !value.includes(s));

  return (
    <div className="input flex flex-wrap items-center gap-1.5">
      {value.map((k) => (
        <span key={k} className="chip bg-airblue-soft text-airblue">
          {k}
          <button
            type="button"
            onClick={() => remove(k)}
            aria-label={`Remove tag ${k}`}
            className="ml-0.5 rounded-full text-airblue/70 hover:text-airblue"
          >
            ✕
          </button>
        </span>
      ))}
      <input
        className="min-w-[6rem] flex-1 border-0 bg-transparent p-0 text-sm focus:outline-none focus:ring-0"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => input.trim() && add(input)}
        placeholder={value.length === 0 ? 'Add tags…' : ''}
        aria-label={ariaLabel}
        list={open.length > 0 ? listId : undefined}
      />
      {open.length > 0 && (
        <datalist id={listId}>
          {open.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </div>
  );
}
