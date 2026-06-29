import { Navigate } from 'react-router-dom';
import { resolvedLang } from './index';

/** Send the bare root (and any unmatched path) to the active-language home,
 *  e.g. `/#/` → `/#/pt`. Evaluated at render so it reflects the detected/stored
 *  language after i18n init. */
export default function RootRedirect() {
  return <Navigate to={`/${resolvedLang()}`} replace />;
}
