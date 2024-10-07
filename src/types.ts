import { FunctionCallTransaction, SignArgs } from "near-ca";
import { Address, Hex, ParseAbi } from "viem";

/**
 * Represents a collection of Safe contract deployments, each with its own address and ABI.
 */
export type SafeDeployments = {
  /** Deployment for the singleton contract. */
  singleton: Deployment;
  /** Deployment for the proxy factory contract. */
  proxyFactory: Deployment;
  /** Deployment for the module setup contract. */
  moduleSetup: Deployment;
  /** Deployment for the m4337 module contract. */
  m4337: Deployment;
  /** Deployment for the entry point contract. */
  entryPoint: Deployment;
};

/**
 * Represents the details of a deployed contract, including its ABI and address.
 */
export interface Deployment {
  /** The ABI of the deployed contract. Can be a raw ABI array or a parsed ABI. */
  abi: unknown[] | ParseAbi<readonly string[]>;
  /** The address of the deployed contract. */
  address: Address;
}

/**
 * Represents an unsigned user operation that can be sent to the EntryPoint contract.
 */
export interface UnsignedUserOperation {
  /** The sender's address initiating the user operation. */
  sender: Address;
  /** The unique nonce associated with this user operation. */
  nonce: string;
  /** The optional factory address to use for creating new contracts. */
  factory?: Address;
  /** Optional additional data for the factory, typically used for contract initialization. */
  factoryData?: Hex;
  /** The encoded data for the contract call or transaction execution. */
  callData: Hex;
  /** Maximum priority fee per gas unit for the transaction. */
  maxPriorityFeePerGas: Hex;
  /** Maximum fee per gas unit for the transaction. */
  maxFeePerGas: Hex;
}

/**
 * Supported representation of a user operation for EntryPoint version 0.7, including gas limits and signature.
 */
export interface UserOperation extends UnsignedUserOperation {
  /** The gas limit for verification of the operation. */
  verificationGasLimit: Hex;
  /** The gas limit for the execution of the operation call. */
  callGasLimit: Hex;
  /** The gas used before verification begins. */
  preVerificationGas: Hex;
  /** Optional signature for the user operation. */
  signature?: Hex;
}

/**
 * Represents additional paymaster-related data for a user operation.
 */
export interface PaymasterData {
  /** Optional paymaster address responsible for covering gas costs. */
  paymaster?: Address;
  /** Optional additional data required by the paymaster. */
  paymasterData?: Hex;
  /** The gas limit for paymaster verification. */
  paymasterVerificationGasLimit?: Hex;
  /** The gas limit for paymaster post-operation execution. */
  paymasterPostOpGasLimit?: Hex;
  /** The gas limit for operation verification. */
  verificationGasLimit: Hex;
  /** The gas limit for the operation call execution. */
  callGasLimit: Hex;
  /** The gas used before verification begins. */
  preVerificationGas: Hex;
}

/**
 * User configuration options for transaction building and user operation execution.
 */
export interface UserOptions {
  /** Whether to use a paymaster for gas fee coverage. */
  usePaymaster: boolean;
  /** The unique nonce used to differentiate multiple Safe setups. */
  safeSaltNonce: string;
  /** The NEAR contract ID for the MPC contract. */
  mpcContractId: string;
  /** Optional recovery address in case of key compromise or other emergency situations. */
  recoveryAddress?: string;
}

/**
 * Represents the possible transaction statuses.
 */
export type TxStatus = "success" | "reverted";

/**
 * Represents a log entry in a transaction receipt.
 */
interface Log {
  /** The index of the log in the transaction. */
  logIndex: string;
  /** The index of the transaction within the block. */
  transactionIndex: string;
  /** The hash of the transaction containing the log. */
  transactionHash: string;
  /** The hash of the block containing the transaction. */
  blockHash: string;
  /** The number of the block containing the transaction. */
  blockNumber: string;
  /** The address that generated the log. */
  address: string;
  /** The raw data of the log. */
  data: string;
  /** The topics associated with the log event. */
  topics: string[];
}

/**
 * Represents a transaction receipt returned by the blockchain.
 */
interface Receipt {
  /** The hash of the transaction. */
  transactionHash: Hex;
  /** The index of the transaction within the block. */
  transactionIndex: bigint;
  /** The hash of the block containing the transaction. */
  blockHash: Hex;
  /** The number of the block containing the transaction. */
  blockNumber: bigint;
  /** The address from which the transaction originated. */
  from: Address;
  /** Optional address to which the transaction was sent (if applicable). */
  to?: Address;
  /** The cumulative gas used in the block up to this transaction. */
  cumulativeGasUsed: bigint;
  /** The status of the transaction (success or reverted). */
  status: TxStatus;
  /** The total gas used by this transaction. */
  gasUsed: bigint;
  /** Optional address of a newly deployed contract (if applicable). */
  contractAddress?: Address;
  /** The logs bloom filter for the transaction. */
  logsBloom: Hex;
  /** The effective gas price used in the transaction. */
  effectiveGasPrice: bigint;
}

/**
 * Represents the receipt of a user operation including its details, logs, and result.
 */
export type UserOperationReceipt = {
  /** The hash of the user operation. */
  userOpHash: Hex;
  /** The address of the entry point contract handling the user operation. */
  entryPoint: Address;
  /** The sender's address initiating the user operation. */
  sender: Address;
  /** The nonce of the user operation. */
  nonce: bigint;
  /** Optional paymaster address responsible for covering gas costs. */
  paymaster?: Address;
  /** The actual gas used by the operation. */
  actualGasUsed: bigint;
  /** The actual gas cost of the operation. */
  actualGasCost: bigint;
  /** Whether the user operation succeeded or failed. */
  success: boolean;
  /** Optional reason for failure if the operation was unsuccessful. */
  reason?: string;
  /** The transaction receipt associated with the user operation. */
  receipt: Receipt;
  /** The list of logs generated by the user operation. */
  logs: Log[];
};

/**
 * Represents the different gas prices for transaction execution based on priority levels.
 */
export interface GasPrices {
  /** Gas price for slower transactions. */
  slow: GasPrice;
  /** Gas price for standard transactions. */
  standard: GasPrice;
  /** Gas price for fast transactions. */
  fast: GasPrice;
}

/**
 * Represents a specific gas price configuration for transaction execution.
 */
export interface GasPrice {
  /** Maximum fee per gas unit for the transaction. */
  maxFeePerGas: Hex;
  /** Maximum priority fee per gas unit for the transaction. */
  maxPriorityFeePerGas: Hex;
}

/**
 * Enum representing the type of operation in a meta-transaction.
 */
export enum OperationType {
  /** Standard call operation (0). */
  Call = 0,
  /** Delegate call operation (1). */
  DelegateCall = 1,
}

/**
 * Represents a meta-transaction, which includes the destination address, value, data, and type of operation.
 */
export interface MetaTransaction {
  /** The destination address for the meta-transaction. */
  readonly to: string;
  /** The value to be sent with the transaction (as a string to handle large numbers). */
  readonly value: string;
  /** The encoded data for the contract call or function execution. */
  readonly data: string;
  /** Optional type of operation (call or delegate call). */
  readonly operation?: OperationType;
}

/**
 * Represents raw transaction data for an EVM transaction.
 */
export interface EvmTransactionData {
  /** The chain ID of the network where the transaction is being executed. */
  chainId: number;
  /** The raw data of the transaction. */
  data: string;
  /** The hash of the transaction. */
  hash: string;
}

/**
 * Represents the decoded details of a multisend transaction.
 */
export interface DecodedMultisend {
  /** The chain ID of the network where the multisend transaction is being executed. */
  chainId: number;
  /** The estimated cost of the multisend transaction in Ether. */
  costEstimate: string;
  /** The list of meta-transactions included in the multisend. */
  transactions: MetaTransaction[];
}

/**
 * Represents encoded transaction data for both NEAR and EVM networks.
 */
export interface EncodedTxData {
  /** The encoded transaction data for the EVM network. */
  evmData: EvmTransactionData;
  /** The encoded payload for a NEAR function call, including the signing arguments. */
  nearPayload: FunctionCallTransaction<{
    request: SignArgs;
  }>;
}
