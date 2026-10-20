import { describe, it, expect } from 'vitest';
import { parseManifest } from '@/features/dashboard/explorador/utils/parseManifest';

const ACCOUNT = 'account_rdx1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const ORACLE = 'component_rdx1cbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const BADGE = 'resource_rdx1ncccccccccccccccccccccccccccccccccccccccccccccccccccc';
const XRD = 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd';
const TOKEN_A = 'resource_rdx1tddddddddddddddddddddddddddddddddddddddddddddddddddd';
const TOKEN_B = 'resource_rdx1teeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

const priceFeedManifest = `CALL_METHOD
    Address("${ACCOUNT}")
    "lock_fee"
    Decimal("1")
;
CALL_METHOD
    Address("${ACCOUNT}")
    "create_proof_of_non_fungibles"
    Address("${BADGE}")
    Array<NonFungibleLocalId>(
        NonFungibleLocalId("#3#")
    )
;
CALL_METHOD
    Address("${ORACLE}")
    "update_prices"
    Map<Address, Decimal>(
        Address("${XRD}") => Decimal("1"),
        Address("${TOKEN_A}") => Decimal("6949.280200292092635092"),
        Address("${TOKEN_B}") => Decimal("0.0000000001")
    )
;
`;

describe('parseManifest', () => {
    it('reads a price map as oracle updates quoted in the resource priced at 1', () => {
        const parsed = parseManifest(priceFeedManifest);
        expect(parsed.oracleCall).toEqual({ component: ORACLE, method: 'update_prices', reference: XRD });
        expect(parsed.oracleUpdates).toEqual([
            { baseToken: TOKEN_A, quoteToken: XRD, price: '6949.280200292092635092' },
            { baseToken: TOKEN_B, quoteToken: XRD, price: '0.0000000001' },
        ]);
    });

    it('takes the badge from a non-fungible proof, not as the NFT acted on', () => {
        const parsed = parseManifest(priceFeedManifest);
        expect(parsed.badgeResource).toBe(BADGE);
        expect(parsed.badgeNftIds).toEqual(['#3#']);
        expect(parsed.badgeAmount).toBe('1');
        expect(parsed.badgeOrigin).toBe(ACCOUNT);
        expect(parsed.nftId).toBeNull();
    });

    it('names the first call that is not fee or proof plumbing as the action', () => {
        expect(parseManifest(priceFeedManifest).mainAction).toBe('update_prices');
    });

    it('leaves the quote empty when no resource is priced at exactly 1', () => {
        const parsed = parseManifest(priceFeedManifest.replace('Decimal("1"),', 'Decimal("2"),'));
        expect(parsed.oracleCall?.reference).toBeNull();
        expect(parsed.oracleUpdates).toHaveLength(3);
        expect(parsed.oracleUpdates.every((u) => u.quoteToken === '')).toBe(true);
    });

    it('finds no oracle update in an ordinary transfer', () => {
        const parsed = parseManifest(`CALL_METHOD Address("${ACCOUNT}") "withdraw" Address("${XRD}") Decimal("5");
CALL_METHOD Address("${ACCOUNT}") "deposit_batch" Expression("ENTIRE_WORKTOP");`);
        expect(parsed.oracleUpdates).toEqual([]);
        expect(parsed.oracleCall).toBeNull();
        expect(parsed.mainAction).toBeNull();
    });
});
