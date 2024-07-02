import { ethers } from "ethers";
import { Address } from "viem";

export interface UnsignedUserOperation {
  sender: ethers.AddressLike;
  nonce: string;
  factory?: ethers.AddressLike;
  factoryData?: ethers.BytesLike;
  callData: string;
  maxPriorityFeePerGas: string;
  maxFeePerGas: string;
}

/**
 * Supported Representation of UserOperation for EntryPoint v0.7
 */
export interface UserOperation extends UnsignedUserOperation {
  verificationGasLimit: string;
  callGasLimit: string;
  preVerificationGas: string;
  signature?: string;
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
  recoveryAddress: string | undefined;
  safeSaltNonce: string;
}

export type TStatus = "success" | "reverted";
export type Hex = `0x${string}`;
export type Hash = `0x${string}`;

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
  blockHash: Hash;
  blockNumber: bigint;
  from: Address;
  to: Address | null;
  cumulativeGasUsed: bigint;
  status: TStatus;
  gasUsed: bigint;
  contractAddress: Address | null;
  logsBloom: Hex;
  effectiveGasPrice: bigint;
}

export type UserOperationReceipt = {
  userOpHash: Hash;
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
