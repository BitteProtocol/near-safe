import { ethers } from "ethers";
import { zeroAddress } from "viem";

import { PaymasterData } from "../../src";
import {
  PLACEHOLDER_SIG,
  containsValue,
  isContract,
  packGas,
  packPaymasterData,
  packSignature,
  saltNonceFromMessage,
  raceToFirstResolve,
  signatureFromTxHash,
} from "../../src/util";

describe("Utility Functions (mostly byte packing)", () => {
  it("PLACE_HOLDER_SIG", () => {
    expect(PLACEHOLDER_SIG).toEqual(
      ethers.solidityPacked(["uint48", "uint48"], [0, 0])
    );
  });
  it("packGas", () => {
    let [hi, lo] = [15n, 255n];
    expect(packGas(hi, lo)).toEqual(
      ethers.solidityPacked(["uint128", "uint128"], [hi, lo])
    );
    // Random input
    expect(packGas(15, "255")).toEqual(
      ethers.solidityPacked(["uint128", "uint128"], ["15", "0xff"])
    );
  });
  it("packSignature", () => {
    const x =
      "0x491e245db3914b85807f3807f2125b9ed9722d0e9f3fa0fe325b31893fa5e693387178ae4a51f304556c1b2e9dd24f1120d073f93017af006ad801a639214ea61b";
    expect(packSignature(x, 1, 2)).toEqual(
      ethers.solidityPacked(["uint48", "uint48", "bytes"], [1, 2, x])
    );
  });

  it("packPaymasterData", () => {
    const data: PaymasterData = {
      paymaster: "0x4685d9587a7F72Da32dc323bfFF17627aa632C61",
      paymasterData:
        "0x000000000000000000000000000000000000000000000000000000006682e19400000000000000000000000000000000000000000000000000000000000000007eacbfaa696a236960b8eac0a9725f96c941665b893aa80b2ae3a41814f10b813d07db0b07b89080e4fd436d1966bc2ff7002a686087a310348391db8e9d44881c",
      preVerificationGas: "0xd87a",
      verificationGasLimit: "0x114b5",
      callGasLimit: "0x14a6a",
      paymasterVerificationGasLimit: "0x4e17",
      paymasterPostOpGasLimit: "0x1",
    };

    expect(packPaymasterData(data).toLowerCase()).toEqual(
      ethers.hexlify(
        ethers.concat([
          data.paymaster!,
          ethers.toBeHex(data.paymasterVerificationGasLimit || "0x", 16),
          ethers.toBeHex(data.paymasterPostOpGasLimit || "0x", 16),
          data.paymasterData || "0x",
        ])
      )
    );
  });

  it("containsValue", () => {
    expect(containsValue([])).toBe(false);
    const NO_VALUE_TX = { to: "0x", value: "0", data: "0x" };
    const VALUE_TX = { to: "0x", value: "1", data: "0x" };
    expect(containsValue([NO_VALUE_TX])).toBe(false);
    expect(containsValue([VALUE_TX])).toBe(true);
    expect(containsValue([VALUE_TX, NO_VALUE_TX])).toBe(true);
  });

  it("isContract", async () => {
    const chainId = 11155111;
    expect(await isContract(zeroAddress, chainId)).toBe(false);
    expect(
      await isContract("0x9008D19f58AAbD9eD0D60971565AA8510560ab41", chainId)
    ).toBe(true);
  });
  it("saltNonceFromMessage", async () => {
    expect(saltNonceFromMessage("bitte/near-safe")).toBe(
      "26371153660914144112327059280066269158753782528888197421682303285265580464377"
    );
  });

  it("raceToFirstResolve (success)", async () => {
    // Example usage:
    const promise1 = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Reject 1")), 100)
    );
    const promise2 = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Reject 2")), 200)
    );
    const promise3 = new Promise((resolve) =>
      setTimeout(resolve, 1, "Resolve")
    );

    await expect(
      raceToFirstResolve([promise1, promise2, promise3])
    ).resolves.toBe("Resolve");
  }, 10);
  it("raceToFirstResolve (failure)", async () => {
    const promise1 = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Reject 1")), 10)
    );
    const promise2 = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Reject 2")), 20)
    );
    await expect(raceToFirstResolve([promise1, promise2])).rejects.toThrow(
      "All promises rejected"
    );
  });

  it("signatureFromTxHash (mainnet)", async () => {
    expect(
      await signatureFromTxHash(
        "BoKuHRFZ9qZ8gZRCcNS92mQYhEVbHrsUwed6D6CHELhv",
        "ping-account.near"
      )
    ).toBe(
      "0x000000000000000000000000039ae6baaf4e707ca6d7cfe1fec3f1aa1b4978eb34224b347904b9e957a8dbd720da770464a68e3d1bcef1a4a46c3f9d0a358ccaa01669636f765364a17c03f61b"
    );
  });

  it("signatureFromTxHash (testnet)", async () => {
    expect(
      await signatureFromTxHash(
        "BbmJk8W6FNz7cRcFxfVMpBWn9Q9uh99KLkzVyJwmPve8",
        "neareth-dev.testnet"
      )
    ).toBe(
      "0x000000000000000000000000c69b46c006739fa11f3937556fbf7fc846359547c4927cfbc17eea108e13f5340c200541e90ab5d048087ea0e04f11f715115b362df692bf438b59623c574bc11b"
    );
  });

  it("signatureFromTxHash (rejects - doesn't exist)", async () => {
    await expect(signatureFromTxHash("fart")).rejects.toThrow(
      "No signature found for txHash fart"
    );
  });
});
