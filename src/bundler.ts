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

const DUMMY_ECDSA_SIG =
  "0x000000000000000000000000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
export async function getPaymasterData(
  bundlerUrl: string,
  entryPointAddress: string,
  rawUserOp: any,
  usePaymaster: boolean,
  safeNotDeployed: boolean,
): Promise<PaymasterData> {
  let paymasterData = {
    verificationGasLimit: ethers.toBeHex(safeNotDeployed ? 500000 : 100000),
    callGasLimit: ethers.toBeHex(100000),
    preVerificationGas: ethers.toBeHex(100000),
  };
  if (usePaymaster) {
    console.log("Requesting paymaster data");
    const pimlicoProvider = new ethers.JsonRpcProvider(bundlerUrl);
    paymasterData = await pimlicoProvider.send("pm_sponsorUserOperation", [
      { ...rawUserOp, signature: DUMMY_ECDSA_SIG },
      entryPointAddress,
    ]);
    console.log("PaymasterData", paymasterData);
  }
  return paymasterData;
}

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

export function packPaymasterData(data: PaymasterData) {
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
