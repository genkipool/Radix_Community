import { m } from 'motion/react';
import { AddressBook } from './AddressBook';

/**
 * Collapsible address book for the wallet profile modal. The content itself
 * lives in the shared `AddressBook` component (one design, one source, used by
 * the console tool too); this wrapper only adds the modal's expand animation.
 */
export function InlineAddressBook({ navT = {} }: { navT?: Record<string, string> }) {
    return (
        <m.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 overflow-hidden"
        >
            <div className="pt-2 pb-4">
                <AddressBook navT={navT} />
            </div>
        </m.div>
    );
}
