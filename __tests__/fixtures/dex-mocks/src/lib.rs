//! Test doubles of the DEX components the console adds liquidity through.
//!
//! Each blueprint has the name, the public methods and the state fields the
//! console reads from the real one (Ociswap `BasicPool`, `Pool` and
//! `PrecisionPool`, DefiPlaza `PlazaPair`), so the console's lookups and
//! manifests can be checked on resim and on Stokenet, where those DEXes are
//! not deployed. The pricing is simplified; the interfaces are not:
//!
//! - native pools are guarded by the component's caller badge, as the real
//!   ones are, so only the component can contribute;
//! - Precision positions are NFTs minted by the component, named in the LP
//!   collection's `pool` metadata, with fees claimable without closing them.
//!
//! Not for real funds: `add_fees` and `set_shortage` exist only to put the
//! components in the states the tests need.

use scrypto::prelude::*;

/// Pool unit address of a native pool, from its `pool_unit` metadata.
fn pool_unit_of(pool: &Global<TwoResourcePool>) -> ResourceAddress {
    let unit: GlobalAddress = pool.get_metadata("pool_unit").unwrap().unwrap();
    ResourceAddress::try_from(unit).unwrap()
}

fn sorted(a: ResourceAddress, b: ResourceAddress) -> (ResourceAddress, ResourceAddress) {
    if a < b {
        (a, b)
    } else {
        (b, a)
    }
}

/// Constant-product swap through a native pool the component manages.
fn swap_through(pool: &mut Global<TwoResourcePool>, input: Bucket, fee_rate: Decimal) -> Bucket {
    let amounts = pool.get_vault_amounts();
    let input_address = input.resource_address();
    let (output_address, output_reserve) = amounts
        .iter()
        .find(|(address, _)| **address != input_address)
        .map(|(address, amount)| (*address, *amount))
        .unwrap();
    let input_reserve = *amounts.get(&input_address).expect("Token not in this pool");
    let net = input.amount() * (Decimal::ONE - fee_rate);
    let output = output_reserve * net / (input_reserve + net);
    pool.protected_deposit(input.as_fungible());
    pool.protected_withdraw(output_address, output, WithdrawStrategy::Rounded(RoundingMode::ToZero))
        .into()
}

#[derive(ScryptoSbor, Clone, Copy, PartialEq, Eq, Debug)]
pub enum Shortage {
    BaseShortage,
    Equilibrium,
    QuoteShortage,
}

#[derive(ScryptoSbor, Clone, Copy)]
pub struct PairState {
    pub shortage: Shortage,
}

#[derive(ScryptoSbor, NonFungibleData)]
pub struct LiquidityPosition {
    pub liquidity: PreciseDecimal,
    pub left_bound: i32,
    pub right_bound: i32,
    pub x_amount: Decimal,
    pub y_amount: Decimal,
    #[mutable]
    pub x_fee_checkpoint: PreciseDecimal,
    #[mutable]
    pub y_fee_checkpoint: PreciseDecimal,
}

const TICK_BASE_SQRT: PreciseDecimal = pdec!("1.000049998750062496094023416993798697");
const MAX_TICK: i32 = 887272;

#[blueprint]
mod basic_pool {
    struct BasicPool {
        x_address: ResourceAddress,
        y_address: ResourceAddress,
        input_fee_rate: Decimal,
        liquidity_pool: Global<TwoResourcePool>,
    }

    impl BasicPool {
        pub fn instantiate(a: ResourceAddress, b: ResourceAddress) -> Global<BasicPool> {
            let (x_address, y_address) = sorted(a, b);
            let (reservation, address) = Runtime::allocate_component_address(BasicPool::blueprint_id());
            let rule = rule!(require(global_caller(address)));
            let liquidity_pool =
                Blueprint::<TwoResourcePool>::instantiate(OwnerRole::Fixed(rule.clone()), rule, (x_address, y_address), None);
            Self { x_address, y_address, input_fee_rate: dec!("0.003"), liquidity_pool }
                .instantiate()
                .prepare_to_globalize(OwnerRole::None)
                .with_address(reservation)
                .globalize()
        }

        pub fn add_liquidity(&mut self, a_bucket: Bucket, b_bucket: Bucket) -> (Bucket, Option<Bucket>) {
            let (x, y) = if a_bucket.resource_address() == self.x_address { (a_bucket, b_bucket) } else { (b_bucket, a_bucket) };
            let (units, remainder) = self.liquidity_pool.contribute((x.as_fungible(), y.as_fungible()));
            (units.into(), remainder.map(|r| r.into()))
        }

        pub fn remove_liquidity(&mut self, lp_token: Bucket) -> (Bucket, Bucket) {
            let (a, b) = self.liquidity_pool.redeem(lp_token.as_fungible());
            (a.into(), b.into())
        }

        pub fn swap(&mut self, input_bucket: Bucket) -> Bucket {
            swap_through(&mut self.liquidity_pool, input_bucket, self.input_fee_rate)
        }

        pub fn liquidity_pool(&self) -> Global<TwoResourcePool> {
            self.liquidity_pool
        }
    }
}

#[blueprint]
mod flex_pool {
    struct Pool {
        x_address: ResourceAddress,
        y_address: ResourceAddress,
        input_fee_rate: Decimal,
        liquidity_pool: Global<TwoResourcePool>,
        lp_manager: ResourceAddress,
    }

    impl Pool {
        pub fn instantiate(a: ResourceAddress, b: ResourceAddress) -> Global<Pool> {
            let (x_address, y_address) = sorted(a, b);
            let (reservation, address) = Runtime::allocate_component_address(Pool::blueprint_id());
            let rule = rule!(require(global_caller(address)));
            let liquidity_pool =
                Blueprint::<TwoResourcePool>::instantiate(OwnerRole::Fixed(rule.clone()), rule, (x_address, y_address), None);
            let lp_manager = pool_unit_of(&liquidity_pool);
            Self { x_address, y_address, input_fee_rate: dec!("0.003"), liquidity_pool, lp_manager }
                .instantiate()
                .prepare_to_globalize(OwnerRole::None)
                .with_address(reservation)
                .globalize()
        }

        pub fn add_liquidity(&mut self, a_bucket: Bucket, b_bucket: Bucket) -> (Bucket, Option<Bucket>) {
            let (x, y) = if a_bucket.resource_address() == self.x_address { (a_bucket, b_bucket) } else { (b_bucket, a_bucket) };
            let (units, remainder) = self.liquidity_pool.contribute((x.as_fungible(), y.as_fungible()));
            (units.into(), remainder.map(|r| r.into()))
        }

        pub fn remove_liquidity(&mut self, lp_token: Bucket) -> (Bucket, Bucket) {
            let (a, b) = self.liquidity_pool.redeem(lp_token.as_fungible());
            (a.into(), b.into())
        }

        pub fn swap(&mut self, input_bucket: Bucket) -> Bucket {
            swap_through(&mut self.liquidity_pool, input_bucket, self.input_fee_rate)
        }
    }
}

#[blueprint]
mod plaza_pair {
    struct PlazaPair {
        state: PairState,
        base_address: ResourceAddress,
        quote_address: ResourceAddress,
        base_pool: Global<TwoResourcePool>,
        quote_pool: Global<TwoResourcePool>,
    }

    impl PlazaPair {
        pub fn instantiate(base_address: ResourceAddress, quote_address: ResourceAddress) -> Global<PlazaPair> {
            let (reservation, address) = Runtime::allocate_component_address(PlazaPair::blueprint_id());
            let rule = rule!(require(global_caller(address)));
            let base_pool = Blueprint::<TwoResourcePool>::instantiate(
                OwnerRole::Fixed(rule.clone()),
                rule.clone(),
                (base_address, quote_address),
                None,
            );
            let quote_pool = Blueprint::<TwoResourcePool>::instantiate(
                OwnerRole::Fixed(rule.clone()),
                rule,
                (quote_address, base_address),
                None,
            );
            Self { state: PairState { shortage: Shortage::Equilibrium }, base_address, quote_address, base_pool, quote_pool }
                .instantiate()
                .prepare_to_globalize(OwnerRole::None)
                .with_address(reservation)
                .globalize()
        }

        /// As DefiPlaza: one token to its side's pool; the other token only when that side is short.
        pub fn add_liquidity(&mut self, input_bucket: Bucket, co_liquidity_bucket: Option<Bucket>) -> (Bucket, Option<Bucket>) {
            let is_quote = input_bucket.resource_address() == self.quote_address;
            let in_shortage = self.state.shortage == if is_quote { Shortage::QuoteShortage } else { Shortage::BaseShortage };
            let other = if is_quote { self.base_address } else { self.quote_address };
            let pool = if is_quote { &mut self.quote_pool } else { &mut self.base_pool };
            let co = if in_shortage {
                co_liquidity_bucket.expect("In shortage: co-liquidity required.")
            } else {
                assert!(co_liquidity_bucket.is_none(), "Not in shortage: no co-liquidity needed.");
                Bucket::new(other)
            };
            let (units, remainder) = pool.contribute((input_bucket.as_fungible(), co.as_fungible()));
            (units.into(), remainder.map(|r| r.into()))
        }

        pub fn remove_liquidity(&mut self, lp_bucket: Bucket, is_quote: bool) -> (Bucket, Bucket) {
            let pool = if is_quote { &mut self.quote_pool } else { &mut self.base_pool };
            let (a, b) = pool.redeem(lp_bucket.as_fungible());
            (a.into(), b.into())
        }

        /// Test only: puts the other token into a side's pool and marks that side short, as trading would.
        pub fn set_shortage(&mut self, is_quote: bool, other_tokens: Bucket) {
            let pool = if is_quote { &mut self.quote_pool } else { &mut self.base_pool };
            pool.protected_deposit(other_tokens.as_fungible());
            self.state.shortage = if is_quote { Shortage::QuoteShortage } else { Shortage::BaseShortage };
        }
    }
}

#[blueprint]
mod precision_pool {
    struct PrecisionPool {
        x_liquidity: Vault,
        y_liquidity: Vault,
        x_fees: Vault,
        y_fees: Vault,
        tick_spacing: u32,
        price_sqrt: PreciseDecimal,
        lp_manager: NonFungibleResourceManager,
        lp_counter: u64,
        total_liquidity: PreciseDecimal,
        x_fee_growth: PreciseDecimal,
        y_fee_growth: PreciseDecimal,
    }

    impl PrecisionPool {
        pub fn instantiate(
            a: ResourceAddress,
            b: ResourceAddress,
            price_sqrt: PreciseDecimal,
            tick_spacing: u32,
            seed_a: Bucket,
            seed_b: Bucket,
        ) -> Global<PrecisionPool> {
            let (x_address, y_address) = sorted(a, b);
            let (reservation, address) = Runtime::allocate_component_address(PrecisionPool::blueprint_id());
            let rule = rule!(require(global_caller(address)));
            let lp_manager = ResourceBuilder::new_integer_non_fungible::<LiquidityPosition>(OwnerRole::None)
                .metadata(metadata!(init {
                    "name" => "Test Precision LP", locked;
                    "pool" => GlobalAddress::from(address), locked;
                }))
                .mint_roles(mint_roles!(minter => rule.clone(); minter_updater => rule!(deny_all);))
                .burn_roles(burn_roles!(burner => rule.clone(); burner_updater => rule!(deny_all);))
                .non_fungible_data_update_roles(non_fungible_data_update_roles!(
                    non_fungible_data_updater => rule; non_fungible_data_updater_updater => rule!(deny_all);
                ))
                .create_with_no_initial_supply();
            // The seed keeps both vaults non-empty, so the ledger lists both tokens for the pool.
            let (seed_x, seed_y) = if seed_a.resource_address() == x_address { (seed_a, seed_b) } else { (seed_b, seed_a) };
            assert!(seed_x.resource_address() == x_address && seed_y.resource_address() == y_address, "Seed tokens do not match");
            Self {
                x_liquidity: Vault::with_bucket(seed_x),
                y_liquidity: Vault::with_bucket(seed_y),
                x_fees: Vault::new(x_address),
                y_fees: Vault::new(y_address),
                tick_spacing,
                price_sqrt,
                lp_manager,
                lp_counter: 0,
                total_liquidity: PreciseDecimal::ZERO,
                x_fee_growth: PreciseDecimal::ZERO,
                y_fee_growth: PreciseDecimal::ZERO,
            }
            .instantiate()
            .prepare_to_globalize(OwnerRole::None)
            .with_address(reservation)
            .globalize()
        }

        /// Concentrated liquidity as Precision pools take it: what the range needs at the current price, the rest back.
        pub fn add_liquidity(&mut self, left_bound: i32, right_bound: i32, mut x_bucket: Bucket, mut y_bucket: Bucket) -> (Bucket, Bucket, Bucket) {
            assert!(left_bound >= -MAX_TICK && right_bound <= MAX_TICK, "Bound outside the allowed range.");
            let spacing = self.tick_spacing as i32;
            let (left, right) = ((left_bound / spacing) * spacing, (right_bound / spacing) * spacing);
            assert!(left < right, "Left bound must be smaller than the right bound.");
            assert!(x_bucket.resource_address() == self.x_liquidity.resource_address(), "Wrong X token.");
            assert!(y_bucket.resource_address() == self.y_liquidity.resource_address(), "Wrong Y token.");

            let sa = TICK_BASE_SQRT.checked_powi(left.into()).unwrap();
            let sb = TICK_BASE_SQRT.checked_powi(right.into()).unwrap();
            let sp = self.price_sqrt;
            let x = PreciseDecimal::from(x_bucket.amount());
            let y = PreciseDecimal::from(y_bucket.amount());
            let (liquidity, x_used, y_used) = if sp <= sa {
                let l = x * sa * sb / (sb - sa);
                (l, x, PreciseDecimal::ZERO)
            } else if sp >= sb {
                (y / (sb - sa), PreciseDecimal::ZERO, y)
            } else {
                let lx = x * sp * sb / (sb - sp);
                let ly = y / (sp - sa);
                let l = if lx < ly { lx } else { ly };
                (l, l * (sb - sp) / (sp * sb), l * (sp - sa))
            };
            assert!(liquidity > PreciseDecimal::ZERO, "No liquidity added.");
            let to_dec = |v: PreciseDecimal| v.checked_truncate(RoundingMode::ToZero).unwrap();
            let (x_used, y_used) = (to_dec(x_used).min(x_bucket.amount()), to_dec(y_used).min(y_bucket.amount()));
            self.x_liquidity.put(x_bucket.take(x_used));
            self.y_liquidity.put(y_bucket.take(y_used));

            self.lp_counter += 1;
            self.total_liquidity += liquidity;
            let position = self.lp_manager.mint_non_fungible(
                &NonFungibleLocalId::integer(self.lp_counter),
                LiquidityPosition {
                    liquidity,
                    left_bound: left,
                    right_bound: right,
                    x_amount: x_used,
                    y_amount: y_used,
                    x_fee_checkpoint: self.x_fee_growth,
                    y_fee_checkpoint: self.y_fee_growth,
                },
            );
            (x_bucket, y_bucket, position.into())
        }

        pub fn claim_fees(&mut self, lp_proofs: NonFungibleProof) -> (Bucket, Bucket) {
            let checked = lp_proofs.check(self.lp_manager.address());
            let mut x_out = Bucket::new(self.x_fees.resource_address());
            let mut y_out = Bucket::new(self.y_fees.resource_address());
            for nft in checked.non_fungibles::<LiquidityPosition>() {
                let (x, y) = self.take_fees(nft.local_id(), &nft.data());
                x_out.put(x);
                y_out.put(y);
            }
            (x_out, y_out)
        }

        /// Withdraws positions with their pending fees and burns the NFTs.
        pub fn remove_liquidity(&mut self, lp_positions: NonFungibleBucket) -> (Bucket, Bucket) {
            assert!(lp_positions.resource_address() == self.lp_manager.address(), "Not a position of this pool.");
            let mut x_out = Bucket::new(self.x_liquidity.resource_address());
            let mut y_out = Bucket::new(self.y_liquidity.resource_address());
            for nft in lp_positions.non_fungibles::<LiquidityPosition>() {
                let data = nft.data();
                let (x_fees, y_fees) = self.take_fees(nft.local_id(), &data);
                x_out.put(x_fees);
                y_out.put(y_fees);
                x_out.put(self.x_liquidity.take(data.x_amount));
                y_out.put(self.y_liquidity.take(data.y_amount));
                self.total_liquidity -= data.liquidity;
            }
            lp_positions.burn();
            (x_out, y_out)
        }

        /// Test only: fees for the open positions, shared by liquidity as trading would.
        pub fn add_fees(&mut self, x_bucket: Bucket, y_bucket: Bucket) {
            assert!(self.total_liquidity > PreciseDecimal::ZERO, "No positions to earn fees.");
            self.x_fee_growth += PreciseDecimal::from(x_bucket.amount()) / self.total_liquidity;
            self.y_fee_growth += PreciseDecimal::from(y_bucket.amount()) / self.total_liquidity;
            self.x_fees.put(x_bucket);
            self.y_fees.put(y_bucket);
        }

        fn take_fees(&mut self, id: &NonFungibleLocalId, data: &LiquidityPosition) -> (Bucket, Bucket) {
            let to_dec = |v: PreciseDecimal| v.checked_truncate(RoundingMode::ToZero).unwrap();
            let x = to_dec(data.liquidity * (self.x_fee_growth - data.x_fee_checkpoint)).min(self.x_fees.amount());
            let y = to_dec(data.liquidity * (self.y_fee_growth - data.y_fee_checkpoint)).min(self.y_fees.amount());
            self.lp_manager.update_non_fungible_data(id, "x_fee_checkpoint", self.x_fee_growth);
            self.lp_manager.update_non_fungible_data(id, "y_fee_checkpoint", self.y_fee_growth);
            (self.x_fees.take(x), self.y_fees.take(y))
        }
    }
}
