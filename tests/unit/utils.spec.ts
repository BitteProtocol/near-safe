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
});
