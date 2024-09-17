import { ContractSuite as EthPack } from "./ethers-safe";
import { ContractSuite as ViemPack } from "../src/lib/safe";

describe("Safe Pack", () => {

  it("init", async () => {
    const ethersPack = await EthPack.init();
    const viemPack = await ViemPack.init();


    expect(ethersPack.singleton.target).toEqual(viemPack.singleton.address);
    expect(await ethersPack.singleton.getAddress()).toEqual(viemPack.singleton.address);


    expect(ethersPack.m4337.target).toEqual(viemPack.m4337.address);
    expect(await ethersPack.m4337.getAddress()).toEqual(viemPack.m4337.address);

    expect(ethersPack.moduleSetup.target).toEqual(viemPack.moduleSetup.address);
    expect(await ethersPack.moduleSetup.getAddress()).toEqual(viemPack.moduleSetup.address);

    expect(ethersPack.moduleSetup.target).toEqual(viemPack.moduleSetup.address);
    expect(await ethersPack.moduleSetup.getAddress()).toEqual(viemPack.moduleSetup.address);

    expect(ethersPack.entryPoint.target).toEqual(viemPack.entryPoint.address);
    expect(await ethersPack.entryPoint.getAddress()).toEqual(viemPack.entryPoint.address);

    expect(ethersPack.proxyFactory.target).toEqual(viemPack.proxyFactory.address);
    expect(await ethersPack.proxyFactory.getAddress()).toEqual(viemPack.proxyFactory.address);
  });
});
