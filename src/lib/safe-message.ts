/// This file is a viem implementation of the useDecodedSafeMessage hook from:
/// https://github.com/safe-global/safe-wallet-web
import { type SafeInfo } from "@safe-global/safe-gateway-typescript-sdk";
import { gte } from "semver";
import {
  Address,
  fromHex,
  Hash,
  hashMessage,
  hashTypedData,
  isHex,
  TypedDataDomain,
} from "viem";

interface TypedDataTypes {
  name: string;
  type: string;
}
type TypedMessageTypes = {
  [key: string]: TypedDataTypes[];
};

export type EIP712TypedData = {
  domain: TypedDataDomain;
  types: TypedMessageTypes;
  message: Record<string, unknown>;
  primaryType: string;
};

/*
 * From v1.3.0, EIP-1271 support was moved to the CompatibilityFallbackHandler.
 * Also 1.3.0 introduces the chainId in the domain part of the SafeMessage
 */
const EIP1271_FALLBACK_HANDLER_SUPPORTED_SAFE_VERSION = "1.3.0";

const generateSafeMessageMessage = (
  message: string | EIP712TypedData
): string => {
  return typeof message === "string"
    ? hashMessage(message)
    : hashTypedData(message);
};

/**
 * Generates `SafeMessage` typed data for EIP-712
 * https://github.com/safe-global/safe-contracts/blob/main/contracts/handler/CompatibilityFallbackHandler.sol#L12
 * @param safe Safe which will sign the message
 * @param message Message to sign
 * @returns `SafeMessage` types for signing
 */
const generateSafeMessageTypedData = (
  { version, chainId, address }: SafeInfo,
  message: string | EIP712TypedData
): EIP712TypedData => {
  if (!version) {
    throw Error("Cannot create SafeMessage without version information");
  }
  const isHandledByFallbackHandler = gte(
    version,
    EIP1271_FALLBACK_HANDLER_SUPPORTED_SAFE_VERSION
  );
  const verifyingContract = address.value as Address;
  return {
    domain: isHandledByFallbackHandler
      ? {
          chainId: Number(BigInt(chainId)),
          verifyingContract,
        }
      : { verifyingContract },
    types: {
      SafeMessage: [{ name: "message", type: "bytes" }],
    },
    message: {
      message: generateSafeMessageMessage(message),
    },
    primaryType: "SafeMessage",
  };
};

const generateSafeMessageHash = (
  safe: SafeInfo,
  message: string | EIP712TypedData
): Hash => {
  const typedData = generateSafeMessageTypedData(safe, message);
  return hashTypedData(typedData);
};

/**
 * If message is a hex value and is Utf8 encoded string we decode it, else we return the raw message
 * @param {string} message raw input message
 * @returns {string}
 */
const getDecodedMessage = (message: string): string => {
  if (isHex(message)) {
    try {
      return fromHex(message, "string");
    } catch (e) {
      // the hex string is not UTF8 encoding so return the raw message.
    }
  }

  return message;
};

/**
 * Returns the decoded message, the hash of the `message` and the hash of the `safeMessage`.
 * The `safeMessageMessage` is the value inside the SafeMessage and the `safeMessageHash` gets signed if the connected wallet does not support `eth_signTypedData`.
 *
 * @param message message as string, UTF-8 encoded hex string or EIP-712 Typed Data
 * @param safe SafeInfo of the opened Safe
 * @returns `{
 *   decodedMessage,
 *   safeMessageMessage,
 *   safeMessageHash
 * }`
 */
export function decodedSafeMessage(
  message: string | EIP712TypedData,
  safe: SafeInfo
): {
  decodedMessage: string | EIP712TypedData;
  safeMessageMessage: string;
  safeMessageHash: Hash;
} {
  const decodedMessage =
    typeof message === "string" ? getDecodedMessage(message) : message;

  return {
    decodedMessage,
    safeMessageMessage: generateSafeMessageMessage(decodedMessage),
    safeMessageHash: generateSafeMessageHash(safe, decodedMessage),
  };
}

// const isEIP712TypedData = (obj: any): obj is EIP712TypedData => {
//   return (
//     typeof obj === "object" &&
//     obj != null &&
//     "domain" in obj &&
//     "types" in obj &&
//     "message" in obj
//   );
// };

// export const isBlindSigningPayload = (obj: EIP712TypedData | string): boolean =>
//   !isEIP712TypedData(obj) && isHash(obj);
