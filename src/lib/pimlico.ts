import { HttpRequestError, RpcError } from "viem";

import { SponsorshipPoliciesResponse, SponsorshipPolicyData } from "../types";

export class Pimlico {
  private apiKey: string;
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  bundlerUrl(chainId: number): string {
    return `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${this.apiKey}`;
  }

  // New method to query sponsorship policies
  async getSponsorshipPolicies(): Promise<SponsorshipPolicyData[]> {
    const url = `https://api.pimlico.io/v2/account/sponsorship_policies?apikey=${this.apiKey}`;
    const allPolicies = await this.handleRequest<SponsorshipPoliciesResponse>(
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
    return allPolicies.data;
  }

  async getSponsorshipPolicyByName(
    name: string
  ): Promise<SponsorshipPolicyData> {
    const allPolicies = await this.getSponsorshipPolicies();
    const result = allPolicies.filter((t) => t.policy_name === name);
    if (result.length === 0) {
      throw new Error(
        `No policy found with policy_name=${name}: try ${allPolicies.map((t) => t.policy_name)}`
      );
    } else if (result.length > 1) {
      throw new Error(
        `Multiple Policies with same policy_name=${name}: ${JSON.stringify(result)}`
      );
    }

    return result[0]!;
  }

  async getSponsorshipPolicyById(id: string): Promise<SponsorshipPolicyData> {
    const allPolicies = await this.getSponsorshipPolicies();
    const result = allPolicies.filter((t) => t.id === id);
    if (result.length === 0) {
      throw new Error(
        `No policy found with id=${id}: try ${allPolicies.map((t) => t.id)}`
      );
    }
    // We assume that ids are unique so that result.length > 1 need not be handled.

    return result[0]!;
  }

  async handleRequest<T>(clientMethod: () => Promise<T>): Promise<T> {
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
