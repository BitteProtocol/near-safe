import { saltNonceFromMessage } from "./util";

// 44996514629493770112085868524049986283670269803674596648610276180743582360860
export const DEFAULT_SAFE_SALT_NONCE = saltNonceFromMessage(
  "bitteprotocol/near-safe"
);
