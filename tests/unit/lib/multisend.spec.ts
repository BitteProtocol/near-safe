import { decodeMulti } from "ethers-multisend";
import { encodeFunctionData, erc20Abi, Hex, parseUnits, toHex } from "viem";

import { OperationType } from "../../../src";
import { decodeMultiViem, encodeMulti } from "../../../src/lib/multisend";

describe("Multisend", () => {
  it("encodeMulti", () => {
    const tx1 = {
      to: "0x0000000000000000000000000000000000000001",
      value: "1",
      data: "0x12",
    };
    const tx2 = {
      to: "0x0000000000000000000000000000000000000002",
      value: "2",
      data: "0x34",
    };
    expect(encodeMulti([tx1, tx2])).toEqual({
      data: "0x8d80ff0a000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000ac000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000011200000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000001340000000000000000000000000000000000000000",
      operation: 1,
      to: "0x9641d764fc13c8B624c04430C7356C1C7C8102e2",
      value: "0x00",
    });
  });

  it("decodeMulti", () => {
    const tx1 = {
      to: "0x0000000000000000000000000000000000000001",
      value: "0x1234",
      data: "0x12",
      operation: OperationType.Call,
    };
    const tx2 = {
      to: "0x0000000000000000000000000000000000000002",
      value: "0x456",
      data: "0x34",
      operation: OperationType.Call,
    };
    const tx3 = {
      to: "0x0000000000000000000000000000000000000003",
      value: "0x2345678910",
      data: "0x34",
      operation: OperationType.Call,
    };
    const input = encodeMulti([tx1, tx2, tx3]);

    expect(decodeMultiViem(input.data as Hex)).toStrictEqual([tx1, tx2, tx3]);
    // TODO: differening by even length hex string: "0x01" vs "0x1"
    // expect(decodeMultiViem(input.data as Hex)).toStrictEqual(
    //   decodeMulti(input.data)
    // );
  });
  it("should decode transactions with and without data", async () => {
    const ercTransferData = encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [
        "0xfF6D102f7A5b52B6A2b654a048b0bA650bE90c59",
        parseUnits("10", 18),
      ],
    });
    const input = [
      {
        operation: OperationType.Call,
        to: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
        value: toHex(BigInt(parseUnits("10", 18))),
        data: "0x00",
      },
      {
        operation: OperationType.Call,
        to: "0x36F4BFC9f49Dc5D4b2d10c4a48a6b30128BD79bC",
        value: "0x00",
        data: ercTransferData,
      },
    ];
    const multiSendTx = encodeMulti(input);
    const result = decodeMulti(multiSendTx.data);
    expect(result).toStrictEqual(input);
  });
});
