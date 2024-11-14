import { isRlpHex, isTransactionSerializable } from "near-ca";

import {
  DecodedTxData,
  parseEip712TypedData,
  parseUserOperation,
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
  const parsedTypedData = parseEip712TypedData(data);
  if (parsedTypedData) {
    return decodeTypedData(chainId, parsedTypedData);
  }
  const userOp = parseUserOperation(data);
  if (userOp) {
    return decodeUserOperation(chainId, userOp);
  }
  // At this point we are certain that the data is a string.
  // Typescript would disagree here because of the EIP712TypedData possibility that remains.
  // However this is captured (indirectly) by parseEip712TypedData above.
  // We check now if its a string and return a reasonable default (for the case of a raw message).
  if (typeof data === "string") {
    return {
      chainId,
      costEstimate: "0",
      transactions: [],
      message: data,
    };
  }
  // Otherwise we have no idea what the data is and we throw.
  console.warn("Unrecognized txData format,", chainId, data);
  throw new Error(
    `decodeTxData: Invalid or unsupported message format ${data}`
  );
}
