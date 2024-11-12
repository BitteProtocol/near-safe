import { isAddress, isHex } from "viem";

import { UserOperation } from ".";

export const isUserOperation = (data: unknown): data is UserOperation => {
  if (typeof data !== "object" || data === null) return false;

  const candidate = data as Record<string, unknown>;

  // Required fields
  const hasRequiredFields =
    "sender" in candidate &&
    "nonce" in candidate &&
    "callData" in candidate &&
    "maxPriorityFeePerGas" in candidate &&
    "maxFeePerGas" in candidate &&
    "verificationGasLimit" in candidate &&
    "callGasLimit" in candidate &&
    "preVerificationGas" in candidate;

  if (!hasRequiredFields) return false;

  // Type checks for required fields
  const hasValidRequiredTypes =
    typeof candidate.sender === "string" &&
    isAddress(candidate.sender) &&
    typeof candidate.nonce === "string" &&
    isHex(candidate.callData) &&
    isHex(candidate.maxPriorityFeePerGas) &&
    isHex(candidate.maxFeePerGas) &&
    isHex(candidate.verificationGasLimit) &&
    isHex(candidate.callGasLimit) &&
    isHex(candidate.preVerificationGas);

  if (!hasValidRequiredTypes) return false;

  // Optional fields type checks
  if ("factory" in candidate && candidate.factory !== undefined) {
    if (typeof candidate.factory !== "string" || !isAddress(candidate.factory))
      return false;
  }

  if ("factoryData" in candidate && candidate.factoryData !== undefined) {
    if (!isHex(candidate.factoryData)) return false;
  }

  if ("signature" in candidate && candidate.signature !== undefined) {
    if (!isHex(candidate.signature)) return false;
  }

  if ("paymaster" in candidate && candidate.paymaster !== undefined) {
    if (
      typeof candidate.paymaster !== "string" ||
      !isAddress(candidate.paymaster)
    )
      return false;
  }

  if ("paymasterData" in candidate && candidate.paymasterData !== undefined) {
    if (!isHex(candidate.paymasterData)) return false;
  }

  if (
    "paymasterVerificationGasLimit" in candidate &&
    candidate.paymasterVerificationGasLimit !== undefined
  ) {
    if (!isHex(candidate.paymasterVerificationGasLimit)) return false;
  }

  if (
    "paymasterPostOpGasLimit" in candidate &&
    candidate.paymasterPostOpGasLimit !== undefined
  ) {
    if (!isHex(candidate.paymasterPostOpGasLimit)) return false;
  }

  return true;
};
