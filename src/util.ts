import { Network } from "near-ca";
import { Address, Hex, concatHex, encodePacked, toHex } from "viem";

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
  const client = Network.fromChainId(chainId).client;
  return (await client.getCode({ address })) !== undefined;
}
