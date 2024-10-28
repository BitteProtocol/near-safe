import { EIP712TypedData } from "near-ca";

import { isRlpHex, isTransactionSerializable } from "../lib/safe-message";
import { DecodedTxData, SafeEncodedSignRequest, UserOperation } from "../types";
import {
  decodeRlpHex,
  decodeTransactionSerializable,
  decodeTypedData,
  decodeUserOperation,
} from "./util";

/**
 * Decodes transaction data for a given EVM transaction and extracts relevant details.
 *
 * @param {EvmTransactionData} data - The raw transaction data to be decoded.
 * @returns {DecodedTxData} - An object containing the chain ID, estimated cost, and a list of decoded meta-transactions.
 */
export function decodeTxData({
  evmMessage,
  chainId,
}: Omit<SafeEncodedSignRequest, "hashToSign">): DecodedTxData {
  const data = evmMessage;
  if (isRlpHex(evmMessage)) {
    return decodeRlpHex(chainId, evmMessage);
  }
  if (isTransactionSerializable(data)) {
    return decodeTransactionSerializable(chainId, data);
  }
  if (typeof data !== "string") {
    return decodeTypedData(chainId, data);
  }
  try {
    // Stringified UserOperation.
    const userOp: UserOperation = JSON.parse(data);
    return decodeUserOperation(chainId, userOp);
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      // Raw message string.
      return {
        chainId,
        costEstimate: "0",
        transactions: [],
        message: data,
      };
    } else {
      // TODO: This shouldn't happen anymore and can probably be reverted.
      // We keep it here now, because near-ca might not have adapted its router.
      console.warn("Failed UserOp Parsing, try TypedData Parsing", error);
      try {
        const typedData: EIP712TypedData = JSON.parse(data);
        return decodeTypedData(chainId, typedData);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`decodeTxData: Unexpected error - ${message}`);
      }
    }
  }
}
