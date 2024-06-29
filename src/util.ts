import { ethers } from "ethers";
import { PaymasterData } from "./types";

export const PLACEHOLDER_SIG = ethers.solidityPacked(
  ["uint48", "uint48"],
  [0, 0],
);

export const packGas = (hi: ethers.BigNumberish, lo: ethers.BigNumberish) =>
  ethers.solidityPacked(["uint128", "uint128"], [hi, lo]);

export function packSignature(
  signature: string,
  validFrom: number = 0,
  validTo: number = 0,
): string {
  return ethers.solidityPacked(
    ["uint48", "uint48", "bytes"],
    [validFrom, validTo, signature],
  );
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
