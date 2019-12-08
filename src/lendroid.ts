import Web3 from 'web3'

import {
  Logger,
  LOGGER_CONTEXT,
  // Web3Utils,
  // getTokenExchangeRate
} from './services'
import { CurrencyDao } from './constants'

/**
 * Lendroid Libraray 2.0
 */
export class Lendroid {
  private web3: any
  /**
   * Preserve Supported Conracts by [key, contract] pairs
   */
  public contracts: any = {}

  constructor(initParams: any = {}) {
    this.web3 = new Web3(initParams.provider || (window as any).web3.currentProvider)

    this.init(initParams)
  }

  /**
   * For Test
   */
  public test() {
    this.contracts.CurrencyDao = new this.web3.eth.Contract(CurrencyDao)
    console.log(this.contracts)
  }

  private init(initParams) {
    Logger.info(LOGGER_CONTEXT.INIT, initParams)
  }
}
