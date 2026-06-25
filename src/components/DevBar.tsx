import { TICKET_DESIGNS, setTicketDesign, useTicketDesign } from '../lib/devMode';

/** Dev-only strip (shown when dev mode is on) for trying designs live: the
 *  boarding-pass "ticket" stock. Rendered in the app shell, so it appears on
 *  every page for consistent theme testing. */
export default function DevBar() {
  const ticket = useTicketDesign();
  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-dashed border-vermilion/40 bg-vermilion-soft/40 px-4 py-2.5 print:hidden">
      <Group label="Ticket" legend="Ticket design">
        {TICKET_DESIGNS.map((d) => (
          <Swatch
            key={d.value}
            name="ticket-design"
            label={d.label}
            checked={ticket === d.value}
            onChange={() => setTicketDesign(d.value)}
          />
        ))}
      </Group>
    </div>
  );
}

function Group({
  label,
  legend,
  children,
}: {
  label: string;
  legend: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="font-mono text-[0.625rem] font-bold uppercase tracking-code text-vermilion-deep">
        Dev · {label}
      </span>
      <fieldset className="flex flex-wrap items-center gap-1.5">
        <legend className="sr-only">{legend}</legend>
        {children}
      </fieldset>
    </div>
  );
}

function Swatch({
  name,
  label,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={`chip cursor-pointer border transition-colors ${
        checked
          ? 'border-ink bg-ink text-paper-raised'
          : 'border-line bg-paper-raised text-ink-soft hover:border-ink/40'
      }`}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      {label}
    </label>
  );
}
