import { decodeMulti, MetaTransaction } from "ethers-multisend";
import { EIP712TypedData } from "near-ca";
import {
  decodeFunctionData,
  formatEther,
  serializeTransaction,
  TransactionSerializable,
} from "viem";

import { SAFE_DEPLOYMENTS } from "./_gen/deployments";
import { isMultisendTx } from "./lib/multisend";
import { isTransactionSerializable } from "./lib/safe-message";
import { DecodedTxData, SafeEncodedSignRequest, UserOperation } from "./types";

/**
 * Decodes transaction data for a given EVM transaction and extracts relevant details.
 *
 * @param {EvmTransactionData} data - The raw transaction data to be decoded.
 * @returns {DecodedTxData} - An object containing the chain ID, estimated cost, and a list of decoded meta-transactions.
 */
export function decodeTxData({
  evmMessage,
  chainId,
}: SafeEncodedSignRequest): DecodedTxData {
  const data = evmMessage;
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
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`decodeTxData: Unexpected error - ${message}`);
    }
  }
}

export function decodeTransactionSerializable(
  chainId: number,
  tx: TransactionSerializable
): DecodedTxData {
  const { gas, maxFeePerGas, maxPriorityFeePerGas, to } = tx;
  if (chainId !== tx.chainId) {
    throw Error(`Transaction chainId mismatch ${chainId} != ${tx.chainId}`);
  }
  if (!gas || !maxFeePerGas || !maxPriorityFeePerGas) {
    throw Error(
      `Insufficient feeData for ${serializeTransaction(tx)}. Check https://rawtxdecode.in/`
    );
  }
  if (!to) {
    throw Error(
      `Transaction is missing the 'to' in ${serializeTransaction(tx)}. Check https://rawtxdecode.in/`
    );
  }
  return {
    chainId,
    // This is an upper bound on the gas fees (could be lower)
    costEstimate: formatEther(gas * (maxFeePerGas + maxPriorityFeePerGas)),
    transactions: [
      {
        to,
        value: (tx.value || 0n).toString(),
        data: tx.data || "0x",
      },
    ],
  };
}

export function decodeTypedData(
  chainId: number,
  data: EIP712TypedData
): DecodedTxData {
  return {
    chainId,
    costEstimate: "0",
    transactions: [],
    message: data,
  };
}

export function decodeUserOperation(
  chainId: number,
  userOp: UserOperation
): DecodedTxData {
  const { callGasLimit, maxFeePerGas, maxPriorityFeePerGas } = userOp;
  const maxGasPrice = BigInt(maxFeePerGas) + BigInt(maxPriorityFeePerGas);
  const { args } = decodeFunctionData({
    abi: SAFE_DEPLOYMENTS.m4337.abi,
    data: userOp.callData,
  });

  // Determine if singular or double!
  const transactions = isMultisendTx(args)
    ? decodeMulti(args[2] as string)
    : [
        {
          to: args[0],
          value: args[1],
          data: args[2],
          operation: args[3],
        } as MetaTransaction,
      ];
  return {
    chainId,
    // This is an upper bound on the gas fees (could be lower)
    costEstimate: formatEther(BigInt(callGasLimit) * maxGasPrice),
    transactions,
  };
}
