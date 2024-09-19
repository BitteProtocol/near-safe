import { zeroAddress } from "viem";

import { decodeSafeMessage } from "../../src/lib/safe-message";

describe("Multisend", () => {
  const plainMessage = `Welcome to OpenSea!

Click to sign in and accept the OpenSea Terms of Service (https://opensea.io/tos) and Privacy Policy (https://opensea.io/privacy).

This request will not trigger a blockchain transaction or cost any gas fees.

Wallet address:
0xdcf56f5a8cc380f63b6396dbddd0ae9fa605beee

Nonce:
2a29a96e-c741-4500-9de3-03a865ff05db`;
  const safeInfo = {
    address: {
      value: "0xDcf56F5a8Cc380f63b6396Dbddd0aE9fa605BeeE",
    },
    chainId: "11155111",
    version: "1.4.1+L2",
  };
  it("decodeSafeMessage", () => {
    expect(decodeSafeMessage(plainMessage, safeInfo)).toStrictEqual({
      decodedMessage: plainMessage,
      safeMessageMessage:
        "0xc90ef7cffa3b5b1422e6c49ca7a5d7c1e9f514db067ec9bad52db13e83cbbb7c",
      safeMessageHash:
        "0x19dbea8af895c61831f2830ebba00d6160e4527398ec1d88553a8f0b8318959d",
    });
    // Lower Safe Version.
    expect(
      decodeSafeMessage(plainMessage, { ...safeInfo, version: "1.2.1" })
    ).toStrictEqual({
      decodedMessage: plainMessage,
      safeMessageMessage:
        "0xc90ef7cffa3b5b1422e6c49ca7a5d7c1e9f514db067ec9bad52db13e83cbbb7c",
      safeMessageHash:
        "0x58daaab88459f40802201741918791f85cb81a435328168ee6a1eaa735442809",
    });
  });

  it("decodeSafeMessage", () => {
    const versionlessSafeInfo = {
      address: { value: zeroAddress },
      chainId: "1",
      version: null,
    };
    expect(() => decodeSafeMessage(plainMessage, versionlessSafeInfo)).toThrow(
      "Cannot create SafeMessage without version information"
    );
  });
});
