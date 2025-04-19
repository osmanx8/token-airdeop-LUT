import { Keypair, PublicKey, Connection, AddressLookupTableAccount } from "@solana/web3.js"
import bs58 from "bs58"
import dotenv from "dotenv";
dotenv.config();

const RPC_ENDPOINT = process.env.RPC_URL as string
const Fromkeypair = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY as string))
const walletPubkey = "EGtfnmBsC6vjFGnm3PV3ePyWHpw8zXKkVVC7pj8PGEJ2"
const TRANSFER_AMOUNT = 2000
const PAYER = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY!));

const connection = new Connection(process.env.RPC_URL!)
let MINT_ADDRESS = new PublicKey("7yVYYJatPwxGooeeXX9YvUpdbWinLbuy7nsTJRgH8Sj8")                                    //!insert! here.....))
const walletNum = 40
const chunkSize = 30 //number of wallet per instruction
const inst_Num = 20 //the number of instruction per transaction
const num_lookupTable = Math.ceil(walletNum / chunkSize)
const tx_attempt = Math.ceil(walletNum / inst_Num) //the numver of transaction
const num_transaction = Math.ceil(walletNum / inst_Num) //2
const lookupTableAddress: PublicKey[] = []
let lookupTableAccount: AddressLookupTableAccount[] = []
export {
    RPC_ENDPOINT, Fromkeypair, walletPubkey, TRANSFER_AMOUNT, PAYER, connection,
    MINT_ADDRESS, walletNum, inst_Num, chunkSize, num_lookupTable, tx_attempt, num_transaction, lookupTableAccount, lookupTableAddress
}
