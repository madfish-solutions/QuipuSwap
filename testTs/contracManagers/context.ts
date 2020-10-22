import {
  Tezos,
  TezosToolkit,
  ContractAbstraction,
  ContractProvider,
} from "@taquito/taquito";
import { BatchOperation } from "@taquito/taquito/dist/types/operations/batch-operation";
import { TransactionOperation } from "@taquito/taquito/dist/types/operations/transaction-operation";
import { parseJsonSourceFileConfigFileContent } from "typescript";
import { Dex } from "./dex";
import { Factory } from "./factory";
import { TokenFA12 } from "./tokenFA12";
import { prepareProviderOptions, setup } from "./utils";
import tokenStorage from "../storage/Token";
import factoryStorage from "../storage/Factory";
import { dexFunctions, tokenFunctions } from "../storage/Functions";

const CDex = artifacts.require("Dex");
const Token = artifacts.require("Token");
const CFactory = artifacts.require("Factory");

export class Context {
  public factory: Factory;
  public pairs: Dex[];
  public tokens: TokenFA12[];

  constructor(factory: Factory, pairs: Dex[], tokens: TokenFA12[]) {
    this.factory = factory;
    this.pairs = pairs;
    this.tokens = tokens;
  }

  static async init(
    pairsConfigs: { tezAmount: number; tokenAmount: number }[] = [
      { tezAmount: 10000, tokenAmount: 1000000 },
    ],
    setFactoryFunctions: boolean = false,
    keyPath: string = process.env.npm_package_config_default_key,
    useDeployedFactory: boolean = true
  ): Promise<Context> {
    console.log("Setuping Tezos");
    let config = await prepareProviderOptions(keyPath);
    Tezos.setProvider(config);

    console.log("Deploying factory");
    let factoryInstance = useDeployedFactory
      ? await CFactory.deployed()
      : await CFactory.new(factoryStorage);
    let factory = await Factory.init(factoryInstance.address.toString());

    let context = new Context(factory, [], []);
    if (setFactoryFunctions) {
      console.log("Setting functions");
      await context.setAllFactoryFunctions();
    }

    console.log("Creating pairs");
    await context.createPairs(pairsConfigs);
    return context;
  }

  async updateActor(
    keyPath: string = process.env.npm_package_config_default_key
  ): Promise<void> {
    await this.factory.updateProvider(keyPath);

    // for (let pair of this.pairs) {
    //   await pair.updateProvider(keyPath);
    // }
    // for (let token of this.tokens) {
    //   await token.updateProvider(keyPath);
    // }
  }

  async flushPairs(): Promise<void> {
    this.tokens = [];
    this.pairs = [];
    await this.updateActor();
  }

  async createToken(): Promise<string> {
    let tokenInstance = await Token.new(tokenStorage);
    let tokenAddress = tokenInstance.address.toString();
    this.tokens.push(await TokenFA12.init(tokenAddress));
    return tokenAddress;
  }

  async setDexFactoryFunctions(): Promise<void> {
    let dexFunctions = [
      {
        index: 0,
        name: "initializeExchange",
      },
      {
        index: 1,
        name: "tezToToken",
      },
      {
        index: 2,
        name: "tokenToTez",
      },
      {
        index: 3,
        name: "withdrawProfit",
      },
      {
        index: 4,
        name: "investLiquidity",
      },
      {
        index: 5,
        name: "divestLiquidity",
      },
      {
        index: 6,
        name: "vote",
      },
      {
        index: 7,
        name: "veto",
      },
      {
        index: 8,
        name: "receiveReward",
      },
    ];
    for (let dexFunction of dexFunctions) {
      console.log(dexFunction);
      await this.factory.setDexFunction(dexFunction.index, dexFunction.name);
    }
    await this.factory.updateStorage({
      dexLambdas: [...Array(9).keys()],
    });
  }

  async setTokenFactoryFunctions(): Promise<void> {
    let tokenFunctions = [
      {
        index: 0,
        name: "transfer",
      },
      {
        index: 1,
        name: "approve",
      },
      {
        index: 2,
        name: "getBalance",
      },
      {
        index: 3,
        name: "getAllowance",
      },
      {
        index: 4,
        name: "getTotalSupply",
      },
    ];
    for (let tokenFunction of tokenFunctions) {
      console.log(tokenFunction);
      await this.factory.setTokenFunction(
        tokenFunction.index,
        tokenFunction.name
      );
    }
    await this.factory.updateStorage({
      tokenLambdas: [...Array(5).keys()],
    });
  }

  async setAllFactoryFunctions(): Promise<void> {
    await this.setDexFactoryFunctions();
    await this.setTokenFactoryFunctions();
    await this.factory.updateStorage({
      dexLambdas: [...Array(9).keys()],
      tokenLambdas: [...Array(5).keys()],
    });
  }

  async createPair(
    pairConfig: {
      tezAmount: number;
      tokenAmount: number;
      tokenAddress?: string | null;
    } = {
      tezAmount: 10000,
      tokenAmount: 1000000,
    }
  ): Promise<string> {
    pairConfig.tokenAddress =
      pairConfig.tokenAddress || (await this.createToken());
    await this.factory.launchExchange(
      pairConfig.tokenAddress,
      pairConfig.tokenAmount,
      pairConfig.tezAmount
    );
    this.pairs.push(
      await Dex.init(
        this.factory.storage.tokenToExchange[pairConfig.tokenAddress]
      )
    );
    return this.factory.storage.tokenToExchange[pairConfig.tokenAddress];
  }

  async createPairs(
    pairConfigs: {
      tezAmount: number;
      tokenAmount: number;
      tokenAddress?: string | null;
    }[] = [
      {
        tezAmount: 10000,
        tokenAmount: 1000000,
      },
    ]
  ): Promise<void> {
    for (let pairConfig of pairConfigs) {
      await this.createPair(pairConfig);
    }
  }
}