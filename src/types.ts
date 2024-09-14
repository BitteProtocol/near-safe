import { Address, Hex } from "viem";

export interface UnsignedUserOperation {
  sender: Address;
  nonce: string;
  factory?: Address;
  factoryData?: Hex;
  callData: Hex;
  maxPriorityFeePerGas: Hex;
  maxFeePerGas: Hex;
}

/**
 * Supported Representation of UserOperation for EntryPoint v0.7
 */
export interface UserOperation extends UnsignedUserOperation {
  verificationGasLimit: Hex;
  callGasLimit: Hex;
  preVerificationGas: Hex;
  signature?: Hex;
}

export interface PaymasterData {
  paymaster?: Address;
  paymasterData?: Hex;
  paymasterVerificationGasLimit?: Hex;
  paymasterPostOpGasLimit?: Hex;
  verificationGasLimit: Hex;
  callGasLimit: Hex;
  preVerificationGas: Hex;
}

export interface UserOptions {
  usePaymaster: boolean;
  safeSaltNonce: string;
  mpcContractId: string;
  recoveryAddress?: string;
}

export type TxStatus = "success" | "reverted";

interface Log {
  logIndex: string;
  transactionIndex: string;
  transactionHash: string;
  blockHash: string;
  blockNumber: string;
  address: string;
  data: string;
  topics: string[];
}

interface Receipt {
  transactionHash: Hex;
  transactionIndex: bigint;
  blockHash: Hex;
  blockNumber: bigint;
  from: Address;
  to?: Address;
  cumulativeGasUsed: bigint;
  status: TxStatus;
  gasUsed: bigint;
  contractAddress?: Address;
  logsBloom: Hex;
  effectiveGasPrice: bigint;
}

export type UserOperationReceipt = {
  userOpHash: Hex;
  entryPoint: Address;
  sender: Address;
  nonce: bigint;
  paymaster?: Address;
  actualGasUsed: bigint;
  actualGasCost: bigint;
  success: boolean;
  reason?: string;
  receipt: Receipt;
  logs: Log[];
};

export interface GasPrices {
  slow: GasPrice;
  standard: GasPrice;
  fast: GasPrice;
}

export interface GasPrice {
  maxFeePerGas: Hex;
  maxPriorityFeePerGas: Hex;
}
