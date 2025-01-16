import {
  Address,
  createPublicClient,
  Hash,
  http,
  PublicClient,
  rpcSchema,
  Transport,
} from "viem";

import {
  GasPrices,
  PaymasterData,
  SponsorshipPolicyData,
  UnsignedUserOperation,
  UserOperation,
  UserOperationGas,
  UserOperationReceipt,
} from "../types";
import { PLACEHOLDER_SIG } from "../util";
import { Pimlico } from "./pimlico";

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
  pimlico: Pimlico;
  chainId: number;

  constructor(entryPointAddress: Address, apiKey: string, chainId: number) {
    this.entryPointAddress = entryPointAddress;
    this.pimlico = new Pimlico(apiKey);
    this.chainId = chainId;
    this.client = createPublicClient({
      transport: http(this.pimlico.bundlerUrl(chainId)),
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
      return this.pimlico.handleRequest<PaymasterData>(() =>
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
    return this.pimlico.handleRequest<UserOperationGas>(() =>
      this.client.request({
        method: "eth_estimateUserOperationGas",
        params: [userOp, this.entryPointAddress],
      })
    );
  }

  async sendUserOperation(userOp: UserOperation): Promise<Hash> {
    return this.pimlico.handleRequest<Hash>(() =>
      this.client.request({
        method: "eth_sendUserOperation",
        params: [userOp, this.entryPointAddress],
      })
    );
    // throw new Error(`Failed to send user op with: ${error.message}`);
  }

  async getGasPrice(): Promise<GasPrices> {
    return this.pimlico.handleRequest<GasPrices>(() =>
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

  async getSponsorshipPolicies(): Promise<SponsorshipPolicyData[]> {
    // Chain ID doesn't matter for this bundler endpoint.
    const allPolicies = await this.pimlico.getSponsorshipPolicies();
    return allPolicies.filter((p) =>
      p.chain_ids.allowlist.includes(this.chainId)
    );
  }

  private async _getUserOpReceiptInner(
    userOpHash: Hash
  ): Promise<UserOperationReceipt | null> {
    return this.pimlico.handleRequest<UserOperationReceipt | null>(() =>
      this.client.request({
        method: "eth_getUserOperationReceipt",
        params: [userOpHash],
      })
    );
  }
}
