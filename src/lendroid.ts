const Web3 = require("web3");

import { Logger, LOGGER_CONTEXT, Web3Utils, getTokenExchangeRate } from "./services";

export class Lendroid {
  private web3: any;

  constructor(initParams: any = {}) {
    this.web3 = new Web3(initParams.provider || (window as any).web3.currentProvider);

    this.init(initParams);
  }

  private init(initParams) {
    Logger.info(LOGGER_CONTEXT.INIT, initParams);
  }
}
