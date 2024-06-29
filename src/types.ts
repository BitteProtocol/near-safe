import { ethers } from "ethers";

/**
 * Supported Representation of UserOperation for EntryPoint v0.7
 */
export interface UserOperation {
  sender: ethers.AddressLike;
  nonce: string;
  factory?: ethers.AddressLike;
  factoryData?: ethers.BytesLike;
  callData: string;
  verificationGasLimit: string;
  callGasLimit: string;
  preVerificationGas: string;
  maxPriorityFeePerGas: string;
  maxFeePerGas: string;
  signature?: string;
}

export interface PaymasterData {
  paymaster?: string;
  paymasterData?: string;
  paymasterVerificationGasLimit?: string;
  paymasterPostOpGasLimit?: string;
  verificationGasLimit: string;
  callGasLimit: string;
  preVerificationGas: string;
}

export interface UserOptions {
  usePaymaster: boolean;
  recoveryAddress: string | undefined;
  safeSaltNonce: string;
}
