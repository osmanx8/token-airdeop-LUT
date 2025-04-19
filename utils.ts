import { Account, ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, createTransferInstruction, getAccount, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token"
import { AddressLookupTableProgram, ConfirmOptions, Connection, Keypair, ParsedAccountData, PublicKey, sendAndConfirmTransaction, Signer, Transaction, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js"
import { connection, inst_Num, MINT_ADDRESS, num_transaction, walletNum } from "./const";


// custome function----------------------------------------------
export async function createAssociatedTokenAccount(
    connection: Connection,
    payer: Signer,
    mint: PublicKey,
    owner: (PublicKey | any)[],
    confirmOptions?: ConfirmOptions,
    programId = TOKEN_PROGRAM_ID,
    associatedTokenProgramId = ASSOCIATED_TOKEN_PROGRAM_ID,
    allowOwnerOffCurve = false,
) {
    let temp_instructions: TransactionInstruction[] = []
    let associatedToken: PublicKey[] = []
    for (let i = 0; i < owner.length; i++) {
        let owners: PublicKey
        owners = new PublicKey(owner[i])
        associatedToken[i] = getAssociatedTokenAddressSync(
            mint,
            owners,
            allowOwnerOffCurve,
            programId,
            associatedTokenProgramId,
        );
        temp_instructions.push(
            createAssociatedTokenAccountInstruction(
                payer.publicKey,
                associatedToken[i],
                owners,
                mint,
                programId,
                associatedTokenProgramId,

            ));
        if (i % 10 == 0) {
            let transaction = new Transaction().add(...temp_instructions)
            await sendAndConfirmTransaction(connection, transaction, [payer], confirmOptions);
            temp_instructions = []; // reset for next batch
        }

    }

    if (owner.length % 10 != 0) {
        let transaction = new Transaction().add(...temp_instructions)
        await sendAndConfirmTransaction(connection, transaction, [payer], confirmOptions);
    }
    return associatedToken;
}
// custome function-----------------------------------------------

export async function makeDesATA(connection: Connection, Fromkeypair: Keypair, mintAddress: PublicKey, recipient: any, destinatinoAT: PublicKey[]) {

    let desAT: PublicKey[]

    desAT = await createAssociatedTokenAccount(connection, Fromkeypair, mintAddress, recipient)

    for (let i = 0; i < desAT.length; i++)
        destinatinoAT.push(desAT[i])
    desAT = []
}

export async function makeInstruction(sourceATA: Account, connection: Connection, Fromkeypair: Keypair, mintAddress: PublicKey, TRANSFER_AMOUNT: number, destinatinoAT: PublicKey[], transferInstructions: TransactionInstruction[]) {
    try {
        // await waitForNewBlock(connection, 1);
        const numberDecimals = await getNumberDecimals(mintAddress.toString());
        let length = destinatinoAT.length
        for (let i = 0; i < length; i++) {
            // Create transfer instruction ---temp
            console.log("I", i, length)

            const transferInstruction = createTransferInstruction(
                sourceATA.address,
                destinatinoAT[i],
                Fromkeypair.publicKey,
                TRANSFER_AMOUNT * Math.pow(10, numberDecimals)
            );
            transferInstructions.push(transferInstruction);
        }

    } catch (error) {
        console.error(`Error creating token accounts for recipien}:`, error);
        throw error;
    }
}

export async function sendTransaction(transferInstructions: TransactionInstruction[], connection: Connection, Fromkeypair: Keypair, lookupTableAccounts: any[]) {

    console.log("num_transaction", num_transaction)
    console.log("transferInstructions-lenght", transferInstructions.length)

    for (let i = 0; i < num_transaction; i++) {
        console.log("num---", i)
        let start = i * inst_Num
        let end = Math.min(start + inst_Num, walletNum)   //50, 100

        let instruction = transferInstructions.slice(start, end)

        console.log("number,,,", start, end)

        //get the latest blockhash and last valid block height
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

        // Create a new transaction message with the provided instructions
        const messageV0 = new TransactionMessage({
            payerKey: Fromkeypair.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
            recentBlockhash: blockhash, // The blockhash of the most recent block
            instructions: instruction, // The instructions to include in the transaction
        }).compileToV0Message(lookupTableAccounts);
        console.log("error here??????????????", lookupTableAccounts)
        // Create a versioned transaction from the message
        const transaction = new VersionedTransaction(messageV0);

        transaction.sign([Fromkeypair])
        const size = transaction.serialize().length
        console.log("FINAL_transaction size->>>>>>>", size)

        try {
            const txid = await connection.sendTransaction(
                transaction,
                {
                    maxRetries: 5,
                    skipPreflight: false,
                    preflightCommitment: 'confirmed'
                }
            );
            console.log("texis", txid)
            const confirmation = await connection.confirmTransaction({
                signature: txid,
                blockhash: blockhash,
                lastValidBlockHeight: lastValidBlockHeight
            }, 'confirmed');

            if (confirmation.value.err) {
                throw new Error(`Transaction failed: ${confirmation.value.err}`);
            }

            console.log("Transaction successfully confirmed", txid);

        } catch (error) {
            console.error(`Failed to send transaction batch ${i}:`, error);
            throw error;
        }
    }
}


//send versioned Transaction for lookuptable(connection, keypair(user), lookuptable instruction, lookuptableAccounts)
export async function sendV0Transaction(
    connection: Connection,
    user: Keypair,
    instructions: TransactionInstruction[],
    lookupTableAccounts?: any[],
) {

    // Get the latest blockhash and last valid block height
    const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();

    // Create a new transaction message with the provided instructions
    const messageV0 = new TransactionMessage({
        payerKey: user.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
        recentBlockhash: blockhash, // The blockhash of the most recent block
        instructions, // The instructions to include in the transaction
    }).compileToV0Message(lookupTableAccounts);

    // Create a versioned transaction from the message
    const transaction = new VersionedTransaction(messageV0);
    transaction.sign([user])
    const size = transaction.serialize().length
    console.log("EACHVERSIONED-transaction size->>>>>>>", size)
    // Use the helper function to send and confirm the transaction
    const txid = await connection.sendTransaction(
        transaction
    );
    const confirmation = await connection.confirmTransaction(txid, "finalized")
    // const confirmation = await sendAndConfirmTransaction(connection, transaction, [user])
    if (confirmation.value.err) { throw new Error("not confirmed!") }
    return txid
}

//initial lookuptable (keypair, connection, recepients walletaddress, unique for slot == seed)
export async function initializeLookupTable(
    user: Keypair,
    connection: Connection,
    addresses: PublicKey[],
    i: number
): Promise<PublicKey> {
    // Get the current slot using a helper function from @solana/web3.js
    let baseSlot = await connection.getSlot("finalized");
    let slot = baseSlot - i * 50
    // Create an instruction for creating a lookup table
    // and retrieve the address of the new lookup table
    const [lookupTableInst, lookupTableAddress] =
        AddressLookupTableProgram.createLookupTable({
            authority: user.publicKey, // The authority to modify the lookup table
            payer: user.publicKey, // The payer for transaction fees
            recentSlot: slot, // The slot for lookup table address derivation
        });


    // Create an instruction to extend a lookup table with the provided addresses
    const extendInstruction = AddressLookupTableProgram.extendLookupTable({
        payer: user.publicKey, // The payer of transaction fees
        authority: user.publicKey, // The authority to extend the lookup table
        lookupTable: lookupTableAddress, // Address of the lookup table to extend
        addresses: addresses, // Add up to 30 addresses per instruction
    });
    // Use the helper function to send a versioned transaction
    const txid = await sendV0Transaction(connection, user, [
        lookupTableInst,
        extendInstruction,
    ],);
    return lookupTableAddress;
}

export async function waitForNewBlock(
    connection: Connection,
    targetHeight: number,
): Promise<void> {
    console.log(`Waiting for ${targetHeight} new blocks...`);

    // Get the initial block height of the blockchain
    const { lastValidBlockHeight: initialBlockHeight } =
        await connection.getLatestBlockhash();

    return new Promise((resolve) => {
        const SECOND = 1000;
        const checkInterval = 1 * SECOND; // Interval to check for new blocks (1000ms)

        // Set an interval to check for new block heights
        const intervalId = setInterval(async () => {
            try {
                // Get the current block height
                const { lastValidBlockHeight: currentBlockHeight } =
                    await connection.getLatestBlockhash();

                // If the current block height exceeds the target, resolve and clear interval
                if (currentBlockHeight >= initialBlockHeight + targetHeight) {
                    clearInterval(intervalId);
                    console.log(`New block height reached: ${currentBlockHeight}`);
                    resolve();
                }
            } catch (error) {
                console.error("Error fetching block height:", error);
                clearInterval(intervalId);
                resolve(); // Resolve to avoid hanging in case of errors
            }
        }, checkInterval);
    });
}

export async function getNumberDecimals(mintAddress: string): Promise<number> {
    const info = await connection.getParsedAccountInfo(new PublicKey(MINT_ADDRESS));
    const result = (info.value?.data as ParsedAccountData).parsed.info.decimals as number;
    return result;
}
