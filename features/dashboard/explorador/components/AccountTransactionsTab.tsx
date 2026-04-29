'use client';

import React from 'react';
import { motion } from 'motion/react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { apiFetchTransactions, apiFetchEntityDetails, apiFetchValidators } from '@/features/dashboard/services/apiClient';
import { resolveTransactionType } from '../utils/transactionUtils';
import type { Network, TranslationsT } from '@/features/dashboard/types';
import type { TransactionInfo, Validator } from '@/types/radix';
import { CopyButton } from '@/components/ui/CopyButton';
import { Loader2, AlertCircle } from 'lucide-react';
import { getXrdAddress } from '@/features/dashboard/explorador/constants';
import { formatNumber } from '@/utils/formatters';
import type { FungibleChange, NonFungibleChange } from '@/features/dashboard/types/shared.types';

interface AccountTransactionsTabProps {
    accountAddress: string;
    network: Network;
    tt: TranslationsT['dashboard']['transactions'];
    locale: string;
}

interface TokenFlow {
    address: string;
    amount: string;
    isNft: boolean;
    count?: number;
}

function TokenDisplay({
    flow,
    network,
    locale,
    type,
}: {
    flow: TokenFlow;
    network: Network;
    locale: string;
    type: 'deposit' | 'withdraw';
}) {
    const isXrd = flow.address === getXrdAddress(network);

    const { data } = useQuery({
        queryKey: ['token-symbol', flow.address, network],
        queryFn: () => apiFetchEntityDetails(flow.address, network),
        enabled: !isXrd && !flow.isNft,
        staleTime: Infinity,
    });

    let symbol = isXrd ? 'XRD' : `${flow.address.slice(0, 4)}...${flow.address.slice(-4)}`;

    if (!isXrd && !flow.isNft && data?.metadata?.items) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const symbolItem = data.metadata.items.find((m: any) => m.key === 'symbol');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nameItem = data.metadata.items.find((m: any) => m.key === 'name');
        
        const rawSymbol = symbolItem?.value?.typed?.value || nameItem?.value?.typed?.value;
        
        if (rawSymbol) {
            if (rawSymbol === 'Liquid Stake Units') {
                symbol = 'LSU';
            } else {
                symbol = rawSymbol.length > 6 ? rawSymbol.slice(0, 6) : rawSymbol;
            }
        }
    }

    const amountStr = flow.isNft
        ? flow.count?.toString()
        : formatNumber(Math.abs(Number(flow.amount)), 4, locale);
    
    const colorClass = type === 'deposit' ? 'text-emerald-500' : 'text-red-500';
    const sign = type === 'deposit' ? '+' : '-';

    return (
        <div className={`text-xs font-mono font-semibold ${colorClass} flex items-center gap-1.5`}>
            <span>{sign}{amountStr}</span>
            <span className="text-[10px] text-[var(--color-text-main)] bg-white/10 px-1.5 py-0.5 rounded-sm">
                {flow.isNft ? 'NFT' : symbol}
            </span>
        </div>
    );
}

interface StakingBalanceCellProps {
    tx: TransactionInfo & { isEndOfMonthAuth?: boolean };
    accountAddress: string;
    network: Network;
    locale: string;
    validatorsData?: { validators: Validator[]; networkStats: unknown };
}

function StakingBalanceCell({
    tx,
    accountAddress,
    network,
    locale,
    validatorsData
}: StakingBalanceCellProps) {
    const isStakeOrUnstake = tx.manifestClasses?.includes('ValidatorStake') || tx.manifestClasses?.includes('ValidatorUnstake');
    const shouldQuery = isStakeOrUnstake || tx.isEndOfMonthAuth;

    const { data: balance, isLoading } = useQuery({
        queryKey: ['staking-balance-version', accountAddress, tx.stateVersion, network],
        queryFn: async () => {
            const GATEWAY_URL = network === 'stokenet'
                ? 'https://stokenet.radixdlt.com'
                : 'https://mainnet.radixdlt.com';

            const res = await fetch(`${GATEWAY_URL}/state/entity/details`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    addresses: [accountAddress],
                    opt_ins: { fungible_resources: true },
                    at_ledger_state: { state_version: tx.stateVersion }
                })
            });
            
            if (!res.ok) return 0;
            const data = await res.json();
            
            const accountItem = data.items?.find((i: { address: string }) => i.address === accountAddress);
            if (!accountItem) return 0;

            const fungibles = accountItem.fungible_resources?.items || [];
            
            const lsuToValidator = new Map<string, string>();
            if (validatorsData?.validators) {
                validatorsData.validators.forEach((v: Validator) => {
                    if (v.lsuResource) {
                        lsuToValidator.set(v.lsuResource, v.address);
                    }
                });
            }

            const extraAddresses: string[] = [];
            const lsuAddressesInAccount: string[] = [];
            for (const f of fungibles) {
                if (lsuToValidator.has(f.resource_address)) {
                    lsuAddressesInAccount.push(f.resource_address);
                    extraAddresses.push(f.resource_address);
                    const valAddr = lsuToValidator.get(f.resource_address)!;
                    extraAddresses.push(valAddr);
                }
            }

            const historicalRedemptionRates = new Map<string, number>();

            if (extraAddresses.length > 0) {
                try {
                    const resExtra = await fetch(`${GATEWAY_URL}/state/entity/details`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            addresses: extraAddresses,
                            at_ledger_state: { state_version: tx.stateVersion }
                        })
                    });

                    if (resExtra.ok) {
                        const extraData = await resExtra.json();
                        const items = (extraData.items || []) as Array<{
                            address: string;
                            details?: {
                                total_supply?: string;
                                total_minted?: string;
                                state?: {
                                    stake_vault?: { balance: string }
                                }
                            };
                            stake_vault?: { balance: string };
                            state?: {
                                stake_vault?: { balance: string }
                            };
                            active_in_epoch?: {
                                stake: string;
                            };
                        }>;
                        
                        const itemsMap = new Map<string, typeof items[number]>();
                        items.forEach((item) => {
                            itemsMap.set(item.address, item);
                        });

                        for (const lsuAddr of lsuAddressesInAccount) {
                            const valAddr = lsuToValidator.get(lsuAddr)!;
                            const lsuItem = itemsMap.get(lsuAddr);
                            const valItem = itemsMap.get(valAddr);

                            let lsuSupply = 1;
                            if (lsuItem) {
                                lsuSupply = parseFloat(
                                    lsuItem.details?.total_supply ?? 
                                    lsuItem.details?.total_minted ?? 
                                    '1'
                                );
                                if (lsuSupply === 0) lsuSupply = 1;
                            }

                            let valStake = 0;
                            if (valItem) {
                                valStake = parseFloat(
                                    valItem.stake_vault?.balance ??
                                    valItem.details?.state?.stake_vault?.balance ??
                                    valItem.state?.stake_vault?.balance ??
                                    valItem.active_in_epoch?.stake ??
                                    '0'
                                );
                            }

                            const factor = valStake / lsuSupply;
                            if (factor > 0) {
                                historicalRedemptionRates.set(lsuAddr, factor);
                            }
                        }
                    }
                } catch {
                    // Fallback to mathematical discount on error
                }
            }

            let totalStaking = 0;
            const now = new Date();
            const txDate = new Date(tx.confirmedAt);
            const daysDiff = Math.max(0, (now.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24));

            for (const f of fungibles) {
                if (lsuToValidator.has(f.resource_address)) {
                    const amount = parseFloat(f.amount || f.balance?.value || '0');
                    
                    let factor = historicalRedemptionRates.get(f.resource_address);
                    if (factor === undefined) {
                        const currentVal = validatorsData?.validators.find(v => v.lsuResource === f.resource_address);
                        const currentFactor = currentVal?.lsu2xrdFactor || 1;
                        const apy = currentVal?.apyProjection || 5.76;
                        factor = currentFactor / (1 + (apy / 100) * (daysDiff / 365));
                    }
                    
                    totalStaking += amount * factor;
                }
            }
            return totalStaking;
        },
        enabled: shouldQuery && !!validatorsData,
        staleTime: Infinity,
    });

    if (!shouldQuery) {
        return <span className="text-xs text-[var(--color-text-muted)]">-</span>;
    }

    if (isLoading) {
        return <span className="text-xs text-[var(--color-text-muted)] animate-pulse">...</span>;
    }

    return (
        <span className="text-xs font-mono text-[var(--color-text-main)]">
            {balance && balance > 0 ? `${formatNumber(balance, 4, locale)} XRD` : '-'}
        </span>
    );
}

export function AccountTransactionsTab({
    accountAddress,
    network,
    tt,
    locale
}: AccountTransactionsTabProps) {
    const accT = tt.account_summary;

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        isError,
        error
    } = useInfiniteQuery({
        queryKey: ['account-transactions', accountAddress, network],
        queryFn: async ({ pageParam }) =>
            apiFetchTransactions({
                cursor: pageParam as string | undefined,
                limit: 15,
                address: accountAddress,
                network
            }),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
        staleTime: 60_000,
    });

    const { data: entityDetails } = useQuery({
        queryKey: ['entity-details', accountAddress, network],
        queryFn: () => apiFetchEntityDetails(accountAddress, network),
        staleTime: 60_000,
    });

    const { data: validatorsData } = useQuery({
        queryKey: ['validators', network],
        queryFn: () => apiFetchValidators(network),
        staleTime: 300_000,
    });

    const transactions = React.useMemo(() => data?.pages.flatMap((p) => p.transactions || []) || [], [data]);

    const transactionsWithBalances = React.useMemo(() => {
        if (!transactions.length || !entityDetails || !validatorsData) {
            return transactions.map(tx => ({ ...tx, balanceXrd: 0, balanceStaking: 0 }));
        }

        const runningBalances: Record<string, number> = {};
        entityDetails.fungible_resources?.items.forEach((item) => {
            runningBalances[item.resource_address] = Number(item.amount);
        });

        const validatorMap = new Map<string, number>();
        validatorsData.validators.forEach((v) => {
            if (v.lsuResource) validatorMap.set(v.lsuResource, v.lsu2xrdFactor || 1);
        });
        const xrdAddress = getXrdAddress(network);

        return transactions.map((tx) => {
            const currentXrd = runningBalances[xrdAddress] || 0;
            let currentStaking = 0;
            for (const [res, amount] of Object.entries(runningBalances)) {
                if (validatorMap.has(res) && amount > 0) {
                    currentStaking += amount * validatorMap.get(res)!;
                }
            }

            const fungibles = (tx.balanceChanges?.fungible_balance_changes as FungibleChange[]) || [];
            fungibles.forEach(f => {
                if (f.entity_address === accountAddress) {
                    const delta = Number(f.balance_change);
                    runningBalances[f.resource_address] = (runningBalances[f.resource_address] || 0) - delta;
                }
            });

            const fees = (tx.balanceChanges?.fungible_fee_balance_changes as FungibleChange[]) || [];
            fees.forEach(f => {
                if (f.entity_address === accountAddress) {
                    const delta = Number(f.balance_change);
                    runningBalances[f.resource_address] = (runningBalances[f.resource_address] || 0) - delta;
                }
            });

            return {
                ...tx,
                balanceXrd: currentXrd,
                balanceStaking: currentStaking,
            };
        });
    }, [transactions, entityDetails, validatorsData, network, accountAddress]);

    const processedTransactions = React.useMemo(() => {
        const daysAllocated = new Set<string>();

        return transactionsWithBalances.map((tx, index) => {
            const date = new Date(tx.confirmedAt);
            const year = date.getFullYear();
            const month = date.getMonth();
            const day = date.getDate();
            const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

            const nextDay = new Date(year, month, day + 1);
            const isLastDay = nextDay.getMonth() !== month;

            let isAuthorizedForDay = false;
            if (isLastDay && !daysAllocated.has(dayStr)) {
                isAuthorizedForDay = true;
                daysAllocated.add(dayStr);
            }

            const isLatest = index === 0;

            return {
                ...tx,
                isEndOfMonthAuth: isAuthorizedForDay || isLatest
            };
        });
    }, [transactionsWithBalances]);

    const txLoadingText = locale === 'es' ? 'Cargando transacciones...' : 'Loading transactions...';
    const txErrorText = locale === 'es' ? 'Error al cargar las transacciones.' : 'Error loading transactions.';
    const txNoTransactionsText = locale === 'es' ? 'No se encontraron transacciones para esta cuenta.' : 'No transactions found for this account.';

    const getTranslatedError = (rawMsg: string | undefined) => {
        if (!rawMsg) return txErrorText;
        if (rawMsg.includes('Failed to fetch transactions for address')) {
            return tt?.transactions?.error_fetch_address || 'Failed to fetch transactions for this address.';
        }
        if (rawMsg.includes('Failed to fetch recent transactions')) {
            return tt?.transactions?.error_fetch_recent || 'Failed to fetch recent transactions.';
        }
        if (rawMsg.includes('Failed to fetch transaction details')) {
            return tt?.transactions?.error_fetch_details || 'Failed to fetch transaction details.';
        }
        if (rawMsg.includes('Failed to fetch full history')) {
            return tt?.transactions?.error_fetch_history_max_pages || 'Failed to fetch full history (max pages reached).';
        }
        if (rawMsg.includes('Round proposer not available')) {
            return tt?.transactions?.error_no_proposer || 'Round proposer not available.';
        }
        return rawMsg;
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--color-text-muted)] gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
                <span className="text-sm font-medium">{txLoadingText}</span>
            </div>
        );
    }

    if (isError) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        return (
            <div className="flex flex-col items-center justify-center py-12 text-red-400 gap-3">
                <AlertCircle className="w-6 h-6" />
                <span className="text-sm font-medium">{getTranslatedError(errorMsg)}</span>
            </div>
        );
    }

    if (transactions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--color-text-muted)]">
                <span className="text-sm font-medium">{txNoTransactionsText}</span>
            </div>
        );
    }

    return (
        <div className="w-full flex flex-col">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-[var(--color-card-border)] text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-surface)]">
                            <th className="py-3 px-4 font-semibold whitespace-nowrap" title={accT?.tx_date_tooltip || 'Transaction confirmation date'}>{accT?.tx_date || 'Date'}</th>
                            <th className="py-3 px-4 font-semibold whitespace-nowrap" title={accT?.tx_hash_tooltip || 'Transaction identifier'}>{accT?.tx_hash || 'Hash'}</th>
                            <th className="py-3 px-4 font-semibold whitespace-nowrap" title={accT?.tx_type_tooltip || 'Type of transaction according to manifest'}>{accT?.tx_type || 'Type'}</th>
                            <th className="py-3 px-4 font-semibold whitespace-nowrap" title={accT?.tx_withdraw_tooltip || 'Tokens leaving the account'}>{accT?.tx_withdraw || 'Withdraw'}</th>
                            <th className="py-3 px-4 font-semibold whitespace-nowrap" title={accT?.tx_deposit_tooltip || 'Tokens entering the account'}>{accT?.tx_deposit || 'Deposit'}</th>
                            <th className="py-3 px-4 font-semibold whitespace-nowrap text-right" title={accT?.tx_fee_tooltip || 'Transaction cost paid by this account'}>{accT?.tx_fee || 'Fee'}</th>
                            <th 
                                className="py-3 px-4 font-semibold whitespace-nowrap text-right"
                                title={accT?.tx_balance_tooltip || 'Available XRD balance after the transaction'}
                            >
                                {accT?.tx_balance || 'Balance'}
                            </th>
                            <th 
                                className="py-3 px-4 font-semibold whitespace-nowrap text-right"
                                title={accT?.tx_staking_balance_tooltip || 'Estimated XRD value in staking after the transaction'}
                            >
                                {accT?.tx_staking_balance || 'Staking Balance'}
                            </th>
                            <th className="py-3 px-4 font-semibold whitespace-nowrap" title={accT?.tx_status_tooltip || 'Result of transaction execution'}>{accT?.tx_status || 'Status'}</th>
                        </tr>
                    </thead>
                    {processedTransactions.map((tx) => {
                        const isSuccess = tx.status === 'CommittedSuccess' || tx.status === 'Committed';
                        
                        // Token movements
                        const fungibles = ((tx.balanceChanges?.fungible_balance_changes as FungibleChange[]) || []).filter(
                            (c) => c.entity_address === accountAddress
                        );
                        const nonFungibles = ((tx.balanceChanges?.non_fungible_balance_changes as NonFungibleChange[]) || []).filter(
                            (c) => c.entity_address === accountAddress
                        );

                        const deposits: TokenFlow[] = [];
                        const withdraws: TokenFlow[] = [];

                        fungibles.forEach(f => {
                            if (Number(f.balance_change) > 0) {
                                deposits.push({ address: f.resource_address, amount: f.balance_change, isNft: false });
                            } else if (Number(f.balance_change) < 0) {
                                withdraws.push({ address: f.resource_address, amount: f.balance_change, isNft: false });
                            }
                        });

                        nonFungibles.forEach(nf => {
                            if (nf.added && nf.added.length > 0) {
                                deposits.push({ address: nf.resource_address, amount: '', count: nf.added.length, isNft: true });
                            }
                            if (nf.removed && nf.removed.length > 0) {
                                withdraws.push({ address: nf.resource_address, amount: '', count: nf.removed.length, isNft: true });
                            }
                        });

                        const maxRows = Math.max(1, deposits.length, withdraws.length);
                        const rows = Array.from({ length: maxRows }).map((_, i) => ({
                            deposit: deposits[i],
                            withdraw: withdraws[i]
                        }));

                        // Fee logic
                        const feeChanges = (tx.balanceChanges?.fungible_fee_balance_changes as FungibleChange[]) || [];
                        const accountFee = feeChanges.find((c) => c.entity_address === accountAddress);
                        const feePaidByAccount = accountFee ? Math.abs(Number(accountFee.balance_change)) : 0;

                        const dateStr = new Date(tx.confirmedAt).toLocaleString(locale, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                        
                        const shortHash = `${tx.intentHash.slice(0, 8)}...${tx.intentHash.slice(-6)}`;
                        const typeStr = resolveTransactionType(tx.manifestClasses || [], [], tt);

                        return (
                            <tbody key={tx.intentHash} className="border-b border-[var(--color-card-border)] hover:bg-white/[0.03] hover:shadow-[inset_2px_0_0_0_var(--color-primary)] transition-all duration-300 text-sm last:border-b-0">
                                {rows.map((row, index) => (
                                    <tr key={`${tx.intentHash}-${index}`} className="group">
                                        {index === 0 && (
                                            <>
                                                <td rowSpan={maxRows} className="py-3 px-4 whitespace-nowrap text-[var(--color-text-main)] text-xs border-r border-transparent group-hover:border-[var(--color-card-border)]/30 transition-colors">
                                                    {dateStr}
                                                </td>
                                                <td rowSpan={maxRows} className="py-3 px-4 whitespace-nowrap border-r border-transparent group-hover:border-[var(--color-card-border)]/30 transition-colors">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-xs text-[var(--color-primary)]">
                                                            {shortHash}
                                                        </span>
                                                        <CopyButton value={tx.intentHash} variant="minimal" />
                                                    </div>
                                                </td>
                                                <td rowSpan={maxRows} className="py-3 px-4 whitespace-nowrap border-r border-transparent group-hover:border-[var(--color-card-border)]/30 transition-colors">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] opacity-80 group-hover:opacity-100 transition-opacity">
                                                        {typeStr}
                                                    </span>
                                                </td>
                                            </>
                                        )}
                                        <td className="py-3 px-4 whitespace-nowrap">
                                            {row.withdraw ? <TokenDisplay flow={row.withdraw} network={network} locale={locale} type="withdraw" /> : <span className="text-xs text-[var(--color-text-muted)]">-</span>}
                                        </td>
                                        <td className="py-3 px-4 whitespace-nowrap">
                                            {row.deposit ? <TokenDisplay flow={row.deposit} network={network} locale={locale} type="deposit" /> : <span className="text-xs text-[var(--color-text-muted)]">-</span>}
                                        </td>
                                        {index === 0 && (
                                            <>
                                                <td rowSpan={maxRows} className="py-3 px-4 whitespace-nowrap text-right text-xs font-mono text-[var(--color-text-muted)] border-l border-transparent group-hover:border-[var(--color-card-border)]/30 transition-colors">
                                                    {feePaidByAccount > 0 ? `${formatNumber(feePaidByAccount, 4, locale)} XRD` : '-'}
                                                </td>
                                                <td rowSpan={maxRows} className="py-3 px-4 whitespace-nowrap text-right text-xs font-mono text-[var(--color-text-main)] border-l border-transparent group-hover:border-[var(--color-card-border)]/30 transition-colors">
                                                    {formatNumber(tx.balanceXrd, 4, locale)} XRD
                                                </td>
                                                <td rowSpan={maxRows} className="py-3 px-4 whitespace-nowrap text-right text-xs border-l border-transparent group-hover:border-[var(--color-card-border)]/30 transition-colors">
                                                    <StakingBalanceCell 
                                                        tx={tx} 
                                                        accountAddress={accountAddress} 
                                                        network={network} 
                                                        locale={locale} 
                                                        validatorsData={validatorsData} 
                                                    />
                                                </td>
                                                <td rowSpan={maxRows} className="py-3 px-4 whitespace-nowrap border-l border-transparent group-hover:border-[var(--color-card-border)]/30 transition-colors">
                                                    <span className={`text-xs font-semibold ${isSuccess ? 'text-emerald-500' : 'text-red-500'}`}>
                                                        {isSuccess ? (accT?.tx_success || 'Success') : (accT?.tx_failed || 'Failed')}
                                                    </span>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        );
                    })}
                </table>
            </div>

            {hasNextPage && (
                <div className="flex justify-center mt-8 mb-4">
                    <motion.button
                        onClick={() => fetchNextPage()}
                        disabled={isFetchingNextPage}
                        className="px-8 py-2.5 text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isFetchingNextPage ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                {accT?.tx_loading || 'Loading...'}
                            </>
                        ) : (
                            accT?.tx_load_more || 'Load More'
                        )}
                    </motion.button>
                </div>
            )}
        </div>
    );
}
