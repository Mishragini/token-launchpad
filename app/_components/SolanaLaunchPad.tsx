'use client';
import React, { useState, useCallback } from 'react';
import {
    generateSigner,
    percentAmount,
    signerIdentity,
    publicKey,
} from '@metaplex-foundation/umi';
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";

import { PublicKey } from '@metaplex-foundation/umi-public-keys';
import {
    createV1,
    mplTokenMetadata,
    TokenStandard,
} from '@metaplex-foundation/mpl-token-metadata';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Transaction as SolanaTransaction } from '@solana/web3.js';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Rocket, Upload } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

import '@solana/wallet-adapter-react-ui/styles.css';

const SPL_TOKEN_2022_PROGRAM_ID: PublicKey = publicKey(
    'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
);

async function uploadImage(file: File): Promise<string> {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(`https://example.com/images/${file.name}`);
        }, 2000);
    });
}

export function SolanaLaunchPad() {
    const [tokenName, setTokenName] = useState('');
    const [tokenSymbol, setTokenSymbol] = useState('');
    const [decimals, setDecimals] = useState(9);
    const [supply, setSupply] = useState(1000000);
    const [freezeAuthority, setFreezeAuthority] = useState(false);
    const [isLaunching, setIsLaunching] = useState(false);
    const [launchStatus, setLaunchStatus] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const wallet = useWallet();
    const { connection } = useConnection();

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            setIsUploading(true);
            try {
                const url = await uploadImage(acceptedFiles[0]);
                setImageUrl(url);
            } catch (error) {
                console.error('Error uploading image:', error);
                setLaunchStatus('Failed to upload image. Please try again.');
            } finally {
                setIsUploading(false);
            }
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

    async function handleLaunch() {
        if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) {
            setLaunchStatus('Please connect your wallet first.');
            return;
        }

        if (!imageUrl) {
            setLaunchStatus('Please upload an image for your token.');
            return;
        }

        setIsLaunching(true);
        setLaunchStatus('Launching token...');

        try {
            const umiPublicKey = publicKey(wallet.publicKey.toBase58());

            const customSigner = {
                publicKey: umiPublicKey,
                async signTransaction(transaction: any): Promise<any> {
                    const solanaTransaction = transaction as unknown as SolanaTransaction;
                    return wallet.signTransaction!(solanaTransaction) as unknown as any;
                },
                async signAllTransactions(transactions: any[]): Promise<any[]> {
                    const solanaTransactions = transactions as unknown as SolanaTransaction[];
                    const signedTransactions = await wallet.signAllTransactions!(solanaTransactions);
                    return signedTransactions as unknown as any[];
                },
                async signMessage(message: Uint8Array): Promise<Uint8Array> {
                    throw new Error('signMessage method not implemented.');
                }
            };
            const umi = createUmi(connection)
                .use(signerIdentity(customSigner))
                .use(mplTokenMetadata());


            umi.use(signerIdentity(customSigner));

            const mint = generateSigner(umi);

            const tx = createV1(umi, {
                mint,
                authority: umi.identity,
                name: tokenName,
                symbol: tokenSymbol,
                uri: imageUrl,
                sellerFeeBasisPoints: percentAmount(0),
                decimals: decimals,
                tokenStandard: TokenStandard.Fungible,
                splTokenProgram: SPL_TOKEN_2022_PROGRAM_ID,
            });

            const result = await tx.sendAndConfirm(umi);
            setLaunchStatus(`Token launched successfully! Mint address: ${mint.publicKey}`);
        } catch (error: any) {
            console.error('Error launching token:', error);
            setLaunchStatus(`Error launching token: ${error.message}`);
        } finally {
            setIsLaunching(false);
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
            <header className="w-full p-4 flex justify-end">
                <WalletMultiButton />
            </header>
            <main className="flex-grow flex items-center justify-center p-4">
                <div className="w-full max-w-3xl bg-white shadow-xl rounded-2xl p-8 space-y-8">
                    <div className="text-center">
                        <h1 className="text-4xl font-bold text-gray-800 mb-2">Solana Token Launchpad</h1>
                        <p className="text-gray-600">Create and launch your Solana token in one simple step</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Input
                            placeholder="Token Name"
                            value={tokenName}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTokenName(e.target.value)}
                            className="w-full"
                            disabled={!wallet.connected}
                        />
                        <Input
                            placeholder="Token Symbol"
                            value={tokenSymbol}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTokenSymbol(e.target.value)}
                            className="w-full"
                            disabled={!wallet.connected}
                        />
                        <Input
                            type="number"
                            placeholder="Decimals"
                            value={decimals}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDecimals(parseInt(e.target.value))}
                            className="w-full"
                            disabled={!wallet.connected}
                        />
                        <Input
                            type="number"
                            placeholder="Initial Supply"
                            value={supply}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSupply(parseInt(e.target.value))}
                            className="w-full"
                            disabled={!wallet.connected}
                        />
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={freezeAuthority}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFreezeAuthority(e.target.checked)}
                                className="form-checkbox h-5 w-5 text-blue-600"
                                disabled={!wallet.connected}
                            />
                            <span className="text-gray-700">Enable Freeze Authority</span>
                        </label>
                    </div>

                    <div
                        {...getRootProps()}
                        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-500'
                            } ${!wallet.connected ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <input {...getInputProps()} disabled={!wallet.connected} />
                        {imageUrl ? (
                            <div className="flex flex-col items-center">
                                <img src={imageUrl} alt="Token" className="w-32 h-32 object-cover rounded-lg mb-2" />
                                <p className="text-sm text-gray-500">Image uploaded successfully</p>
                            </div>
                        ) : isUploading ? (
                            <p className="text-gray-500">Uploading image...</p>
                        ) : (
                            <div className="flex flex-col items-center">
                                <Upload className="w-12 h-12 text-gray-400 mb-2" />
                                <p className="text-gray-500">
                                    {wallet.connected
                                        ? "Drag & drop an image here, or click to select one"
                                        : "Connect your wallet to upload an image"
                                    }
                                </p>
                            </div>
                        )}
                    </div>

                    <Button
                        onClick={handleLaunch}
                        disabled={isLaunching || !wallet.connected || !imageUrl}
                        className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-3 rounded-lg shadow-md hover:shadow-lg transition duration-300 flex items-center justify-center"
                    >
                        <Rocket className="mr-2" />
                        {isLaunching ? 'Launching...' : 'Launch Token'}
                    </Button>

                    <div className="text-center mt-4">
                        <p className={`${launchStatus.includes('Error') ? 'text-red-500' : 'text-green-500'}`}>
                            {launchStatus}
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default SolanaLaunchPad;
