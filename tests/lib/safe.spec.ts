import { zeroAddress } from "viem";

import { SafeContractSuite as ViemPack } from "../../src/lib/safe";
import { ContractSuite as EthPack } from "../ethers-safe";

describe("Safe Pack", () => {
  let ethersPack: EthPack;
  let viemPack: ViemPack;
  beforeAll(async () => {
    ethersPack = await EthPack.init();
    viemPack = await ViemPack.init();
  });

  it("init", async () => {
    expect(ethersPack.singleton.target).toEqual(viemPack.singleton.address);
    expect(await ethersPack.singleton.getAddress()).toEqual(
      viemPack.singleton.address
    );

    expect(ethersPack.m4337.target).toEqual(viemPack.m4337.address);
    expect(await ethersPack.m4337.getAddress()).toEqual(viemPack.m4337.address);

    expect(ethersPack.moduleSetup.target).toEqual(viemPack.moduleSetup.address);
    expect(await ethersPack.moduleSetup.getAddress()).toEqual(
      viemPack.moduleSetup.address
    );

    expect(ethersPack.moduleSetup.target).toEqual(viemPack.moduleSetup.address);
    expect(await ethersPack.moduleSetup.getAddress()).toEqual(
      viemPack.moduleSetup.address
    );

    expect(ethersPack.entryPoint.target).toEqual(viemPack.entryPoint.address);
    expect(await ethersPack.entryPoint.getAddress()).toEqual(
      viemPack.entryPoint.address
    );

    expect(ethersPack.proxyFactory.target).toEqual(
      viemPack.proxyFactory.address
    );
    expect(await ethersPack.proxyFactory.getAddress()).toEqual(
      viemPack.proxyFactory.address
    );
  });

  it("addOwnerData", () => {
    expect(ethersPack.addOwnerData(zeroAddress)).toEqual(
      viemPack.addOwnerData(zeroAddress)
    );
  });
  it("getSetup", () => {
    expect(ethersPack.getSetup([zeroAddress])).toEqual(
      viemPack.getSetup([zeroAddress])
    );
  });

  it("getSetup", async () => {
    const setup = viemPack.getSetup([zeroAddress]);
    const [eps0, vps0, eps1, vps1] = await Promise.all([
      ethersPack.addressForSetup(setup),
      viemPack.addressForSetup(setup),
      ethersPack.addressForSetup(setup, "1"),
      viemPack.addressForSetup(setup, "1"),
    ]);
    expect(eps0).toEqual(vps0);
    expect(eps1).toEqual(vps1);
  });
});
