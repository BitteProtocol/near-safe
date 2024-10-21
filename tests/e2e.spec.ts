import dotenv from "dotenv";

import { DEFAULT_SAFE_SALT_NONCE, NearSafe } from "../src";

dotenv.config();

describe("Near Safe Requests", () => {
  let adapter: NearSafe;
  beforeAll(async () => {
    // Initialize the NearSafe adapter once before all tests
    adapter = await NearSafe.create({
      accountId: "neareth-dev.testnet",
      mpcContractId: "v1.signer-prod.testnet",
      pimlicoKey: process.env.PIMLICO_KEY!,
      safeSaltNonce: DEFAULT_SAFE_SALT_NONCE,
    });
  });

  it("buildTransaction", async () => {
    const irrelevantData = {
      data: "0xbeef",
      value: "0",
    };
    await expect(
      adapter.buildTransaction({
        chainId: 11155111,
        transactions: [
          {
            to: adapter.mpcAddress,
            ...irrelevantData,
          },
        ],
      })
    ).resolves.not.toThrow();
    // Can't send sponsored raw messages to Safe Contracts.
    // Because transaction simulation reverts.
    await expect(
      adapter.buildTransaction({
        chainId: 11155111,
        transactions: [
          {
            to: adapter.address,
            ...irrelevantData,
          },
        ],
        sponsorshipPolicy: "sp_clear_vampiro",
      })
    ).rejects.toThrow();
  });

  it("bundler: getSponsorshipPolicy", async () => {
    await expect(adapter.policyForChainId(100)).resolves.not.toThrow();
  });
});
