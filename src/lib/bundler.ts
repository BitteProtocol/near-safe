import {
  Address,
  createPublicClient,
  Hash,
  http,
  PublicClient,
  rpcSchema,
  toHex,
  Transport,
  RpcError,
  HttpRequestError,
} from "viem";

import {
  GasPrices,
  PaymasterData,
  UnsignedUserOperation,
  UserOperation,
  UserOperationReceipt,
} from "../types";
import { PLACEHOLDER_SIG } from "../util";

function bundlerUrl(chainId: number, apikey: string): string {
  return `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${apikey}`;
}

type BundlerRpcSchema = [
  {
    Method: "pm_sponsorUserOperation";
    Parameters: [UnsignedUserOperation, Address];
    ReturnType: PaymasterData;
  },
  {
    Method: "eth_sendUserOperation";
    Parameters: [UserOperation, Address];
    ReturnType: Hash;
  },
  {
    Method: "pimlico_getUserOperationGasPrice";
    Parameters: [];
    ReturnType: GasPrices;
  },
  {
    Method: "eth_getUserOperationReceipt";
    Parameters: [Hash];
    ReturnType: UserOperationReceipt | null;
  },
];

export class Erc4337Bundler {
  client: PublicClient<Transport, undefined, undefined, BundlerRpcSchema>;
  entryPointAddress: Address;
  apiKey: string;
  chainId: number;

  constructor(entryPointAddress: Address, apiKey: string, chainId: number) {
    this.entryPointAddress = entryPointAddress;
    this.apiKey = apiKey;
    this.chainId = chainId;
    this.client = createPublicClient({
      transport: http(bundlerUrl(chainId, this.apiKey)),
      rpcSchema: rpcSchema<BundlerRpcSchema>(),
    });
  }

  async getPaymasterData(
    rawUserOp: UnsignedUserOperation,
    usePaymaster: boolean,
    safeNotDeployed: boolean
  ): Promise<PaymasterData> {
    // TODO: Keep this option out of the bundler
    if (usePaymaster) {
      console.log("Requesting paymaster data...");
      return handleRequest<PaymasterData>(() =>
        this.client.request({
          method: "pm_sponsorUserOperation",
          params: [
            { ...rawUserOp, signature: PLACEHOLDER_SIG },
            this.entryPointAddress,
          ],
        })
      );
    }
    return defaultPaymasterData(safeNotDeployed);
  }

  async sendUserOperation(userOp: UserOperation): Promise<Hash> {
    return handleRequest<Hash>(() =>
      this.client.request({
        method: "eth_sendUserOperation",
        params: [userOp, this.entryPointAddress],
      })
    );
    // throw new Error(`Failed to send user op with: ${error.message}`);
  }

  async getGasPrice(): Promise<GasPrices> {
    return handleRequest<GasPrices>(() =>
      this.client.request({
        method: "pimlico_getUserOperationGasPrice",
        params: [],
      })
    );
  }

  async getUserOpReceipt(userOpHash: Hash): Promise<UserOperationReceipt> {
    let userOpReceipt: UserOperationReceipt | null = null;
    while (!userOpReceipt) {
      // Wait 2 seconds before checking the status again
      await new Promise((resolve) => setTimeout(resolve, 2000));
      userOpReceipt = await this._getUserOpReceiptInner(userOpHash);
    }
    return userOpReceipt;
  }

  private async _getUserOpReceiptInner(
    userOpHash: Hash
  ): Promise<UserOperationReceipt | null> {
    return handleRequest<UserOperationReceipt | null>(() =>
      this.client.request({
        method: "eth_getUserOperationReceipt",
        params: [userOpHash],
      })
    );
  }
}

async function handleRequest<T>(clientMethod: () => Promise<T>): Promise<T> {
  try {
    return await clientMethod();
  } catch (error) {
    if (error instanceof HttpRequestError) {
      if (error.status === 401) {
        throw new Error("Unauthorized request. Please check your API key.");
      } else {
        console.error(
          `Request failed with status ${error.status}: ${error.message}`
        );
      }
    } else if (error instanceof RpcError) {
      throw new Error(`Failed to send user op with: ${error.message}`);
    }
    throw new Error(
      `Unexpected error ${error instanceof Error ? error.message : String(error)}`
    );
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
