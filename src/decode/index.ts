import {
  EIP712TypedData,
  isEIP712TypedData,
  isRlpHex,
  isTransactionSerializable,
} from "near-ca";

import {
  DecodedTxData,
  isUserOperation,
  SafeEncodedSignRequest,
} from "../types";
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
  if (isEIP712TypedData(data)) {
    return decodeTypedData(chainId, data);
  }
  // At this point we know data must be a string
  if (typeof data !== "string") {
    throw new Error(`decodeTxData: Unexpected non-string data type ${data}`);
  }
  try {
    const parsedData = JSON.parse(data);
    if (isEIP712TypedData(parsedData)) {
      return decodeTypedData(chainId, parsedData);
    }
    if (isUserOperation(parsedData)) {
      return decodeUserOperation(chainId, parsedData);
    }
    throw new Error("decodeTxData: Invalid message format");
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
