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
    globalAmountStr: string;
    setGlobalAmountStr: (val: string) => void;
    onBatchAction: (action: StakingAction) => void;
    isTransacting: boolean;
    transactingAction: StakingAction | null;
    actionError: string | null;
    setActionError: (err: string | null) => void;
    t?: Partial<import('@/features/dashboard/types').TranslationsT>;
}

export const BatchValidatorStakeAction = ({
    selectedValidatorsCount,
    globalAmountStr,
    setGlobalAmountStr,
    onBatchAction,
    isTransacting,
    transactingAction,
    actionError,
    setActionError,
    t
}: BatchValidatorStakeActionProps) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const stakingT = t?.staking;
    
    // In batch mode, we don't know the exact max balance trivially here since it depends on the sum across selected validators.
    // The actual limit validation happens before calling onBatchAction or inside it.
    
    return (
        <div className="flex flex-col gap-3 mb-6">
            <div className="text-xs font-bold text-[var(--color-primary)] flex justify-between items-center px-1">
                <div className="flex items-center gap-2">
                    <span>ACCIÓN GLOBAL (LOTES)</span>
                    <button 
                        type="button" 
                        onClick={(e) => { e.stopPropagation(); setIsInfoModalOpen(true); }}
                        className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors p-1 rounded-full hover:bg-[var(--color-primary)]/10"
                        title="Información sobre acciones globales"
                    >
                        <Info className="size-4" />
                    </button>
                </div>
                <span>{selectedValidatorsCount} Validadores Seleccionados</span>
            </div>
            
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
                        placeholder={`Cantidad total de XRD a distribuir`}
                        disabled={isTransacting || selectedValidatorsCount === 0}
                        className={`w-full bg-[var(--color-background)] border rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors pr-16 ${actionError ? 'border-red-500 text-red-500 focus:border-red-500' : 'border-[var(--color-border)] focus:border-[var(--color-primary)]'} ${(isTransacting || selectedValidatorsCount === 0) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
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

                    return (
                        <button
                            type="button"
                            key={action}
                            onClick={(e) => {
                                e.stopPropagation();
                                onBatchAction(action);
                            }}
                            disabled={isDisabled}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${action === 'Claim' ? 'bg-[var(--color-accent)] text-white hover:opacity-90' : 'bg-[var(--color-primary)] text-white hover:opacity-90'}`}
                        >
                            {isThisActionTransacting ? (
                                <span className="flex items-center justify-center">
                                    {(stakingT?.[action.toLowerCase() as keyof typeof stakingT] as string) ?? action}
                                    <span className="animate-pulse ml-0.5">...</span>
                                </span>
                            ) : (
                                `${(stakingT?.[action.toLowerCase() as keyof typeof stakingT] as string) ?? action} TODOS`
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
                            <ModalOverlay onClose={() => setIsInfoModalOpen(false)} blur="sm" />
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
                                            <li><strong className="text-[var(--color-text-main)]">Distribución Equitativa:</strong> La cantidad de XRD que ingreses se dividirá a partes iguales entre todos los validadores que hayas seleccionado en el carrusel superior.</li>
                                            <li><strong className="text-[var(--color-text-main)]">Vista Previa:</strong> Podrás ver en el input de cada validador (en color tenue) la cantidad exacta que le corresponde antes de confirmar.</li>
                                            <li><strong className="text-[var(--color-text-main)]">Límites de Unstake:</strong> Al hacer Unstake, la cantidad asignada a un validador no puede superar su balance actual. Si esto ocurre, se mostrará un error y deberás ajustar el monto o deseleccionar al validador.</li>
                                            <li><strong className="text-[var(--color-text-main)]">Un Solo Click:</strong> Los botones &quot;TODOS&quot; enviarán una única orden inteligente (Smart Contract) a la red de Radix.</li>
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
