import {
  EthTransactionParams,
  getNetworkId,
  Network,
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
  return Network.fromChainId(chainId).client;
}

export function metaTransactionsFromRequest(
  params: SessionRequestParams
): MetaTransaction[] {
  let transactions: EthTransactionParams[];
  if (isHex(params)) {
    // TODO: Consider deprecating this route.
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
    // TODO: add type guard here.
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

/**
 * Fetches the signature for a NEAR transaction hash. If an `accountId` is provided,
 * it fetches the signature from the appropriate network. Otherwise, it races across
 * both `testnet` and `mainnet`.
 *
 * @param {string} txHash - The NEAR transaction hash for which to fetch the signature.
 * @param {string} [accountId] - (Optional) The account ID associated with the transaction.
 * Providing this will reduce dangling promises as the network is determined by the account.
 *
 * @returns {Promise<Hex>} A promise that resolves to the hex-encoded signature.
 *
 * @throws Will throw an error if no signature is found for the given transaction hash.
 */
export async function signatureFromTxHash(
  txHash: string,
  accountId?: string
): Promise<Hex> {
  if (accountId) {
    const signature = await sigFromHash(
      `https://archival-rpc.${getNetworkId(accountId)}.near.org`,
      txHash,
      accountId
    );
    return packSignature(serializeSignature(signature));
  }

  try {
    const signature = await raceToFirstResolve(
      ["testnet", "mainnet"].map((network) =>
        sigFromHash(archiveNode(network), txHash)
      )
    );
    return packSignature(serializeSignature(signature));
  } catch {
    throw new Error(`No signature found for txHash ${txHash}`);
  }
}

/**
 * Utility function to construct an archive node URL for a given NEAR network.
 *
 * @param {string} networkId - The ID of the NEAR network (e.g., 'testnet', 'mainnet').
 *
 * @returns {string} The full URL of the archival RPC node for the specified network.
 */
const archiveNode = (networkId: string): string =>
  `https://archival-rpc.${networkId}.near.org`;

/**
 * Races an array of promises and resolves with the first promise that fulfills.
 * If all promises reject, the function will reject with an error.
 *
 * @template T
 * @param {Promise<T>[]} promises - An array of promises to race. Each promise should resolve to type `T`.
 *
 * @returns {Promise<T>} A promise that resolves to the value of the first successfully resolved promise.
 *
 * @throws Will throw an error if all promises reject with the message "All promises rejected".
 */
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

export function assertUnique<T>(
  iterable: Iterable<T>,
  errorMessage: string = "The collection contains more than one distinct element."
): void {
  const uniqueValues = new Set(iterable);

  if (uniqueValues.size > 1) {
    throw new Error(errorMessage);
  }
}
