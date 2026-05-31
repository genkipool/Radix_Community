import React, { useRef, useState } from 'react';
import { StakingAction } from '@/features/dashboard/staking/types/staking-operations.types';
import { Info, X } from 'lucide-react';
import { m, AnimatePresence } from "motion/react";
import { Portal } from '@/components/ui/Portal';
import { ModalOverlay } from '@/components/ui/ModalOverlay';

interface BatchValidatorStakeActionProps {
    accountAddress: string;
    network: 'mainnet' | 'stokenet';
    selectedValidatorsCount: number;
    xrdBalance: number;
    totalStakedXrdSelected: number;
    globalAmountStr: string;
    setGlobalAmountStr: (val: string) => void;
    onBatchAction: (action: StakingAction) => void;
    isTransacting: boolean;
    transactingAction: StakingAction | null;
    actionError: string | null;
    setActionError: (err: string | null) => void;
    t?: Partial<import('@/features/dashboard/types').TranslationsT>;
    children?: React.ReactNode;
}

export const BatchValidatorStakeAction = ({
    selectedValidatorsCount,
    xrdBalance,
    totalStakedXrdSelected,
    globalAmountStr,
    setGlobalAmountStr,
    onBatchAction,
    isTransacting,
    transactingAction,
    actionError,
    setActionError,
    t,
    children
}: BatchValidatorStakeActionProps) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const stakingT = t?.staking;
    
    // In batch mode, we don't know the exact max balance trivially here since it depends on the sum across selected validators.
    // The actual limit validation happens before calling onBatchAction or inside it.
    
    return (
        <div className="flex flex-col gap-3 mb-6">
            <div className="text-xs font-bold text-[var(--color-primary)] flex justify-between items-center px-1">
                <button 
                    type="button" 
                    onClick={(e) => { e.stopPropagation(); setIsInfoModalOpen(true); }}
                    className="flex items-center gap-2 hover:text-[var(--color-primary)] transition-colors group"
                    title="Información sobre acciones globales"
                >
                    <Info className="size-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] transition-colors" />
                    <span>ACCIÓN GLOBAL (LOTES)</span>
                </button>
                <span>{selectedValidatorsCount} Validadores Seleccionados</span>
            </div>
            
            {children && (
                <div className="mb-2">
                    {children}
                </div>
            )}
            
            {/* Input Row */}
            <div className="relative flex flex-col">
                <div className="relative">
                    <input
                        ref={inputRef}
                        type="number"
                        value={globalAmountStr}
                        onChange={(e) => {
                            setGlobalAmountStr(e.target.value);
                            setActionError(null);
                        }}
                        placeholder="Cantidad TOTAL de XRD (Staking/Unstaking)"
                        disabled={isTransacting || selectedValidatorsCount === 0}
                        className={`w-full bg-[var(--color-background)] border rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors pr-16 ${actionError ? 'border-red-500 text-red-500 focus:border-red-500' : 'border-[var(--color-border)] focus:border-[var(--color-primary)]'} ${(isTransacting || selectedValidatorsCount === 0) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                    <button
                        type="button"
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            const maxAmount = Math.max(xrdBalance, totalStakedXrdSelected);
                            setGlobalAmountStr(maxAmount.toString()); 
                        }}
                        disabled={isTransacting || selectedValidatorsCount === 0}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-2 py-1 rounded transition-colors ${(isTransacting || selectedValidatorsCount === 0) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[var(--color-primary)]/20'}`}
                    >
                        {stakingT?.max ?? 'MAX'}
                    </button>
                </div>
                {actionError && (
                    <div className="text-[10px] text-red-500 mt-1 flex justify-between">
                        <span>{actionError}</span>
                        <button type="button" onClick={() => setActionError(null)} className="underline hover:no-underline">X</button>
                    </div>
                )}
            </div>

            {/* Buttons Row */}
            <div className="flex gap-2">
                {(['Stake', 'Unstake', 'Claim'] as StakingAction[]).map(action => {
                    const isThisActionTransacting = isTransacting && transactingAction === action;
                    const isDisabled =
                        isTransacting ||
                        selectedValidatorsCount === 0 ||
                        (action !== 'Claim' && (!globalAmountStr || parseFloat(globalAmountStr) <= 0));
                    
                    const label = (stakingT?.[action.toLowerCase() as keyof typeof stakingT] as string) ?? action;

                    return (
                        <button
                            type="button"
                            key={action}
                            onClick={(e) => {
                                e.stopPropagation();
                                onBatchAction(action);
                            }}
                            disabled={isDisabled}
                            className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-[var(--color-background)] text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] leading-tight`}
                        >
                            {isThisActionTransacting ? (
                                <span className="flex items-center justify-center">
                                    {label}
                                    <span className="animate-pulse ml-0.5">...</span>
                                </span>
                            ) : (
                                `${label} TODOS`
                            )}
                        </button>
                    );
                })}
            </div>
            
            <div className="text-[10px] text-[var(--color-text-muted)] italic text-center mt-1">
                La cantidad ingresada se distribuirá a partes iguales entre los validadores seleccionados.
            </div>

            {/* Info Modal */}
            <Portal>
                <AnimatePresence>
                    {isInfoModalOpen && (
                        <>
                            <ModalOverlay onClose={() => setIsInfoModalOpen(false)} blur="sm" className="z-[9999]" />
                            <m.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none"
                            >
                                <div
                                    className="w-full max-w-md bg-[var(--color-surface)]/95 backdrop-blur-2xl border border-[var(--color-card-border)] shadow-2xl rounded-3xl overflow-hidden pointer-events-auto relative p-6"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <button
                                        type="button"
                                        onClick={() => setIsInfoModalOpen(false)}
                                        className="absolute top-4 right-4 size-8 rounded-full hover:bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors"
                                    >
                                        <X className="size-4" />
                                    </button>
                                    
                                    <div className="flex items-center gap-3 mb-4 text-[var(--color-primary)]">
                                        <Info className="size-6" />
                                        <h3 className="text-lg font-black tracking-tight">Acción Global por Lotes</h3>
                                    </div>
                                    
                                    <div className="space-y-4 text-sm text-[var(--color-text-main)] leading-relaxed">
                                        <p>
                                            La funcionalidad de <strong className="text-[var(--color-primary)]">Staking por Lotes</strong> te permite realizar acciones masivas sobre varios validadores en una sola transacción, ahorrando tiempo y firmas.
                                        </p>
                                        
                                        <ul className="list-disc pl-5 space-y-2 text-[var(--color-text-muted)]">
                                            <li><strong className="text-[var(--color-text-main)]">Staking Masivo:</strong> Ingresa la cantidad de XRD en el campo superior. Esta se dividirá por igual entre todos los validadores seleccionados. <br/><span className="italic text-xs">Ejemplo: Si tienes 3 validadores seleccionados y pones 300 XRD, se enviarán 100 XRD a cada uno.</span></li>
                                            <li><strong className="text-[var(--color-text-main)]">Unstaking Masivo:</strong> Ingresa la cantidad TOTAL que deseas retirar. Se intentará extraer a partes iguales de cada validador. <br/><span className="italic text-xs">Ejemplo: Si pones 150 XRD y tienes 3 validadores, se extraerán 50 XRD de cada uno. Ojo: Ningún validador puede tener menos saldo del que le pides.</span></li>
                                            <li><strong className="text-[var(--color-text-main)]">Claim Masivo:</strong> No necesitas ingresar cantidad. Simplemente selecciona los validadores y haz clic en &quot;CLAIM TODOS&quot;. Recogerá automáticamente todas las recompensas listas de los validadores elegidos.</li>
                                            <li><strong className="text-[var(--color-text-main)]">Vista Previa:</strong> Podrás ver en el input de cada validador (en color tenue) la cantidad exacta que le corresponde antes de confirmar.</li>
                                        </ul>
                                    </div>
                                </div>
                            </m.div>
                        </>
                    )}
                </AnimatePresence>
            </Portal>
        </div>
    );
};
