import { ethers } from "ethers";

const DUMMY_ECDSA_SIG =
  "0x000000000000000000000000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

export class Erc4337Bundler {
  bundlerUrl: string;
  entryPointAddress: string;

  constructor(bundlerUrl: string, entryPointAddress: string) {
    this.bundlerUrl = bundlerUrl;
    this.entryPointAddress = entryPointAddress;
  }

  async getPaymasterData(
    rawUserOp: any,
    usePaymaster: boolean,
    safeNotDeployed: boolean,
  ): Promise<PaymasterData> {
    // TODO(bh2smith) Should probably get reasonable estimates here:
    let paymasterData = {
      verificationGasLimit: ethers.toBeHex(safeNotDeployed ? 500000 : 100000),
      callGasLimit: ethers.toBeHex(100000),
      preVerificationGas: ethers.toBeHex(100000),
    };
    if (usePaymaster) {
      console.log("Requesting paymaster data");
      const pimlicoProvider = new ethers.JsonRpcProvider(this.bundlerUrl);
      paymasterData = await pimlicoProvider.send("pm_sponsorUserOperation", [
        { ...rawUserOp, signature: DUMMY_ECDSA_SIG },
        this.entryPointAddress,
      ]);
      console.log("PaymasterData", paymasterData);
    }
    return paymasterData;
  }

  async sendUserOperation(userOp: UserOperation) {
    const response = await fetch(this.bundlerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_sendUserOperation",
        id: 4337,
        params: [userOp, this.entryPointAddress],
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

  async getUserOpReceiptInner(userOpHash: string) {
    const response = await fetch(this.bundlerUrl, {
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

  async getUserOpReceipt(userOpHash: string) {
    let userOpReceipt = null;
    while (!userOpReceipt) {
      // Wait 2 seconds before checking the status again
      await new Promise((resolve) => setTimeout(resolve, 2000));
      userOpReceipt = await this.getUserOpReceiptInner(userOpHash);
    }
    return userOpReceipt;
  }
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
