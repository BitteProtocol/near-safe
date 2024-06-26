import { UserOperation } from "@safe-global/safe-core-sdk-types";
import { ethers } from "ethers";

function sliceInitCode(initCode: string) {
  // Remove the '0x' prefix
  if (initCode.startsWith("0x")) {
    initCode = initCode.slice(2);
  }

  // The factory address is the first 40 characters (20 bytes)
  const factory = "0x" + initCode.slice(0, 40);

  // The remaining bytes are the data
  const factoryData = "0x" + initCode.slice(40);

  return { factory, factoryData };
}

export async function sendUserOperation(
  bundlerUrl: string,
  userOp: UserOperation,
  entryPoint: string,
) {
  const { initCode, paymasterAndData, ...userOpWithoutInitCode } = userOp;
  const hexifiedUserOp = {
    ...userOpWithoutInitCode,
    verificationGasLimit: ethers.toBeHex(userOp.verificationGasLimit),
    callGasLimit: ethers.toBeHex(userOp.callGasLimit),
    preVerificationGas: ethers.toBeHex(userOp.preVerificationGas),
    maxPriorityFeePerGas: ethers.toBeHex(userOp.maxPriorityFeePerGas),
    maxFeePerGas: ethers.toBeHex(userOp.maxFeePerGas),
    ...(initCode !== "0x" ? sliceInitCode(initCode) : {}),
  };
  console.log(hexifiedUserOp);
  const response = await fetch(bundlerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_sendUserOperation",
      id: 4337,
      params: [hexifiedUserOp, entryPoint],
    }),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Failed to send user op ${body}`);
  }
  const json = JSON.parse(body);
  if (json.error) {
    throw new Error(JSON.stringify(json.error));
  }
  // This does not contain a transaction receipt! It is the `userOpHash`
  return json.result;
}

// async function getUserOpReceipt(userOpHash: string) {
//   const response = await fetch(ERC4337_BUNDLER_URL!, {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//     },
//     body: JSON.stringify({
//       jsonrpc: "2.0",
//       method: "eth_getUserOperationReceipt",
//       id: 4337,
//       params: [userOpHash],
//     }),
//   });
//   const body = await response.text();
//   if (!response.ok) {
//     throw new Error(`Failed to send user op ${body}`);
//   }
//   const json = JSON.parse(body);
//   if (json.error) {
//     throw new Error(JSON.stringify(json.error));
//   }
//   return json.result;
// }
