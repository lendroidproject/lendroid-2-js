import Web3 from 'web3'

import {
  Logger,
  LOGGER_CONTEXT,
  Web3Utils,
  Contracts,
  // getTokenExchangeRate
} from './services'

/**
 * Lendroid Libraray 2.0
 */
export class Lendroid {
  private params: any
  private web3: any
  private address: any
  /**
   * Provide web3Utils
   */
  public web3Utils: Web3Utils
  /**
   * Provide Protocol
   */
  public contracts: Contracts

  constructor(initParams: any = {}) {
    this.params = initParams
  }

  /**
   * For Test
   */
  public async enable(provider) {
    try {
      const prov = provider || (window as any).web3.currentProvider || (window as any).ethereum
      if (prov && prov.enable) {
        console.log(await prov.enable())
      }
      this.web3 = new (Web3 as any)(prov)
      this.web3Utils = new Web3Utils(this.web3)
      const accounts = await this.web3.eth.getAccounts()
      this.address = accounts[0]
      // const network = await this.web3.eth.net.getId()
      this.init()
    } catch (err) {
      Logger.error(LOGGER_CONTEXT.METAMASK_ERROR, err)
    }
  }

  private init() {
    Logger.info(LOGGER_CONTEXT.INIT, this.params)
    this.contracts = new Contracts({ web3Utils: this.web3Utils, address: this.address, ...this.params })
  }
}
