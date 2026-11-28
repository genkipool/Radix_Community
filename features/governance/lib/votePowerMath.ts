import BigNumberBase from 'bignumber.js';
import DecimalBase from 'decimal.js';
import { LSULP_RESOURCE_ADDRESS, XRD_ADDRESS } from './votePowerPools';

/**
 * Arithmetic of the Radix DAO vote collector's snapshot voting power
 * (consultation_v3, apps/vote-collector/src/vote-calculation), ported
 * operation by operation so a recount gives the collector's exact digits.
 *
 * The collector mixes three number types and each one rounds differently:
 * - bignumber.js with its defaults (20 decimal places, ROUND_HALF_UP on
 *   division; addition and multiplication exact) for balances, LSU and LSULP
 *   rates and pool units;
 * - decimal.js at 40 significant digits rounding down, truncated to 18
 *   decimals after every step (Scrypto's I192 Decimal) for CaviarNine bins;
 * - decimal.js at 50 significant digits for Ociswap tick math.
 * Isolated constructors keep any global configuration out of the result.
 */

// Library defaults, written out so no global configuration can leak in.
export const BigNumber = BigNumberBase.clone({ DECIMAL_PLACES: 20, ROUNDING_MODE: BigNumberBase.ROUND_HALF_UP, EXPONENTIAL_AT: [-7, 20] });
export type BigNumber = BigNumberBase;

const DECIMAL_DEFAULTS = { toExpNeg: -7, toExpPos: 21 } as const;
const I192Decimal = DecimalBase.clone({ ...DECIMAL_DEFAULTS, precision: 40, rounding: DecimalBase.ROUND_DOWN });
/** Ociswap tick math (collector's tickCalculator Decimal). */
export const TickDecimal = DecimalBase.clone({ ...DECIMAL_DEFAULTS, precision: 50, rounding: DecimalBase.ROUND_HALF_UP });
type Dec = DecimalBase;

/** What the valuation needs to turn a token into XRD at one ledger state. */
export interface XrdRates {
    /** XRD per LSU (`unit_redemption_value`) for each validator LSU resource. */
    lsuRedemption: Readonly<Record<string, string>>;
    /** XRD per LSULP. */
    lsulpRate: string;
}

/** amount × redemption value, exact (collector's LSU converter). */
export function lsuToXrd(redemptionValue: string, amount: string): string {
    return new BigNumber(redemptionValue).multipliedBy(amount).toFixed();
}

/** XRD per LSULP: `dex_valuation_xrd / total_supply`, 0 when not finite. */
export function lsulpRate(dexValuationXrd: string, totalSupply: string | null | undefined): string {
    const rate = new BigNumber(dexValuationXrd).dividedBy(new BigNumber(totalSupply ?? '0'));
    return rate.isFinite() ? rate.toFixed() : '0';
}

/** XRD equivalent of a token amount: XRD as is, LSU and LSULP converted, anything else 0 (collector's tokenFilter). */
export function convertToXrd(address: string, amount: string, rates: XrdRates): string {
    if (address === XRD_ADDRESS) return amount;
    if (address === LSULP_RESOURCE_ADDRESS) return new BigNumber(rates.lsulpRate).multipliedBy(amount).toFixed();
    const redemption = rates.lsuRedemption[address];
    return redemption === undefined ? '0' : lsuToXrd(redemption, amount);
}

/** Directly held LSUs in XRD, each LSU resource rounded to 2 decimals half up. */
export function lsuHoldingsXrd(balances: Readonly<Record<string, string>>, rates: XrdRates): BigNumber {
    let total = new BigNumber(0);
    for (const [resource, amount] of Object.entries(balances)) {
        const redemption = rates.lsuRedemption[resource];
        if (redemption === undefined) continue;
        total = total.plus(new BigNumber(lsuToXrd(redemption, amount)).decimalPlaces(2));
    }
    return total;
}

/** Underlying amount per pool unit for each pool resource (division at 20 decimals). */
export function poolUnitValues(
    poolBalances: ReadonlyArray<{ resource: string; amount: string }>,
    totalSupply: string,
): Array<{ resource: string; value: string }> {
    const supply = new BigNumber(totalSupply);
    return poolBalances.map(b => ({
        resource: b.resource,
        value: supply.gt(0) ? new BigNumber(b.amount).dividedBy(supply).toFixed() : '0',
    }));
}

/** XRD behind `userLp` pool units of one pool. */
export function poolUnitPositionXrd(
    userLp: string,
    unitValues: ReadonlyArray<{ resource: string; value: string }>,
    rates: XrdRates,
): BigNumber {
    const lp = new BigNumber(userLp);
    if (lp.isZero()) return new BigNumber(0);
    let sum = new BigNumber(0);
    for (const r of unitValues) {
        const userAmount = lp.multipliedBy(r.value);
        sum = sum.plus(convertToXrd(r.resource, userAmount.toFixed(), rates));
    }
    return sum;
}

// ---------------------------------------------------------------------------
// Ociswap precision pools
// ---------------------------------------------------------------------------

const TICK_BASE_SQRT = new TickDecimal('1.000049998750062496094023416993798697');

export const tickToPriceSqrt = (tick: number): Dec => TICK_BASE_SQRT.pow(tick);

const floorToDecimals = (value: Dec, divisibility: number): Dec =>
    value.toDecimalPlaces(Math.max(0, divisibility), TickDecimal.ROUND_DOWN);

/** Token amounts a liquidity position can withdraw at `priceSqrt` (collector's removableAmounts). */
export function removableAmounts(
    liquidity: Dec,
    priceSqrt: Dec,
    leftSqrt: Dec,
    rightSqrt: Dec,
    xDivisibility: number,
    yDivisibility: number,
): [Dec, Dec] {
    if (priceSqrt.lte(leftSqrt)) {
        const x = TickDecimal.max(liquidity.div(leftSqrt).sub(liquidity.div(rightSqrt)), new TickDecimal(0));
        return [floorToDecimals(x, xDivisibility), new TickDecimal(0)];
    }
    if (priceSqrt.gte(rightSqrt)) {
        const y = liquidity.mul(rightSqrt.sub(leftSqrt));
        return [new TickDecimal(0), floorToDecimals(y, yDivisibility)];
    }
    const x = TickDecimal.max(liquidity.div(priceSqrt).sub(liquidity.div(rightSqrt)), new TickDecimal(0));
    const y = liquidity.mul(priceSqrt.sub(leftSqrt));
    return [floorToDecimals(x, xDivisibility), floorToDecimals(y, yDivisibility)];
}

export interface PrecisionPosition { liquidity: string; leftBound: number; rightBound: number }

/** XRD of one Ociswap precision LP position, or null when it holds no liquidity. */
export function precisionPositionXrd(
    position: PrecisionPosition,
    poolPriceSqrt: string,
    pool: { token_x: string; token_y: string; divisibility_x: number; divisibility_y: number },
    rates: XrdRates,
): BigNumber | null {
    const liquidity = new TickDecimal(position.liquidity);
    if (liquidity.isZero()) return null;
    const [x, y] = removableAmounts(
        liquidity,
        new TickDecimal(poolPriceSqrt),
        tickToPriceSqrt(position.leftBound),
        tickToPriceSqrt(position.rightBound),
        pool.divisibility_x,
        pool.divisibility_y,
    );
    return new BigNumber(convertToXrd(pool.token_x, x.toString(), rates)).plus(convertToXrd(pool.token_y, y.toString(), rates));
}

// ---------------------------------------------------------------------------
// CaviarNine shape pools
// ---------------------------------------------------------------------------

/** Scrypto Decimal: 18 decimals, truncated toward zero after every operation. */
export class I192 {
    private static readonly FACTOR = new I192Decimal(10).pow(18);
    private readonly value: Dec;

    constructor(value: string | number | Dec) {
        const v = typeof value === 'string' || typeof value === 'number' ? new I192Decimal(value) : value;
        this.value = I192.truncate(v);
    }

    private static truncate(value: Dec): Dec {
        const m = value.times(I192.FACTOR);
        return (value.isNegative() ? m.ceil() : m.floor()).dividedBy(I192.FACTOR);
    }

    private static operand(other: I192 | string): Dec {
        return I192.truncate(other instanceof I192 ? other.value : new I192Decimal(other));
    }

    static zero(): I192 { return new I192(0); }

    add(other: I192 | string): I192 { return new I192(I192.truncate(this.value.plus(I192.operand(other)))); }

    multiply(other: I192 | string): I192 { return new I192(I192.truncate(this.value.times(I192.operand(other)))); }

    divide(other: I192 | string): I192 {
        const o = I192.operand(other);
        if (o.isZero()) return I192.zero();
        return new I192(I192.truncate(this.value.dividedBy(o)));
    }

    isZero(): boolean { return this.value.isZero(); }

    toString(): string { return this.value.toFixed(18); }
}

export interface ShapePoolState {
    token_x: string;
    token_y: string;
    /** Active bin, undefined when the pool has none. */
    currentTick: number | undefined;
    activeX: string;
    activeY: string;
    activeTotalClaim: string;
    /** Bins by tick (only those some position claims are needed). */
    bins: Readonly<Record<string, { amount: string; totalClaim: string }>>;
}

/** XRD of one CaviarNine liquidity receipt: its claims over bins (collector's computeClaimsXrd). */
export function shapeClaimsXrd(claims: ReadonlyArray<readonly [number, string]>, pool: ShapePoolState, rates: XrdRates): BigNumber {
    const { currentTick } = pool;
    if (currentTick === undefined) return new BigNumber(0);
    const activeTotalClaim = new I192(pool.activeTotalClaim);
    const activeX = new I192(pool.activeX);
    const activeY = new I192(pool.activeY);
    let amountX = I192.zero();
    let amountY = I192.zero();
    for (const [tick, claim] of claims) {
        const raw = pool.bins[String(tick)];
        const bin = raw ? { amount: new I192(raw.amount), totalClaim: new I192(raw.totalClaim) } : undefined;
        if (tick < currentTick && bin) {
            if (bin.totalClaim.isZero()) continue;
            amountY = amountY.add(new I192(claim).divide(bin.totalClaim).multiply(bin.amount));
        } else if (tick > currentTick && bin) {
            if (bin.totalClaim.isZero()) continue;
            amountX = amountX.add(new I192(claim).divide(bin.totalClaim).multiply(bin.amount));
        } else if (tick === currentTick) {
            if (activeTotalClaim.isZero()) continue;
            const share = new I192(claim).divide(activeTotalClaim);
            amountX = amountX.add(activeX.multiply(share));
            amountY = amountY.add(activeY.multiply(share));
        }
    }
    return new BigNumber(convertToXrd(pool.token_x, amountX.toString(), rates)).plus(convertToXrd(pool.token_y, amountY.toString(), rates));
}
