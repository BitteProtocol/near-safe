import { ethers } from "ethers";

export const packGas = (hi: ethers.BigNumberish, lo: ethers.BigNumberish) =>
  ethers.solidityPacked(["uint128", "uint128"], [hi, lo]);
