import {
  Address,
  createPublicClient,
  Hash,
  http,
  PublicClient,
  rpcSchema,
  Transport,
  RpcError,
  HttpRequestError,
} from "viem";

import {
  GasPrices,
  PaymasterData,
  SponsorshipPoliciesResponse,
  SponsorshipPolicyData,
  UnsignedUserOperation,
  UserOperation,
  UserOperationGas,
  UserOperationReceipt,
} from "../types";
import { PLACEHOLDER_SIG } from "../util";

function bundlerUrl(chainId: number, apikey: string): string {
  return `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${apikey}`;
}

type SponsorshipPolicy = { sponsorshipPolicyId: string };

type BundlerRpcSchema = [
  {
    Method: "pm_sponsorUserOperation";
    // TODO(bh2smith): Add possiblity to not supply policy:
    // [UnsignedUserOperation, Address]
    Parameters: [UnsignedUserOperation, Address, SponsorshipPolicy];
    ReturnType: PaymasterData;
  },
  {
    Method: "eth_estimateUserOperationGas";
    Parameters: [UnsignedUserOperation, Address];
    ReturnType: UserOperationGas;
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
    sponsorshipPolicy?: string
  ): Promise<PaymasterData> {
    const userOp = { ...rawUserOp, signature: PLACEHOLDER_SIG };
    if (sponsorshipPolicy) {
      console.log("Requesting paymaster data...");
      return handleRequest<PaymasterData>(() =>
        this.client.request({
          method: "pm_sponsorUserOperation",
          params: [
            userOp,
            this.entryPointAddress,
            { sponsorshipPolicyId: sponsorshipPolicy },
          ],
        })
      );
    }
    console.log("Estimating user operation gas...");
    return handleRequest<UserOperationGas>(() =>
      this.client.request({
        method: "eth_estimateUserOperationGas",
        params: [userOp, this.entryPointAddress],
      })
    );
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

  // New method to query sponsorship policies
  async getSponsorshipPolicies(): Promise<SponsorshipPolicyData[]> {
    const url = `https://api.pimlico.io/v2/account/sponsorship_policies?apikey=${this.apiKey}`;
    const allPolocies = await handleRequest<SponsorshipPoliciesResponse>(
      async () => {
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(
            `HTTP error! status: ${response.status}: ${response.statusText}`
          );
        }
        return response.json();
      }
    );
    return allPolocies.data.filter((p) =>
      p.chain_ids.allowlist.includes(this.chainId)
    );
  }
}

async function handleRequest<T>(clientMethod: () => Promise<T>): Promise<T> {
  try {
    return await clientMethod();
  } catch (error) {
    const message = stripApiKey(error);
    if (error instanceof HttpRequestError) {
      if (error.status === 401) {
        throw new Error(
          "Unauthorized request. Please check your Pimlico API key."
        );
      } else {
        throw new Error(`Pimlico: ${message}`);
      }
    } else if (error instanceof RpcError) {
      throw new Error(`Failed to send user op with: ${message}`);
    }
    throw new Error(`Bundler Request: ${message}`);
  }
}

export function stripApiKey(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/(apikey=)[^\s&]+/, "$1***");
  // Could also do this with slicing.
  // const keyStart = message.indexOf("apikey=") + 7;
  // // If no apikey in the message, return it as is.
  // if (keyStart === -1) return message;
  // return `${message.slice(0, keyStart)}***${message.slice(keyStart + 36)}`;
}
