//use zk compression for scale airdrop  token

import { Connection, GetProgramAccountsFilter, ConfirmOptions, Signer, LAMPORTS_PER_SOL, Keypair, ParsedAccountData, PublicKey, sendAndConfirmTransaction, Transaction, AddressLookupTableAccount, AddressLookupTableProgram, VersionedTransaction, TransactionMessage, TransactionInstruction, sendAndConfirmRawTransaction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getOrCreateAssociatedTokenAccount, createTransferInstruction, mintTo, Account, createAssociatedTokenAccountInstruction, getAssociatedTokenAddressSync, getAccount, } from "@solana/spl-token";
import dotenv from "dotenv";
dotenv.config();
import {
    RPC_ENDPOINT, Fromkeypair, walletPubkey, TRANSFER_AMOUNT, PAYER, connection,
    MINT_ADDRESS, walletNum, inst_Num, chunkSize, num_lookupTable, tx_attempt, num_transaction, lookupTableAccount, lookupTableAddress
} from "./const"
import { initializeLookupTable, makeDesATA, makeInstruction, sendTransaction, waitForNewBlock } from "./utils";


async function main() {
    const recipients = await generateWallet(walletNum)

    //create lookupTable and send (1 LUT = 30 * receiptions)
    for (let i = 0; i < num_lookupTable; i++) {
        let start = i * chunkSize
        let end = Math.min(start + chunkSize, walletNum)
        const recipientChunk = recipients.slice(start, end) //(0~30, 30~60,..90~100)
        lookupTableAddress[i] = await initializeLookupTable(
            PAYER,
            connection,
            recipientChunk,
            i
        )
        await waitForNewBlock(connection, 1)

        //fetch lookuptable
        let lookupTable = (
            await connection.getAddressLookupTable(lookupTableAddress[i])
        )
        if (!lookupTable.value) {
            throw new Error("Lookup table not found");
        }
        lookupTableAccount[i] = lookupTable.value
    }

    let transferInstructions: TransactionInstruction[] = []
    let sourceATA = await getOrCreateAssociatedTokenAccount(
        connection,
        Fromkeypair,
        MINT_ADDRESS,
        Fromkeypair.publicKey,
        true
    );
    let mintInstruction: any[] = []
    let destinatinoAT: PublicKey[] = []                           //

    //create Destination ATA
    console.log("1111111111", lookupTableAccount.length)
    for (let i = 0; i < lookupTableAccount.length; i++) {
        for (let j = 0; j < lookupTableAccount[i].state.addresses.length; j++) {
            mintInstruction.push(lookupTableAccount[i].state.addresses[j])
        }
        await makeDesATA(connection, Fromkeypair, MINT_ADDRESS, mintInstruction, destinatinoAT)
        mintInstruction = []
    }
    console.log("222222222222222")
    await makeInstruction(sourceATA, connection, Fromkeypair, MINT_ADDRESS, TRANSFER_AMOUNT, destinatinoAT, transferInstructions)

    console.log("33333333333")
    //send Transaction  including lookup Table
    await sendTransaction(transferInstructions, connection, Fromkeypair, lookupTableAccount)
}
main();



async function generateWallet(Num: number) {
    let wallets = [];
    for (let i = 0; i < Num; i++) {
        const keypair = Keypair.generate();
        wallets.push(keypair.publicKey);
    }
    return wallets;
}

