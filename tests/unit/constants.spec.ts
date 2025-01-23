import { duneUpload } from "../../scripts/data-link";
import { DEFAULT_SAFE_SALT_NONCE, USER_OP_IDENTIFIER } from "../../src";

// DO NOT MODIFY
describe("Protocol Domain Separator", () => {
  it("USER_OP_IDENTIFIER", async () => {
    expect(USER_OP_IDENTIFIER).toBe("0x62697474652f6e6561722d7361666500");
  });
  it("DEFAULT_SAFE_SALT_NONCE", async () => {
    expect(DEFAULT_SAFE_SALT_NONCE).toBe(
      "130811896738364114529934864114944206080"
    );
  });

  // Requires DUNE_API_KEY
  it.skip("datalink", async () => {
    await duneUpload();
  });
});
