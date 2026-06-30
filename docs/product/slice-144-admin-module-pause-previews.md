# Slice 144 - Admin Scoped Module Pause Previews

## Goal

Expose the new scoped protocol module pause route in the Admin Dashboard without enabling live admin execution.

## Implemented Direction

- Admin protocol previews now include pause cards for staking, governance, projects, SeedBot, and fee routing.
- Admin protocol previews also include a recovery card that clears all scoped module pause flags.
- Protocol config inspection displays active module pause flags.
- Dashboard remains proposal-only and preview-only; no broadcast or live execution path was added.

## Safety Notes

- Pause previews require a configured admin authority before transaction data is prepared.
- Preview warnings state that scoped pauses do not move funds or bypass wallet approval.
- Production use still requires authority policy, incident review, and public ops logging.
