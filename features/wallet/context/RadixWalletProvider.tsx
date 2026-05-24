'use client';

import React, { createContext, useEffect, useState, ReactNode } from 'react';
import { RadixWalletContextValue, RadixWalletState } from '../types/wallet';
import { getOrCreateToolkit } from '../lib/radix-toolkit';
import { RadixNetworkId } from '../constants/network';
import { Subscription } from 'rxjs';

export const RadixWalletContext = createContext<RadixWalletContextValue | undefined>(undefined);

export function RadixWalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RadixWalletState>({
    isConnected: false,
    isLoading: false,
    isExtensionAvailable: true,
    accounts: [],
    persona: undefined,
    personaData: [],
    error: null,
    activeNetworkId: null,
  });

  // Effect to handle RDT initialization when a network is selected
  useEffect(() => {
    if (!state.activeNetworkId) return;

    const rdt = getOrCreateToolkit(state.activeNetworkId);
    if (!rdt) return;

    // Provide the challenge generator for ROLA
    rdt.walletApi.provideChallengeGenerator(async () => {
      try {
        const response = await fetch('/api/auth/radix/challenge');
        const data = await response.json();
        return data.challenge;
      } catch (error) {
        console.error('Failed to get ROLA challenge', error);
        throw error;
      }
    });

    // Provide response callback to verify the signature on backend
    rdt.walletApi.provideConnectResponseCallback(async (result) => {
      if (result.isErr()) {
        setState(prev => ({ ...prev, isLoading: false, error: 'Connection rejected or failed.' }));
        return;
      }

      const walletData = result.value;
      const proofs = walletData.proofs;

      if (!proofs || proofs.length === 0) {
         console.warn("No ROLA proof provided by wallet.");
         // Fallback if we decide to allow without proof, but for now we expect it
      } else {
        // Send proof to backend to verify
        try {
          const verifyResponse = await fetch('/api/auth/radix/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              challenge: proofs[0].challenge,
              proof: proofs[0].proof,
              identityAddress: walletData.persona?.identityAddress
            }),
          });
          
          if (!verifyResponse.ok) {
             throw new Error('Verification failed');
          }
        } catch (error) {
          console.error("ROLA Verification error", error);
          setState(prev => ({ ...prev, isLoading: false, error: 'Identity verification failed.' }));
          return;
        }
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        isConnected: true,
        accounts: walletData.accounts,
        persona: walletData.persona,
        personaData: walletData.personaData,
        error: null,
      }));
    });

    const subscription = new Subscription();

    // Subscribe to state changes from the wallet
    subscription.add(
      rdt.walletApi.walletData$.subscribe((walletData) => {
        // Only update UI state if we already connected and verified, 
        // or if wallet extension disconnects us.
        if (walletData.accounts.length === 0 && walletData.persona === undefined) {
             setState(prev => ({
                ...prev,
                isConnected: false,
                accounts: [],
                persona: undefined,
                personaData: []
             }));
        }
      })
    );

    return () => {
      subscription.unsubscribe();
      // We don't destroy toolkit here because we want it to persist across re-renders
      // It is only destroyed when switching networks or unmounting the entire app
    };
  }, [state.activeNetworkId]);

  const connect = (networkId: RadixNetworkId) => {
    setState(prev => ({ ...prev, isLoading: true, error: null, activeNetworkId: networkId }));
    
    // Slight delay to allow state and RDT to initialize
    setTimeout(() => {
        const rdt = getOrCreateToolkit(networkId);
        if (rdt) {
            rdt.walletApi.sendRequest();
            
            // Add a timeout for the wallet connection (e.g. 60 seconds)
            setTimeout(() => {
                setState(prev => {
                    // Only reset if we are still loading
                    if (prev.isLoading) {
                        return { ...prev, isLoading: false, error: 'Connection timed out. Please try again.' };
                    }
                    return prev;
                });
            }, 60000); // 60 seconds timeout
            
        } else {
            setState(prev => ({ ...prev, isLoading: false, error: 'Toolkit failed to initialize.' }));
        }
    }, 100);
  };

  const disconnect = () => {
    const rdt = getOrCreateToolkit(state.activeNetworkId || RadixNetworkId.Stokenet);
    if (rdt) {
       // Clear session on backend if needed, for now just disconnect client
       rdt.disconnect();
    }
    setState({
      isConnected: false,
      isLoading: false,
      isExtensionAvailable: true,
      accounts: [],
      persona: undefined,
      personaData: [],
      error: null,
      activeNetworkId: null,
    });
  };

  return (
    <RadixWalletContext.Provider value={{ ...state, connect, disconnect }}>
      {children}
    </RadixWalletContext.Provider>
  );
}
