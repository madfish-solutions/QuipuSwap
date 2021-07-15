import { ContractAbstraction, ContractProvider } from "@taquito/taquito";
import { BatchOperation } from "@taquito/taquito/dist/types/operations/batch-operation";
import { TransactionOperation } from "@taquito/taquito/dist/types/operations/transaction-operation";
import { BigNumber } from "bignumber.js";
import { TokenFA2 } from "./tokenFA2";
import { TTDexStorage, SwapSliceType } from "./types";
import { getLigo } from "./utils";
import { execSync } from "child_process";
import { confirmOperation } from "./confirmation";

const standard = process.env.EXCHANGE_TOKEN_STANDARD;

export class TTDex extends TokenFA2 {
  public contract: ContractAbstraction<ContractProvider>;
  public storage: TTDexStorage;

  constructor(contract: ContractAbstraction<ContractProvider>) {
    super(contract);
  }

  static async init(dexAddress: string): Promise<TTDex> {
    return new TTDex(await tezos.contract.at(dexAddress));
  }

  async updateStorage(
    maps: {
      tokens?: string[];
      token_to_id?: string[];
      pairs?: string[];
      ledger?: any[];
      dex_lambdas?: number[];
      token_lambdas?: number[];
    } = {}
  ): Promise<void> {
    const storage: any = await this.contract.storage();
    this.storage = {
      pairs_count: storage.storage.pairs_count,
      tokens: {},
      token_to_id: {},
      pairs: {},
      ledger: {},
      dex_lambdas: {},
      token_lambdas: {},
    };
    for (let key in maps) {
      if (["dex_lambdas", "token_lambdas"].includes(key)) continue;
      this.storage[key] = await maps[key].reduce(async (prev, current) => {
        try {
          return {
            ...(await prev),
            [key == "ledger" ? current[0] : current]: await storage.storage[
              key
            ].get(current),
          };
        } catch (ex) {
          console.log(ex);
          return {
            ...(await prev),
          };
        }
      }, Promise.resolve({}));
    }
    for (let key in maps) {
      if (!["dex_lambdas", "token_lambdas"].includes(key)) continue;
      this[key] = await maps[key].reduce(async (prev, current) => {
        try {
          return {
            ...(await prev),
            [current]: await storage[key].get(current.toString()),
          };
        } catch (ex) {
          return {
            ...(await prev),
          };
        }
      }, Promise.resolve({}));
    }
  }

  async initializeExchange(
    tokenAAddress: string,
    tokenBAddress: string,
    tokenAAmount: number,
    tokenBAmount: number,
    tokenAid: BigNumber = new BigNumber(0),
    tokenBid: BigNumber = new BigNumber(0),
    approve: boolean = true
  ): Promise<TransactionOperation> {
    if (approve) {
      if (["FA2", "MIXED"].includes(standard)) {
        await this.approveFA2Token(
          tokenAAddress,
          tokenAid,
          tokenAAmount,
          this.contract.address
        );
      } else {
        await this.approveFA12Token(
          tokenAAddress,
          tokenAAmount,
          this.contract.address
        );
      }
      if ("FA2" == standard) {
        await this.approveFA2Token(
          tokenBAddress,
          tokenBid,
          tokenBAmount,
          this.contract.address
        );
      } else {
        await this.approveFA12Token(
          tokenBAddress,
          tokenBAmount,
          this.contract.address
        );
      }
    }

    const operation = await this.contract.methods
      .use(
        "addPair",
        tokenAAddress,
        tokenAid,
        standard.toLowerCase() == "mixed" ? "fa2" : standard.toLowerCase(),
        null,
        tokenBAddress,
        tokenBid,
        standard.toLowerCase() == "mixed" ? "fa12" : standard.toLowerCase(),
        null,
        tokenAAmount,
        tokenBAmount
      )
      .send();
    await confirmOperation(tezos, operation.hash);
    return operation;
  }

  async tokenToTokenRoutePayment(
    swaps: SwapSliceType[],
    amountIn: number,
    minAmountOut: number,
    receiver: string,
    tokenAid: BigNumber = new BigNumber(0),
    tokenBid: BigNumber = new BigNumber(0)
  ): Promise<TransactionOperation> {
    let firstSwap = swaps[0];
    if (Object.keys(firstSwap.operation)[0] == "buy") {
      if (["FA2"].includes(standard)) {
        await this.approveFA2Token(
          firstSwap.pair.token_b_address,
          tokenBid,
          amountIn,
          this.contract.address
        );
      } else {
        await this.approveFA12Token(
          firstSwap.pair.token_b_address,
          amountIn,
          this.contract.address
        );
      }
    } else {
      if (["FA2", "MIXED"].includes(standard)) {
        await this.approveFA2Token(
          firstSwap.pair.token_a_address,
          tokenAid,
          amountIn,
          this.contract.address
        );
      } else {
        await this.approveFA12Token(
          firstSwap.pair.token_a_address,
          amountIn,
          this.contract.address
        );
      }
    }
    const operation = await this.contract.methods
      .use("swap", swaps, amountIn, minAmountOut, receiver)
      .send();
    await confirmOperation(tezos, operation.hash);
    return operation;
  }

  async tokenToTokenPayment(
    tokenAAddress: string,
    tokenBAddress: string,
    opType: string,
    amountIn: number,
    minAmountOut: number,
    receiver: string,
    tokenAid: BigNumber = new BigNumber(0),
    tokenBid: BigNumber = new BigNumber(0)
  ): Promise<TransactionOperation> {
    if (opType == "buy") {
      if (["FA2"].includes(standard)) {
        await this.approveFA2Token(
          tokenBAddress,
          tokenBid,
          amountIn,
          this.contract.address
        );
      } else {
        await this.approveFA12Token(
          tokenBAddress,
          amountIn,
          this.contract.address
        );
      }
    } else {
      if (["FA2", "MIXED"].includes(standard)) {
        await this.approveFA2Token(
          tokenAAddress,
          tokenAid,
          amountIn,
          this.contract.address
        );
      } else {
        await this.approveFA12Token(
          tokenAAddress,
          amountIn,
          this.contract.address
        );
      }
    }
    const swaps = [
      {
        pair: {
          token_a_address: tokenAAddress,
          token_b_address: tokenBAddress,
          token_a_id: tokenAid,
          token_b_id: tokenBid,
          token_a_type: {
            [standard.toLowerCase() == "mixed"
              ? "fa2"
              : standard.toLowerCase()]: null,
          },
          token_b_type: {
            [standard.toLowerCase() == "mixed"
              ? "fa12"
              : standard.toLowerCase()]: null,
          },
        },
        operation: { [opType]: null },
      },
    ];
    const operation = await this.contract.methods
      .use("swap", swaps, amountIn, minAmountOut, receiver)
      .send();
    await confirmOperation(tezos, operation.hash);
    return operation;
  }

  async investLiquidity(
    pairId: string,
    tokenAAmount: number,
    tokenBAmount: number,
    minShares: number
  ): Promise<TransactionOperation> {
    await this.updateStorage({ tokens: [pairId] });
    let pair = this.storage.tokens[pairId];
    if (["FA2", "MIXED"].includes(standard)) {
      await this.approveFA2Token(
        pair.token_a_address,
        pair.token_a_id,

        tokenAAmount,
        this.contract.address
      );
    } else {
      await this.approveFA12Token(
        pair.token_a_address,
        tokenAAmount,
        this.contract.address
      );
    }
    if ("FA2" == standard) {
      await this.approveFA2Token(
        pair.token_b_address,
        pair.token_b_id,
        tokenBAmount,
        this.contract.address
      );
    } else {
      await this.approveFA12Token(
        pair.token_b_address,
        tokenBAmount,
        this.contract.address
      );
    }
    const operation = await this.contract.methods
      .use(
        "invest",
        pair.token_a_address,
        pair.token_a_id,
        minShares,
        standard.toLowerCase() == "mixed" ? "fa2" : standard.toLowerCase(),
        null,
        pair.token_b_address,
        pair.token_b_id,
        standard.toLowerCase() == "mixed" ? "fa12" : standard.toLowerCase(),
        null,
        tokenAAmount,
        tokenBAmount
      )
      .send();
    await confirmOperation(tezos, operation.hash);
    return operation;
  }

  async divestLiquidity(
    pairId: string,
    tokenAAmount: number,
    tokenBAmount: number,
    sharesBurned: number
  ): Promise<TransactionOperation> {
    await this.updateStorage({ tokens: [pairId] });
    let pair = this.storage.tokens[pairId];
    const operation = await this.contract.methods
      .use(
        "divest",
        pair.token_a_address,
        pair.token_a_id,
        standard.toLowerCase() == "mixed" ? "fa2" : standard.toLowerCase(),
        null,
        pair.token_b_address,
        pair.token_b_id,
        standard.toLowerCase() == "mixed" ? "fa12" : standard.toLowerCase(),
        null,
        tokenAAmount,
        tokenBAmount,
        sharesBurned
      )
      .send();
    await confirmOperation(tezos, operation.hash);
    return operation;
  }

  async approveFA2Token(
    tokenAddress: string,
    tokenId: BigNumber,
    tokenAmount: number,
    address: string
  ): Promise<TransactionOperation> {
    await this.updateStorage();
    let token = await tezos.contract.at(tokenAddress);
    let operation = await token.methods
      .update_operators([
        {
          [tokenAmount ? "add_operator" : "remove_operator"]: {
            owner: await tezos.signer.publicKeyHash(),
            operator: address,
            token_id: tokenId,
          },
        },
      ])
      .send();
    await confirmOperation(tezos, operation.hash);
    return operation;
  }

  async approveFA12Token(
    tokenAddress: string,
    tokenAmount: number,
    address: string
  ): Promise<TransactionOperation> {
    await this.updateStorage();
    let token = await tezos.contract.at(tokenAddress);
    let operation = await token.methods.approve(address, tokenAmount).send();
    await confirmOperation(tezos, operation.hash);
    return operation;
  }

  async setDexFunction(index: number, lambdaName: string): Promise<void> {
    let ligo = getLigo(true);
    const stdout = execSync(
      `${ligo} compile-parameter --michelson-format=json $PWD/contracts/main/TTDex.ligo main 'SetDexFunction(record index =${index}n; func = ${lambdaName}; end)'`,
      { maxBuffer: 1024 * 500 }
    );
    const operation = await tezos.contract.transfer({
      to: this.contract.address,
      amount: 0,
      parameter: {
        entrypoint: "setDexFunction",
        value: JSON.parse(stdout.toString()).args[0].args[0].args[0],
      },
    });
    await confirmOperation(tezos, operation.hash);
  }

  async setTokenFunction(index: number, lambdaName: string): Promise<void> {
    let ligo = getLigo(true);
    const stdout = execSync(
      `${ligo} compile-parameter --michelson-format=json $PWD/contracts/main/TTDex.ligo main 'SetTokenFunction(record index =${index}n; func = ${lambdaName}; end)'`,
      { maxBuffer: 1024 * 500 }
    );
    const operation = await tezos.contract.transfer({
      to: this.contract.address,
      amount: 0,
      parameter: {
        entrypoint: "setTokenFunction",
        value: JSON.parse(stdout.toString()).args[0].args[0].args[0],
      },
    });
    await confirmOperation(tezos, operation.hash);
  }
}
