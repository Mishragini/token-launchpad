'use client'
import React, { useState, useCallback, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Keypair, SystemProgram, Transaction, PublicKey } from "@solana/web3.js";
import {
    MINT_SIZE, TOKEN_2022_PROGRAM_ID, createMintToInstruction,
    createAssociatedTokenAccountInstruction, getMintLen,
    createInitializeMetadataPointerInstruction, createInitializeMintInstruction,
    ExtensionType, getAssociatedTokenAddressSync,
    TYPE_SIZE,
    LENGTH_SIZE,
    getAccount,
    createTransferInstruction
} from "@solana/spl-token";
import { createInitializeInstruction, pack } from '@solana/spl-token-metadata';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Rocket, Upload, RefreshCw } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

import '@solana/wallet-adapter-react-ui/styles.css';
import { getSignedURL } from '@/lib/utils';
import SubtleLoadingSpinner from './Loader';

async function uploadImage(file: File) {
    try {
        const signedUrlResult = await getSignedURL(file.name);
        const url = signedUrlResult.success.url;
        await fetch(url, {
            method: 'PUT',
            body: file,
            headers: {
                'Content-Type': file.type,
            },
        });
        const fileUrl = url.split('?')[0];
        return fileUrl;
    } catch (error) {
        console.error('Error uploading image:', error);
        throw new Error('Failed to upload image.');
    }
}

async function uploadMetadata(name: string, symbol: string, description: string, imageUrl: string) {
    try {
        const metadata = JSON.stringify({
            name,
            symbol,
            description,
            image: imageUrl
        });

        const metadataFile = new File([metadata], 'metadata.json', { type: 'application/json' });
        const signedUrlResult = await getSignedURL('metadata.json');
        const url = signedUrlResult.success.url;

        await fetch(url, {
            method: 'PUT',
            body: metadataFile,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const metadataUrl = url.split('?')[0];
        return metadataUrl;
    } catch (error) {
        console.error('Error uploading metadata:', error);
        throw new Error('Failed to upload metadata.');
    }
}

export function SolanaLaunchpad() {
    const [tokenName, setTokenName] = useState('');
    const [tokenSymbol, setTokenSymbol] = useState('');
    const [tokenDescription, setTokenDescription] = useState('');
    const [decimals, setDecimals] = useState(9);
    const [supply, setSupply] = useState(1000000000);
    const [imageUrl, setImageUrl] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [isLaunching, setIsLaunching] = useState(false);
    const [launchStatus, setLaunchStatus] = useState('');
    const [mounted, setMounted] = useState(false);
    const [mintAddress, setMintAddress] = useState<string | null>(null);
    const [tokenBalance, setTokenBalance] = useState<number | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    const { connection } = useConnection();
    const wallet = useWallet();

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            setIsUploading(true);
            try {
                const fileUrl = await uploadImage(acceptedFiles[0]);
                setImageUrl(fileUrl);
            } catch (error) {
                console.error('Error uploading image:', error);
                setLaunchStatus('Failed to upload image. Please try again.');
            } finally {
                setIsUploading(false);
            }
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

    async function createToken() {
        if (!wallet.publicKey || !wallet.signTransaction) {
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
            // Upload metadata
            const metadataUrl = await uploadMetadata(tokenName, tokenSymbol, tokenDescription, imageUrl);

            const mintKeypair = Keypair.generate();
            const metadata = {
                mint: mintKeypair.publicKey,
                name: tokenName,
                symbol: tokenSymbol,
                uri: metadataUrl,
                additionalMetadata: [],
            };

            const mintLen = getMintLen([ExtensionType.MetadataPointer]);
            const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;

            const lamports = await connection.getMinimumBalanceForRentExemption(mintLen + metadataLen);

            const transaction = new Transaction().add(
                SystemProgram.createAccount({
                    fromPubkey: wallet.publicKey,
                    newAccountPubkey: mintKeypair.publicKey,
                    space: mintLen,
                    lamports,
                    programId: TOKEN_2022_PROGRAM_ID,
                }),
                createInitializeMetadataPointerInstruction(
                    mintKeypair.publicKey,
                    wallet.publicKey,
                    mintKeypair.publicKey,
                    TOKEN_2022_PROGRAM_ID
                ),
                createInitializeMintInstruction(
                    mintKeypair.publicKey,
                    decimals,
                    wallet.publicKey,
                    null,
                    TOKEN_2022_PROGRAM_ID
                ),
                createInitializeInstruction({
                    programId: TOKEN_2022_PROGRAM_ID,
                    mint: mintKeypair.publicKey,
                    metadata: mintKeypair.publicKey,
                    name: metadata.name,
                    symbol: metadata.symbol,
                    uri: metadata.uri,
                    mintAuthority: wallet.publicKey,
                    updateAuthority: wallet.publicKey,
                })
            );

            transaction.feePayer = wallet.publicKey;
            transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
            transaction.partialSign(mintKeypair);

            await wallet.sendTransaction(transaction, connection);

            console.log(`Token mint created at ${mintKeypair.publicKey.toBase58()}`);
            const associatedToken = getAssociatedTokenAddressSync(
                mintKeypair.publicKey,
                wallet.publicKey,
                false,
                TOKEN_2022_PROGRAM_ID,
            );

            console.log(associatedToken.toBase58());

            const transaction2 = new Transaction().add(
                createAssociatedTokenAccountInstruction(
                    wallet.publicKey,
                    associatedToken,
                    wallet.publicKey,
                    mintKeypair.publicKey,
                    TOKEN_2022_PROGRAM_ID
                )
            );

            await wallet.sendTransaction(transaction2, connection);

            const transaction3 = new Transaction().add(
                createMintToInstruction(
                    mintKeypair.publicKey,
                    associatedToken,
                    wallet.publicKey,
                    supply * Math.pow(10, decimals),
                    [],
                    TOKEN_2022_PROGRAM_ID
                )
            );

            await wallet.sendTransaction(transaction3, connection);

            setMintAddress(mintKeypair.publicKey.toBase58());
            setLaunchStatus(`Token launched and minted successfully! Mint address: ${mintKeypair.publicKey.toBase58()}`);
            await getTokenBalance(mintKeypair.publicKey);

        } catch (error: any) {
            console.error('Error launching token:', error);
            setLaunchStatus(`Error launching token: ${error.message}`);
        } finally {
            setIsLaunching(false);
        }
    }

    async function getTokenBalance(mintPublicKey: PublicKey) {
        if (!wallet.publicKey) return;

        try {
            const associatedTokenAddress = getAssociatedTokenAddressSync(
                mintPublicKey,
                wallet.publicKey,
                false,
                TOKEN_2022_PROGRAM_ID
            );

            const tokenAccount = await getAccount(connection, associatedTokenAddress, 'confirmed', TOKEN_2022_PROGRAM_ID);
            setTokenBalance(Number(tokenAccount.amount) / Math.pow(10, decimals));
        } catch (error) {
            console.error('Error fetching token balance:', error);
            setTokenBalance(null);
        }
    }

    async function refreshBalance() {
        if (mintAddress) {
            await getTokenBalance(new PublicKey(mintAddress));
        }
    }

    if (!mounted) {
        return <SubtleLoadingSpinner />;
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
                            onChange={(e) => setTokenName(e.target.value)}
                            className="w-full"
                            disabled={!wallet.connected}
                        />
                        <Input
                            placeholder="Token Symbol"
                            value={tokenSymbol}
                            onChange={(e) => setTokenSymbol(e.target.value)}
                            className="w-full"
                            disabled={!wallet.connected}
                        />
                        <Input
                            placeholder="Token Description"
                            value={tokenDescription}
                            onChange={(e) => setTokenDescription(e.target.value)}
                            className="w-full"
                            disabled={!wallet.connected}
                        />
                        <Input
                            type="number"
                            placeholder="Decimals"
                            value={decimals}
                            onChange={(e) => setDecimals(parseInt(e.target.value))}
                            className="w-full"
                            disabled={!wallet.connected}
                        />
                        <Input
                            type="number"
                            placeholder="Initial Supply"
                            value={supply}
                            onChange={(e) => setSupply(parseInt(e.target.value))}
                            className="w-full"
                            disabled={!wallet.connected}
                        />
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
                        onClick={createToken}
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

                    {mintAddress && (
                        <div className="bg-gray-100 p-4 rounded-lg mt-4">
                            <h3 className="text-lg font-semibold mb-2">Token Information</h3>
                            <p><strong>Mint Address:</strong> {mintAddress}</p>
                            <p><strong>Balance:</strong> {tokenBalance !== null ? `${tokenBalance} ${tokenSymbol}` : 'Loading...'}</p>
                            <Button onClick={refreshBalance} className="mt-2 flex items-center">
                                <RefreshCw className="mr-2" />
                                Refresh Balance
                            </Button>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

export default SolanaLaunchpad;