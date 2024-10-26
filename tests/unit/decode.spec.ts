import { SafeEncodedSignRequest } from "../../src";
import {
  // decodeTransactionSerializable,
  decodeTxData,
  // decodeTypedData,
  // decodeUserOperation,
} from "../../src/decode";

describe("decoding functions", () => {
  it("adapter: decodeTxData", async () => {
    // setup:
    const chainId = 11155111;
    const expectedMessage =
      "Welcome to OpenSea!\n" +
      "\n" +
      "Click to sign in and accept the OpenSea Terms of Service (https://opensea.io/tos) and Privacy Policy (https://opensea.io/privacy).\n" +
      "\n" +
      "This request will not trigger a blockchain transaction or cost any gas fees.\n" +
      "\n" +
      "Wallet address:\n" +
      "0xf057e37024abe7e6bc04fb4f00978613b5ca0241\n" +
      "\n" +
      "Nonce:\n" +
      "aca09a1c-a800-4d71-98ed-547f7c59370c";
    const evmData: SafeEncodedSignRequest = {
      chainId,
      hashToSign:
        "0xb3a14f9bd21518d7da23dba01ddf7c7ef45795ca1515f1b41b6f3455c862e22d",
      evmMessage: expectedMessage,
    };

    expect(decodeTxData(evmData)).toStrictEqual({
      chainId: 11155111,
      costEstimate: "0",
      transactions: [],
      message: expectedMessage,
    });
    // TODO(bh2smith): Test dis sheet.
    // Typed data request:
    // const typedSignRequest = adapter.encodeSignRequest({
    //   chainId: 11155111,
    //   method: "eth_signTypedData_v4",
    //   params: [
    //     "0x102543f7e6b5786a444cc89ff73012825d13000d",
    //     {
    //       types: {
    //         SafeTx: [
    //           { name: "to", type: "address" },
    //           { name: "value", type: "uint256" },
    //           { name: "data", type: "bytes" },
    //           { name: "operation", type: "uint8" },
    //           { name: "safeTxGas", type: "uint256" },
    //           { name: "baseGas", type: "uint256" },
    //           { name: "gasPrice", type: "uint256" },
    //           { name: "gasToken", type: "address" },
    //           { name: "refundReceiver", type: "address" },
    //           { name: "nonce", type: "uint256" },
    //         ],
    //         EIP712Domain: [
    //           { name: "chainId", type: "uint256" },
    //           { name: "verifyingContract", type: "address" },
    //         ],
    //       },
    //       domain: {
    //         chainId: "0xaa36a7",
    //         verifyingContract: "0x7fa8e8264985c7525fc50f98ac1a9b3765405489",
    //       },
    //       primaryType: "SafeTx",
    //       message: {
    //         to: "0x102543f7e6b5786a444cc89ff73012825d13000d",
    //         value: "100000000000000000",
    //         data: "0x",
    //         operation: "0",
    //         safeTxGas: "0",
    //         baseGas: "0",
    //         gasPrice: "0",
    //         gasToken: "0x0000000000000000000000000000000000000000",
    //         refundReceiver: "0x0000000000000000000000000000000000000000",
    //         nonce: "0",
    //       },
    //     },
    //   ],
    // });
    // expect(typedSignRequest).toStrictEqual({
    //   chainId,
    //   hash: "0xb3a14f9bd21518d7da23dba01ddf7c7ef45795ca1515f1b41b6f3455c862e22d",
    //   data: expectedMessage,
    // });
  });

  // it("decodeTransactionSerializable", () => {
  //   decodeTransactionSerializable(1, {});
  // });

  // it("decodeTypedData", () => {
  //   decodeTypedData(1, {});
  // });

  // it("decodeUserOperation", () => {
  //   decodeUserOperation(1);
  // });
});
