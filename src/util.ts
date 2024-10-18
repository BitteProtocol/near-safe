import {
  EthTransactionParams,
  getNetworkId,
  Network as EvmNetwork,
  SessionRequestParams,
  signatureFromTxHash as sigFromHash,
} from "near-ca";
import {
  Address,
  Hex,
  concatHex,
  encodePacked,
  toHex,
  PublicClient,
  isHex,
  parseTransaction,
  zeroAddress,
  toBytes,
  keccak256,
  serializeSignature,
} from "viem";

import { PaymasterData, MetaTransaction } from "./types";

//
export const PLACEHOLDER_SIG = encodePacked(["uint48", "uint48"], [0, 0]);

type IntLike = Hex | bigint | string | number;

export const packGas = (hi: IntLike, lo: IntLike): string =>
  encodePacked(["uint128", "uint128"], [BigInt(hi), BigInt(lo)]);

export function packSignature(
  signature: `0x${string}`,
  validFrom: number = 0,
  validTo: number = 0
): Hex {
  return encodePacked(
    ["uint48", "uint48", "bytes"],
    [validFrom, validTo, signature]
  );
}

export function packPaymasterData(data: PaymasterData): Hex {
  return (
    data.paymaster
      ? concatHex([
          data.paymaster!,
          toHex(BigInt(data.paymasterVerificationGasLimit || 0n), { size: 16 }),
          toHex(BigInt(data.paymasterPostOpGasLimit || 0n), { size: 16 }),
          data.paymasterData || "0x",
        ])
      : "0x"
  ) as Hex;
}

export function containsValue(transactions: MetaTransaction[]): boolean {
  return transactions.some((tx) => tx.value !== "0");
}

export async function isContract(
  address: Address,
  chainId: number
): Promise<boolean> {
  return (await getClient(chainId).getCode({ address })) !== undefined;
}

export function getClient(chainId: number): PublicClient {
  return EvmNetwork.fromChainId(chainId).client;
}

export function metaTransactionsFromRequest(
  params: SessionRequestParams
): MetaTransaction[] {
  let transactions: EthTransactionParams[];
  if (isHex(params)) {
    // If RLP hex is given, decode the transaction and build EthTransactionParams
    const tx = parseTransaction(params);
    transactions = [
      {
        from: zeroAddress, // TODO: This is a hack - but its unused.
        to: tx.to!,
        value: tx.value ? toHex(tx.value) : "0x00",
        data: tx.data || "0x",
      },
    ];
  } else {
    transactions = params as EthTransactionParams[];
  }
  return transactions.map((tx) => ({
    to: tx.to,
    value: tx.value || "0x00",
    data: tx.data || "0x",
  }));
}

export function saltNonceFromMessage(input: string): string {
  // Convert the string to bytes (UTF-8 encoding)
  // Compute the keccak256 hash of the input bytes
  // Convert the resulting hash (which is in hex) to a BigInt
  // Return string for readability and transport.
  return BigInt(keccak256(toBytes(input))).toString();
}

export async function signatureFromTxHash(
  nearTxHash: string,
  accountId?: string
): Promise<Hex> {
  if (accountId) {
    const signature = await sigFromHash(
      `https://archival-rpc.${getNetworkId(accountId)}.near.org`,
      nearTxHash,
      accountId
    );
    return packSignature(serializeSignature(signature));
  }

  try {
    const signature = await raceToFirstResolve(
      ["testnet", "mainnet"].map((networkId) =>
        sigFromHash(archiveNode(networkId), nearTxHash)
      )
    );
    return packSignature(serializeSignature(signature));
  } catch {
    throw new Error(`No signature found for txHash ${nearTxHash}`);
  }
}

const archiveNode = (networkId: string): string =>
  `https://archival-rpc.${networkId}.near.org`;

export async function raceToFirstResolve<T>(
  promises: Promise<T>[]
): Promise<T> {
  return new Promise((resolve, reject) => {
    let rejectionCount = 0;
    const totalPromises = promises.length;

    promises.forEach((promise) => {
      // Wrap each promise so it only resolves when fulfilled
      Promise.resolve(promise)
        .then(resolve) // Resolve when any promise resolves
        .catch(() => {
          rejectionCount++;
          // If all promises reject, reject the race with an error
          if (rejectionCount === totalPromises) {
            reject(new Error("All promises rejected"));
          }
        });
    });
  });
}
