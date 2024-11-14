import { Network } from "near-ca";

import { decodeTxData } from ".";
import { DecodedTxData, SafeEncodedSignRequest } from "../types";

/**
 * Explain a Safe Signature Request.
 * @param signRequest - The Safe Signature Request to explain.
 * @returns The decoded transaction data as stringified JSON or null if there was an error.
 */
export async function explainSignRequest(
  signRequest: SafeEncodedSignRequest
): Promise<string> {
  // Decode the Signature Request
  const decodedEvmData = decodeTxData(signRequest);

  // Decode the function signatures
  const functionSignatures = await Promise.all(
    decodedEvmData.transactions.map((tx) =>
      safeDecodeTx(tx.data, tx.to, decodedEvmData.chainId)
    )
  );

  // Format the decoded data
  return formatEvmData(decodedEvmData, functionSignatures);
}

const SAFE_NETWORKS: { [chainId: number]: string } = {
  1: "mainnet", // Ethereum Mainnet
  10: "optimism", // Optimism Mainnet
  56: "binance", // Binance Smart Chain Mainnet
  97: "bsc-testnet", // Binance Smart Chain Testnet
  100: "gnosis-chain", // Gnosis Chain (formerly xDAI)
  137: "polygon", // Polygon Mainnet
  250: "fantom", // Fantom Mainnet
  288: "boba", // Boba Network Mainnet
  1284: "moonbeam", // Moonbeam (Polkadot)
  1285: "moonriver", // Moonriver (Kusama)
  4002: "fantom-testnet", // Fantom Testnet
  42161: "arbitrum", // Arbitrum One Mainnet
  43113: "avalanche-fuji", // Avalanche Fuji Testnet
  43114: "avalanche", // Avalanche Mainnet
  80001: "polygon-mumbai", // Polygon Mumbai Testnet
  8453: "base", // Base Mainnet
  11155111: "sepolia", // Sepolia Testnet
  1666600000: "harmony", // Harmony Mainnet
  1666700000: "harmony-testnet", // Harmony Testnet
  1313161554: "aurora", // Aurora Mainnet (NEAR)
  1313161555: "aurora-testnet", // Aurora Testnet (NEAR)
};

/**
 * Represents a parameter in a decoded contract call.
 */
interface DecodedParameter {
  /** The parameter name from the contract ABI */
  name: string;
  /** The parameter type (e.g., 'address', 'uint256') */
  type: string;
  /** The actual value of the parameter */
  value: string;
}

/**
 * Represents a successful response from the Safe transaction decoder.
 */
interface FunctionSignature {
  /** The name of the contract method that was called */
  method: string;
  /** Array of decoded parameters from the function call */
  parameters: DecodedParameter[];
}

/**
 * Represents an error response from the Safe transaction decoder.
 */
interface SafeDecoderErrorResponse {
  /** Error code from the Safe API */
  code: number;
  /** Human-readable error message */
  message: string;
  /** Additional error context arguments */
  arguments: string[];
}

/**
 * Decode a transaction using the Safe Decoder API. According to this spec:
 * https://safe-transaction-sepolia.safe.global/#/data-decoder/data_decoder_create
 * @param data - The transaction data to decode.
 * @param to - The address of the contract that was called.
 * @param chainId - The chain ID of the transaction.
 * @returns The decoded transaction data or null if there was an error.
 */
export async function safeDecodeTx(
  data: string,
  to: string,
  chainId: number
): Promise<FunctionSignature | null> {
  try {
    const network = SAFE_NETWORKS[chainId] || SAFE_NETWORKS[1];
    const response = await fetch(
      `https://safe-transaction-${network}.safe.global/api/v1/data-decoder/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({ data, to }),
      }
    );

    // Handle different response status codes
    if (response.status === 404) {
      console.warn("Cannot find function selector to decode data");
      return null;
    }

    if (response.status === 422) {
      const errorData = (await response.json()) as SafeDecoderErrorResponse;
      console.error("Invalid data:", errorData.message, errorData.arguments);
      return null;
    }

    if (!response.ok) {
      console.error(`Unexpected response status: ${response.status}`);
      return null;
    }

    return (await response.json()) as FunctionSignature;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error decoding transaction:", message);
    return null;
  }
}

export const formatEvmData = (
  decodedEvmData: DecodedTxData,
  functionSignatures: (FunctionSignature | null)[] = []
): string => {
  const formatted = {
    ...decodedEvmData,
    network: Network.fromChainId(decodedEvmData.chainId).name,
    functionSignatures,
  };

  return JSON.stringify(formatted, bigIntReplacer, 2);
};

/**
 * Replaces bigint values with their string representation.
 */
const bigIntReplacer = (_: string, value: unknown): unknown =>
  typeof value === "bigint" ? value.toString() : value;
