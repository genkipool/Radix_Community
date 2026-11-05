/**
 * The dApp Toolkit's own `<radix-connect-button>`, mounted hidden.
 *
 * This site draws its own wallet interface, but in dApp Toolkit 2.3.0 the
 * connect button is the only way to cancel a request so that the Radix
 * Connector extension and the wallet are told: the Cancel of its request
 * cards sends `onCancelRequestItem`, and the toolkit cancels that request with
 * them. Sites that show the button (vote.radixdao.org, for one) get that from
 * the cards; here `cancelThroughConnectButton` does what each card's Cancel
 * does.
 *
 * Every toolkit instance binds to the first `<radix-connect-button>` when the
 * button announces itself (`onConnectButtonRender`, as it is connected to the
 * page). Toolkits are created on demand here, so the button is put in again
 * after each one is created, for that one to bind as well.
 */

const TAG = 'radix-connect-button';

/** What the toolkit writes on the button for each request (its `RequestItem`). */
interface ButtonRequestItem {
  interactionId: string;
  status: string;
  showCancel?: boolean;
}

interface ConnectButtonElement extends HTMLElement {
  requestItems?: ButtonRequestItem[];
}

/** Puts the hidden button on the page, or in again, so every toolkit created so far binds to it. */
export function mountConnectButton(): void {
  if (typeof document === 'undefined') return;
  const button = document.querySelector<ConnectButtonElement>(TAG) ?? createButton();
  button.remove();
  document.body.append(button);
}

/**
 * Cancels, as each request card's Cancel does, every request the button
 * shows as pending, so the Radix Connector extension drops it. That includes
 * a transaction the wallet has already received, whose card hides Cancel:
 * the toolkit still cancels it with the extension, while on the phone only
 * the person can reject it.
 */
export function cancelThroughConnectButton(): void {
  if (typeof document === 'undefined') return;
  const button = document.querySelector<ConnectButtonElement>(TAG);
  if (!button) return;
  (button.requestItems ?? [])
    .filter((item) => item.status === 'pending')
    .forEach((item) =>
      button.dispatchEvent(
        new CustomEvent('onCancelRequestItem', { detail: { id: item.interactionId } }),
      ),
    );
}

function createButton(): ConnectButtonElement {
  const button = document.createElement(TAG) as ConnectButtonElement;
  button.setAttribute('aria-hidden', 'true');
  button.style.display = 'none';
  return button;
}
