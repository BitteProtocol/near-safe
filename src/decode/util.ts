import { decodeMulti, MetaTransaction } from "ethers-multisend";
import { EIP712TypedData } from "near-ca";
import {
  decodeFunctionData,
  formatEther,
  Hex,
  parseTransaction,
  serializeTransaction,
  TransactionSerializable,
} from "viem";

import { SAFE_DEPLOYMENTS } from "../_gen/deployments";
import { isMultisendTx } from "../lib/multisend";
import { DecodedTxData, UserOperation } from "../types";

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

export function decodeRlpHex(chainId: number, tx: Hex): DecodedTxData {
  return decodeTransactionSerializable(chainId, parseTransaction(tx));
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
