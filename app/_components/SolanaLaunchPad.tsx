'use client';
import React, { useState } from 'react';
import { Rocket } from 'lucide-react';
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import {
    createUmi,
    generateSigner,
    percentAmount,
    publicKey,
    PublicKey,
} from '@metaplex-foundation/umi';
import {
    createV1,
    TokenStandard,
} from '@metaplex-foundation/mpl-token-metadata';
import { createSignerFromWalletAdapter } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const SPL_TOKEN_2022_PROGRAM_ID = publicKey(
    'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
);

export function SolanaLaunchPad() {
    const [tokenName, setTokenName] = useState('');
    const [tokenSymbol, setTokenSymbol] = useState('');
    const [decimals, setDecimals] = useState(9);
    const [supply, setSupply] = useState(1000000);
    const [freezeAuthority, setFreezeAuthority] = useState(false);
    const [isLaunching, setIsLaunching] = useState(false);
    const [launchStatus, setLaunchStatus] = useState('');

    const wallet = useWallet();
    const { connection } = useConnection();



    async function handleLaunch() {
        if (!wallet.publicKey) {
            setLaunchStatus('Please connect your wallet first.');
            return;
        }

        setIsLaunching(true);
        setLaunchStatus('Launching token...');

        try {
            const umi = createUmi().use(mplTokenMetadata());
            const walletAdapter = createSignerFromWalletAdapter(wallet);
            umi.use(createSignerFromWalletAdapter(wallet));

            const mint = generateSigner(umi);

            const freezeAuthorityKey = freezeAuthority ? umi.identity.publicKey : null;

            await createV1(umi, {
                mint,
                authority: umi.identity,
                name: tokenName,
                symbol: tokenSymbol,
                uri: '',
                sellerFeeBasisPoints: percentAmount(0),
                decimals,
                tokenStandard: TokenStandard.Fungible,
                splTokenProgram: SPL_TOKEN_2022_PROGRAM_ID,
            }).sendAndConfirm(umi);

            setLaunchStatus(`Token launched successfully! Mint address: ${mint.publicKey}`);
        } catch (error: any) {
            console.error('Error launching token:', error);
            setLaunchStatus(`Error launching token: ${error.message}`);
        } finally {
            setIsLaunching(false);
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
            <div className="w-full max-w-3xl bg-white shadow-xl rounded-2xl p-8 space-y-8">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-gray-800 mb-2">Solana Token Launchpad</h1>
                    <p className="text-gray-600">Create and launch your Solana token in 3 simple steps</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input
                        placeholder="Token Name"
                        value={tokenName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTokenName(e.target.value)}
                        className="w-full"
                    />
                    <Input
                        placeholder="Token Symbol"
                        value={tokenSymbol}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTokenSymbol(e.target.value)}
                        className="w-full"
                    />
                    <Input
                        type="number"
                        placeholder="Decimals"
                        value={decimals}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDecimals(parseInt(e.target.value))}
                        className="w-full"
                    />
                    <Input
                        type="number"
                        placeholder="Initial Supply"
                        value={supply}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSupply(parseInt(e.target.value))}
                        className="w-full"
                    />
                    <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={freezeAuthority}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFreezeAuthority(e.target.checked)}
                            className="form-checkbox h-5 w-5 text-blue-600"
                        />
                        <span className="text-gray-700">Enable Freeze Authority</span>
                    </label>
                </div>

                <Button
                    onClick={handleLaunch}
                    disabled={isLaunching || !wallet.connected}
                    className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-3 rounded-lg shadow-md hover:shadow-lg transition duration-300 flex items-center justify-center"
                >
                    <Rocket className="mr-2" />
                    {isLaunching ? 'Launching...' : 'Launch Token'}
                </Button>

                <div className="text-center mt-4">
                    <p>{launchStatus}</p>
                </div>
            </div>
        </div>
    );
}