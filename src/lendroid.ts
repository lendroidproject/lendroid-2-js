import Web3 from 'web3'

import {
  Logger,
  LOGGER_CONTEXT,
  Web3Utils,
  // getTokenExchangeRate
} from './services'
import { CurrencyDao, InterestPoolDao, UnderwriterPoolDao, SupportTokens } from './constants'

/**
 * Lendroid Libraray 2.0
 */
export class Lendroid {
  private web3: any
  private contracts: any = {}
  private supportTokens: any = {}
  /**
   * Provide web3Utils
   */
  public web3Utils: Web3Utils

  constructor(initParams: any = {}) {
    this.web3 = new (Web3 as any)(initParams.provider || (window as any).web3.currentProvider)
    this.web3Utils = new Web3Utils(this.web3)

    this.init(initParams)
  }

  /**
   * For Test
   */
  public test() {
    this.contracts.CurrencyDao = this.web3Utils.createContract(CurrencyDao)
    this.contracts.CurrencyDao.methods.initialize(
      this.supportTokens.Owner,
      this.supportTokens.LST,
      this.supportTokens.CurrencyPool,
      this.supportTokens.ERC20,
      this.supportTokens.ERC1155,
      this.supportTokens.MarketDao
    )
    this.contracts.InterestPoolDao = this.web3Utils.createContract(InterestPoolDao)
    this.contracts.UnderwriterPoolDao = this.web3Utils.createContract(UnderwriterPoolDao)
  }

  private init(initParams: any) {
    Logger.info(LOGGER_CONTEXT.INIT, initParams)
    this.supportTokens = SupportTokens({})
    this.test()
  }
}
