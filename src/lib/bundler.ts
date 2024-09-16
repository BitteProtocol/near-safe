// TODO: Ethers dependency is only for Generic HTTP Provider
import { ethers } from "ethers";
import { toHex } from "viem";

import {
  GasPrices,
  PaymasterData,
  UnsignedUserOperation,
  UserOperation,
  UserOperationReceipt,
} from "../types.js";
import { PLACEHOLDER_SIG } from "../util.js";

function bundlerUrl(chainId: number, apikey: string): string {
  return `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${apikey}`;
}

export class Erc4337Bundler {
  provider: ethers.JsonRpcProvider;
  entryPointAddress: string;
  apiKey: string;
  chainId: number;

  constructor(entryPointAddress: string, apiKey: string, chainId: number) {
    this.entryPointAddress = entryPointAddress;
    this.apiKey = apiKey;
    this.chainId = chainId;
    this.provider = new ethers.JsonRpcProvider(bundlerUrl(chainId, apiKey));
  }

  client(chainId: number): ethers.JsonRpcProvider {
    return new ethers.JsonRpcProvider(bundlerUrl(chainId, this.apiKey));
  }

  async getPaymasterData(
    rawUserOp: UnsignedUserOperation,
    usePaymaster: boolean,
    safeNotDeployed: boolean
  ): Promise<PaymasterData> {
    // TODO: Keep this option out of the bundler
    if (usePaymaster) {
      console.log("Requesting paymaster data...");
      const data = this.provider.send("pm_sponsorUserOperation", [
        { ...rawUserOp, signature: PLACEHOLDER_SIG },
        this.entryPointAddress,
      ]);
      return data;
    }
    return defaultPaymasterData(safeNotDeployed);
  }

  async sendUserOperation(userOp: UserOperation): Promise<string> {
    try {
      const userOpHash = await this.provider.send("eth_sendUserOperation", [
        userOp,
        this.entryPointAddress,
      ]);
      return userOpHash;
    } catch (err: unknown) {
      const error = (err as ethers.JsonRpcError).error;
      throw new Error(`Failed to send user op with: ${error.message}`);
    }
  }

  async getGasPrice(): Promise<GasPrices> {
    return this.provider.send("pimlico_getUserOperationGasPrice", []);
  }

  async _getUserOpReceiptInner(
    userOpHash: string
  ): Promise<UserOperationReceipt | null> {
    return this.provider.send("eth_getUserOperationReceipt", [userOpHash]);
  }

  async getUserOpReceipt(userOpHash: string): Promise<UserOperationReceipt> {
    let userOpReceipt: UserOperationReceipt | null = null;
    while (!userOpReceipt) {
      // Wait 2 seconds before checking the status again
      await new Promise((resolve) => setTimeout(resolve, 2000));
      userOpReceipt = await this._getUserOpReceiptInner(userOpHash);
    }
    return userOpReceipt;
  }
}

// TODO(bh2smith) Should probably get reasonable estimates here:
const defaultPaymasterData = (safeNotDeployed: boolean): PaymasterData => {
  return {
    verificationGasLimit: toHex(safeNotDeployed ? 500000 : 100000),
    callGasLimit: toHex(100000),
    preVerificationGas: toHex(100000),
  };
};
