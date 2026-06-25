import { TICKET_DESIGNS, setTicketDesign, useTicketDesign } from '../lib/devMode';

/** Dev-only strip (shown when dev mode is on) for trying designs live.
 *  Currently: the boarding-pass "ticket" stock. Visible on the trip page. */
export default function DevBar() {
  const ticket = useTicketDesign();
  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-dashed border-vermilion/40 bg-vermilion-soft/40 px-4 py-2.5 print:hidden">
      <span className="font-mono text-[0.625rem] font-bold uppercase tracking-code text-vermilion-deep">
        Dev · Ticket
      </span>
      <fieldset className="flex flex-wrap items-center gap-1.5">
        <legend className="sr-only">Ticket design</legend>
        {TICKET_DESIGNS.map((d) => (
          <label
            key={d.value}
            className={`chip cursor-pointer border transition-colors ${
              ticket === d.value
                ? 'border-ink bg-ink text-paper-raised'
                : 'border-line bg-paper-raised text-ink-soft hover:border-ink/40'
            }`}
          >
            <input
              type="radio"
              name="ticket-design"
              value={d.value}
              checked={ticket === d.value}
              onChange={() => setTicketDesign(d.value)}
              className="sr-only"
            />
            {d.label}
          </label>
        ))}
      </fieldset>
    </div>
  );
}
