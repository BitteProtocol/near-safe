import { ethers } from "ethers";

export async function sendUserOperation(
  bundlerUrl: string,
  userOp: UserOperation,
  entryPoint: string,
) {
  const response = await fetch(bundlerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_sendUserOperation",
      id: 4337,
      params: [userOp, entryPoint],
    }),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Failed to send user op ${body}`);
  }
  const json = JSON.parse(body);
  if (json.error) {
    throw new Error(JSON.stringify(json.error));
  }
  // This does not contain a transaction receipt! It is the `userOpHash`
  return json.result;
}

export async function getUserOpReceipt(bundlerUrl: string, userOpHash: string) {
  const response = await fetch(bundlerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_getUserOperationReceipt",
      id: 4337,
      params: [userOpHash],
    }),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Failed to send user op ${body}`);
  }
  const json = JSON.parse(body);
  if (json.error) {
    throw new Error(JSON.stringify(json.error));
  }
  return json.result;
}

/**
 * Supported Representation of UserOperation for EntryPoint v0.7
 */
interface UserOperation {
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
  signature: string;
}

export interface PaymasterResponseData {
  paymaster?: string;
  paymasterData?: string;
  paymasterVerificationGasLimit?: string;
  paymasterPostOpGasLimit?: string;
  verificationGasLimit: string;
  callGasLimit: string;
  preVerificationGas: string;
}

export function packPaymasterData(data: PaymasterResponseData) {
  return data.paymaster
    ? ethers.hexlify(
        ethers.concat([
          data.paymaster,
          ethers.toBeHex(data.paymasterVerificationGasLimit || "0x", 16),
          ethers.toBeHex(data.paymasterPostOpGasLimit || "0x", 16),
          data.paymasterData || "0x",
        ]),
      )
    : "0x";
}
