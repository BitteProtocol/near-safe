import { saltNonceFromMessage } from "./util";

export const DEFAULT_SAFE_SALT_NONCE = saltNonceFromMessage(
  "bitteprotocol/near-safe"
);
