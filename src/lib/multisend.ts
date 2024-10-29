import {
  Address,
  decodeFunctionData,
  encodeFunctionData,
  encodePacked,
  getAddress,
  Hex,
  parseAbi,
  size,
  toHex,
} from "viem";

import { MetaTransaction, OperationType } from "../types";

export const MULTI_SEND_ABI = ["function multiSend(bytes memory transactions)"];

const MULTISEND_141 = "0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526";
const MULTISEND_CALLONLY_141 = "0x9641d764fc13c8B624c04430C7356C1C7C8102e2";

/// Encodes the transaction as packed bytes of:
/// - `operation` as a `uint8` with `0` for a `call` or `1` for a `delegatecall` (=> 1 byte),
/// - `to` as an `address` (=> 20 bytes),
/// - `value` as a `uint256` (=> 32 bytes),
/// -  length of `data` as a `uint256` (=> 32 bytes),
/// - `data` as `bytes`.
const encodeMetaTx = (tx: MetaTransaction): Hex =>
  encodePacked(
    ["uint8", "address", "uint256", "uint256", "bytes"],
    [
      tx.operation || OperationType.Call,
      tx.to as Address,
      BigInt(tx.value),
      BigInt(size(tx.data as Hex)),
      tx.data as Hex,
    ]
  );

const remove0x = (hexString: Hex): string => hexString.slice(2);

// Encodes a batch of module transactions into a single multiSend module transaction.
// A module transaction is an object with fields corresponding to a Gnosis Safe's (i.e., Zodiac IAvatar's) `execTransactionFromModule` method parameters.
export function encodeMulti(
  transactions: readonly MetaTransaction[],
  multiSendContractAddress: string = transactions.some(
    (t) => t.operation === OperationType.DelegateCall
  )
    ? MULTISEND_141
    : MULTISEND_CALLONLY_141
): MetaTransaction {
  const encodedTransactions =
    "0x" + transactions.map(encodeMetaTx).map(remove0x).join("");

  return {
    operation: OperationType.DelegateCall,
    to: multiSendContractAddress,
    value: "0x00",
    data: encodeFunctionData({
      abi: parseAbi(MULTI_SEND_ABI),
      functionName: "multiSend",
      args: [encodedTransactions as Hex],
    }),
  };
}

export function isMultisendTx(args: readonly unknown[]): boolean {
  const to = (args[0] as string).toLowerCase();
  return (
    to === MULTISEND_141.toLowerCase() ||
    to === MULTISEND_CALLONLY_141.toLowerCase()
  );
}

function unpack(
  packed: string,
  startIndex: number
): {
  operation: number;
  to: string;
  value: string;
  data: string;
  endIndex: number;
} {
  // read operation from first 8 bits (= 2 hex digits)
  const operation = parseInt(packed.substring(startIndex, startIndex + 2), 16);
  // the next 40 characters are the to address
  const to = getAddress(
    `0x${packed.substring(startIndex + 2, startIndex + 42)}`
  );
  // then comes the uint256 value (= 64 hex digits)
  const value = toHex(
    BigInt(`0x${packed.substring(startIndex + 42, startIndex + 106)}`)
  );
  // and the uint256 data length (= 64 hex digits)
  const hexDataLength = parseInt(
    packed.substring(startIndex + 106, startIndex + 170),
    16
  );
  const endIndex = startIndex + 170 + hexDataLength * 2; // * 2 because each hex item is represented with 2 digits
  const data = `0x${packed.substring(startIndex + 170, endIndex)}`;
  return {
    operation,
    to,
    value,
    data,
    endIndex,
  };
}

export function decodeMulti(data: Hex): MetaTransaction[] {
  const tx = decodeFunctionData({
    abi: parseAbi(MULTI_SEND_ABI),
    data,
  });
  const [transactionsEncoded] = tx.args as [string];
  const result = [];
  let startIndex = 2; // skip over 0x
  while (startIndex < transactionsEncoded.length) {
    const { endIndex, ...tx } = unpack(transactionsEncoded, startIndex);
    result.push(tx);
    startIndex = endIndex;
  }
  return result;
}
