import { toHex } from "viem";

const DOMAIN_SEPARATOR = "bitte/near-safe";
// 0x62697474652f6e6561722d7361666500
export const USER_OP_IDENTIFIER = toHex(DOMAIN_SEPARATOR, { size: 16 });
// 130811896738364114529934864114944206080
export const DEFAULT_SAFE_SALT_NONCE = BigInt(USER_OP_IDENTIFIER).toString();

export const SENTINEL_OWNERS = "0x0000000000000000000000000000000000000001";

export const DEFAULT_SETUP_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
