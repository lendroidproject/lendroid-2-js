import Axios from 'axios'
import { Events, SupportTokens } from '../constants'
// import * as Constants from '../constants'

import { Logger, LOGGER_CONTEXT } from './'

const monthNames = [
  ['F', 'Jan'],
  ['G', 'Feb'],
  ['H', 'Mar'],
  ['J', 'Apr'],
  ['K', 'May'],
  ['M', 'Jun'],
  ['N', 'Jul'],
  ['Q', 'Aug'],
  ['U', 'Sep'],
  ['V', 'Oct'],
  ['X', 'Nov'],
  ['Z', 'Dec'],
]

const lastWeekdayOfEachMonths = (years, { weekday = 4, from = 0 } = {}) => {
  const lastDay = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  const weekdays: any = []
  weekdays.match = {}
  for (const year of years) {
    const date = new Date(Date.UTC(year, 0, 1, 12))
    if (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) {
      lastDay[2] = 29
    }
    for (let m = from; m < from + 12; m += 1) {
      const month = m % 12
      const y = year + Math.floor(month / 12)
      const ySuf = y.toString().substr(-2)
      date.setFullYear(y, month % 12, lastDay[month % 12])
      date.setDate(date.getDate() - ((date.getDay() + (7 - weekday)) % 7))
      const name = monthNames[month][0] + ySuf
      const timestamp = Math.round(date.getTime() / 1000)
      const data = {
        name,
        timestamp,
        fullName: `${monthNames[month][1]} ${y}`,
        date: date.toISOString().substring(0, 10),
      }
      weekdays.push(data)
      weekdays.match[name] = timestamp
      weekdays.match[timestamp] = name
    }
  }
  return weekdays
}

/**
 * Support Contracts
 */
export class Contracts {
  private network: any
  private address: any
  private web3Utils: any

  private onEvent: any

  private balanceTimer: any
  private fetchTokens: any = []
  private balanceTokens: any = []
  private lsfuiTokens: any = []
  private lsfuiTokenMap = {}

  private poolNames: any = []
  private poolNameMap = {}
  private riskFreePools: any = []
  private riskFreePoolMap = {}
  private riskyPools: any = []
  private riskyPoolMap = {}

  // Public properties

  /**
   * Array of Support Expiry of each month of current year
   */
  public expiries: any

  /**
   * Array of Contracts
   */
  public contracts: any = {}

  /**
   * Array of Support Tokens
   */
  public supportTokens: any = {}

  constructor(params: any) {
    this.expiries = lastWeekdayOfEachMonths([new Date().getFullYear()])
    this.init(params)
  }

  /**
   * Detect Network changes and Fetch contracts again
   */
  public onNextworkChange(network) {
    this.networkChanged(network)
  }

  /**
   * Detect Network changes and Fetch contracts again
   */
  public onUpdateAddress(address) {
    this.addressChanged(address)
  }

  /**
   * Refresh Contracts & Balances
   */
  public async getBalances(withContract = false) {
    if (withContract) {
      await this.initializeLSFUITokens()
    }
    this.fetchBalances()
  }

  /**
   * Refresh Pool Names
   */
  public async getPoolNames() {
    this.fetchPoolNames()
  }

  /**
   * Refresh Risk-Free Pools
   */
  public async getRiskFreePools() {
    this.fetchRiskFreePools()
  }

  /**
   * Refresh Risky Pools
   */
  public async getRiskyPools() {
    this.fetchRiskyPools()
  }

  /**
   * Wrap Currency
   * @param amount
   */
  public onWrap(token, amount) {
    const {
      contracts: { [token]: wrapToken, CurrencyDao },
      address,
      web3Utils,
    } = this
    return CurrencyDao.methods.wrap(wrapToken._address, web3Utils.toWei(amount)).send({ from: address })
  }

  /**
   * Wrap Currency
   * @param amount
   */
  public onUnwrap(token, amount) {
    const {
      contracts: { [token]: wrapToken, CurrencyDao },
      address,
      web3Utils,
    } = this
    return CurrencyDao.methods.unwrap(wrapToken._address, web3Utils.toWei(amount)).send({ from: address })
  }

  /**
   * Split Currency
   * @param amount
   */
  public onSplit(token, form) {
    const { amount, expiry, underlying, strike } = form
    const {
      contracts: { [token]: splitToken, InterestPoolDao, UnderwriterPoolDao },
      address,
      web3Utils,
      expiries,
    } = this
    const expiryTimeStamp = expiries.match[expiry]
    if (!underlying) {
      return InterestPoolDao.methods
        .split(splitToken._address, expiryTimeStamp, web3Utils.toWei(amount))
        .send({ from: address })
    }
    const { [underlying]: underlyingToken } = this.contracts
    return UnderwriterPoolDao.methods
      .split(splitToken._address, expiryTimeStamp, underlyingToken._address, strike, web3Utils.toWei(amount))
      .send({ from: address })
  }

  /**
   * Fuse Currency
   * @param token
   * @param form
   */
  public onFuse(token, form) {
    const { amount, expiry, underlying, strike } = form
    const [, origin] = token.split('_')
    const {
      contracts: { [origin]: fuseToken, InterestPoolDao, UnderwriterPoolDao },
      address,
      web3Utils,
      expiries,
    } = this
    const expiryTimeStamp = expiries.match[expiry]
    if (!underlying) {
      return InterestPoolDao.methods
        .fuse(fuseToken._address, expiryTimeStamp, web3Utils.toWei(amount))
        .send({ from: address })
    }
    const { [underlying]: underlyingToken } = this.contracts
    return UnderwriterPoolDao.methods
      .fuse(fuseToken._address, expiryTimeStamp, underlyingToken._address, strike, web3Utils.toWei(amount))
      .send({ from: address })
  }

  /**
   * Registration stake lookup by name length or minimun
   * @param poolNameLength
   */
  public onRegisterLookUpStake(poolNameLength) {
    const {
      contracts: { PoolNameRegistry },
    } = this
    return new Promise((resolve, reject) => {
      PoolNameRegistry.methods
        .name_registration_stake_lookup__stake(poolNameLength)
        .call()
        .then(stake => {
          if (Number(stake) === 0) {
            PoolNameRegistry.methods
              .name_registration_minimum_stake()
              .call()
              .then(resolve)
              .catch(reject)
          } else {
            resolve(stake)
          }
        })
        .catch(reject)
    })
  }

  /**
   * Register Pool Name
   * @param poolName
   */
  public onRegisterPoolName(poolName) {
    const {
      contracts: { PoolNameRegistry },
      address,
    } = this
    return PoolNameRegistry.methods.register_name(poolName).send({ from: address })
  }

  /**
   * Create New Pool
   * @param form
   */
  public onCreatePool(form) {
    const { riskFree, poolName, feePercentI, feePercentS, currency, onlyMe, exchangeRate, expiryLimit } = form
    const {
      contracts: {
        [currency]: { _address: currencyAddr },
        InterestPoolDao,
        UnderwriterPoolDao,
      },
      address,
    } = this
    return riskFree
      ? InterestPoolDao.methods
          .register_pool(onlyMe, currencyAddr, poolName, exchangeRate, feePercentI, expiryLimit)
          .send({ from: address })
      : UnderwriterPoolDao.methods
          .register_pool(onlyMe, currencyAddr, poolName, exchangeRate, feePercentI, feePercentS, expiryLimit)
          .send({ from: address })
  }

  /**
   * Offer New Token
   * @param poolId
   * @param form
   */
  public onOfferNewToken(poolId, form) {
    const { expiry, underlying, strike, iCostPerDay, sCostPerDay } = form
    const { contract: poolContract } = (underlying ? this.riskyPoolMap : this.riskFreePoolMap)[poolId]
    const {
      contracts: { [underlying]: underlyingToken },
      address,
      web3Utils,
      expiries,
    } = this
    const expiryTimeStamp = expiries.match[expiry]
    return underlying
      ? poolContract.methods
          .support_mft(
            expiryTimeStamp,
            underlyingToken._address,
            strike,
            web3Utils.toWei(iCostPerDay),
            web3Utils.toWei(sCostPerDay)
          )
          .send({ from: address })
      : poolContract.methods.support_mft(expiryTimeStamp, web3Utils.toWei(iCostPerDay)).send({ from: address })
  }

  /**
   * Withdraw Earnings
   * @param poolId
   * @param riskFree
   */
  public onWithdrawEarnings(poolId, riskFree = true) {
    const { contract: poolContract } = (riskFree ? this.riskyPoolMap : this.riskFreePoolMap)[poolId]
    return poolContract.methods.withdraw_earnings().send({ from: this.address })
  }

  /**
   * Close Pool
   * @param poolId
   * @param riskFree
   */
  public onClosePool(poolId, riskFree = true) {
    const { contract: poolContract } = (riskFree ? this.riskyPoolMap : this.riskFreePoolMap)[poolId]
    return poolContract.methods.deregister().send({ from: this.address })
  }

  private init({
    tokens,
    web3Utils,
    network,
    address,
    onEvent = (...args) => Logger.info(LOGGER_CONTEXT.CONTRACT_EVENT, args),
  }) {
    this.initTokens(tokens)
    this.web3Utils = web3Utils
    this.onEvent = onEvent
    this.address = address
    this.networkChanged(network)
  }
  private initTokens(tokens) {
    this.supportTokens = SupportTokens(tokens)
    this.fetchTokens = Object.keys(this.supportTokens).filter(token => typeof this.supportTokens[token] !== 'string')
    this.balanceTokens = Object.keys(this.supportTokens).filter(token => this.supportTokens[token].base === 'ERC20')
  }
  private getTokenByAddr(addr = '') {
    const idx = this.balanceTokens.findIndex(token => {
      if (this.contracts[token] && this.contracts[token]._address.toLowerCase() === addr.toLowerCase()) {
        return true
      }
      return false
    })
    if (idx === -1) {
      return ''
    }
    return this.balanceTokens[idx]
  }
  private networkChanged(network) {
    this.network = network
    this.onEvent(Events.NETWORK_CHANGED)
    this.fetchContracts()
  }
  private addressChanged(address) {
    this.address = address
    this.fetchBalances()
  }
  private fetchBalanceStart() {
    if (this.balanceTimer) {
      clearInterval(this.balanceTimer)
    }
    this.fetchBalances()
    this.balanceTimer = setInterval(() => this.fetchBalances(), 30 * 1000)
  }
  private fetchBalances() {
    // Promise.all([...this.balanceTokens.map(token => this.fetchBalanceByToken(token)), this.fetchETHBalance()])
    Promise.all([...this.balanceTokens, ...this.lsfuiTokens].map(token => this.fetchBalanceByToken(token)))
      .then(data => this.onEvent(Events.BALANCE_UPDATED, { data }))
      .catch(err => this.onEvent(Events.BALANCE_FAILED, err))
  }
  private fetchETHBalance() {
    const { address, web3Utils } = this
    return new Promise(resolve => {
      web3Utils.eth
        .getBalance(address)
        .then(value => {
          resolve({ token: 'ETH', balance: web3Utils.fromWei(value) })
        })
        .catch(err => resolve({ token: 'ETH', balance: 0 }))
    })
  }
  private fetchBalanceByToken(token: string) {
    const {
      address,
      web3Utils,
      contracts: { [token]: contractInstance, ...contracts },
      supportTokens: { ZERO_ADDRESS },
      expiries,
    } = this
    if (token.includes('_') && !token.includes('L_')) {
      const [type, origin, expiry, underlying, strike] = token.split('_')
      const bToken = `${type}_${origin}_${expiry}_${underlying || '-'}_${strike || '-'}`
      return new Promise(resolve => {
        contractInstance.methods
          .id(
            contracts[origin]._address,
            Number(expiries.match[expiry]),
            !underlying ? ZERO_ADDRESS : contracts[underlying]._address,
            !underlying ? 0 : strike
          )
          .call()
          .then(id => {
            if (id) {
              contractInstance.methods
                .balanceOf(address, id)
                .call()
                .then(res => {
                  const balance = web3Utils.fromWei(res)
                  resolve({ token: bToken, balance })
                })
                .catch(err => resolve({ token: bToken, balance: 0 }))
            } else {
              resolve({ token: bToken, balance: -1 })
            }
          })
          .catch(err => resolve({ token: bToken, balance: -1 }))
      })
    } else {
      return new Promise(resolve => {
        if (!address || !contractInstance || !contractInstance.methods.balanceOf) {
          resolve({ token, balance: 0 })
        }
        contractInstance.methods
          .balanceOf(address)
          .call()
          .then(res => {
            const balance = web3Utils.fromWei(res)
            resolve({ token, balance, name: this.lsfuiTokenMap[token] })
          })
          .catch(err => resolve({ token, balance: 0 }))
      })
    }
  }
  private fetchContracts() {
    Promise.all(this.fetchTokens.map(token => this.fetchContractByToken(token)))
      .then(data => {
        this.onEvent(Events.CONTRACT_FETCHED, { data })
        this.initializeProtocol()
      })
      .catch(err => this.onEvent(Events.CONTRACT_FETCH_FAILED, err))
  }
  private fetchContractByToken(token: string) {
    const { network, web3Utils, supportTokens } = this
    return new Promise(resolve => {
      if (!supportTokens[token].def) {
        if (!supportTokens[token][network]) {
          return resolve({ [token]: 'unknown' })
        }
        const url = `https://${
          network === 1 ? 'api' : 'api-kovan'
        }.etherscan.io/api?module=contract&action=getabi&address=${supportTokens[token][network]}`
        Axios.get(url)
          .then(res => {
            if (Number(res.data.status)) {
              const contractABI = JSON.parse(res.data.result)
              this.contracts[token] = web3Utils.createContract(contractABI, supportTokens[token][network])
              resolve({ [token]: 'success' })
            } else {
              resolve({ [token]: 'failed' })
            }
          })
          .catch(err => this.onEvent(Events.CONTRACT_FETCH_FAILED, err))
      } else {
        const contractABI = supportTokens[token].def
        if (supportTokens[token].all) {
          this.contracts[token] = web3Utils.createContract(
            contractABI.hasNetwork ? contractABI[network] : contractABI,
            supportTokens[token].all
          )
          resolve({ [token]: 'success' })
        } else {
          this.contracts[token] = web3Utils.createContract(
            contractABI.hasNetwork ? contractABI[network] : contractABI,
            supportTokens[token][network]
          )
          resolve({ [token]: 'success' })
        }
      }
    })
  }
  private async fetchPoolNames() {
    const {
      contracts: { PoolNameRegistry },
    } = this

    const poolNames: any = []
    const poolNameMap: any = {}
    const poolNameCount = await PoolNameRegistry.methods.next_name_id().call()
    for (let poolNameId = 0; poolNameId < poolNameCount; poolNameId++) {
      const poolName = await PoolNameRegistry.methods.names__name(poolNameId).call()
      const poolOperator = await PoolNameRegistry.methods.names__operator(poolNameId).call()
      const poolStaked = await PoolNameRegistry.methods.names__LST_staked(poolNameId).call()
      const poolIReg = await PoolNameRegistry.methods.names__interest_pool_registered(poolNameId).call()
      const poolUReg = await PoolNameRegistry.methods.names__underwriter_pool_registered(poolNameId).call()
      poolNames.push(poolName)
      poolNameMap[poolName] = {
        id: poolNameId,
        name: poolName,
        operator: poolOperator,
        staked: poolStaked,
        iReg: poolIReg,
        uReg: poolUReg,
      }
    }
    this.poolNames = poolNames
    this.poolNameMap = poolNameMap

    this.onEvent(Events.POOL_NAME_FETCHED, { data: this.poolNames })
  }
  private async fetchRiskFreePools() {
    const {
      supportTokens,
      contracts: { InterestPoolDao },
      web3Utils,
    } = this

    const pools: any = []
    const poolMap: any = {}
    const poolCount = await InterestPoolDao.methods.next_pool_id().call()
    for (let poolId = 0; poolId < poolCount; poolId++) {
      const poolName = await InterestPoolDao.methods.pool_id_to_name(poolId).call()
      const poolCurrency = await InterestPoolDao.methods.pools__currency(poolName).call()
      const poolOperator = await InterestPoolDao.methods.pools__operator(poolName).call()

      const poolAddress = await InterestPoolDao.methods.pools__address_(poolName).call()
      const poolContract = web3Utils.createContract(supportTokens.InterestPool.def, poolAddress)
      const poolInfo: any = {}
      poolInfo.totalContributions = await poolContract.methods.total_active_contributions().call()
      poolInfo.unusedContributions = await poolContract.methods.total_f_token_balance().call()
      poolInfo.outstandingPoolshare = await poolContract.methods.total_pool_share_token_supply().call()
      poolInfo.contributionsOpen = await poolContract.methods.accepts_public_contributions().call()
      poolInfo.myUnwithdrawn = await poolContract.methods.operator_unwithdrawn_earnings().call()
      poolInfo.depositeRate = await poolContract.methods.exchange_rate().call()
      poolInfo.withdrawalRate = 0

      poolInfo.feePercentI = await poolContract.methods.fee_percentage_per_i_token().call()
      poolInfo.expiryLimit = await poolContract.methods.mft_expiry_limit_days().call()

      poolMap[poolId] = {
        id: poolId,
        name: poolName,
        currency: this.getTokenByAddr(poolCurrency),
        operator: poolOperator,
        contract: poolContract,
        ...poolInfo,
      }
      pools.push(poolMap[poolId])
    }

    this.riskFreePools = pools
    this.riskFreePoolMap = poolMap

    this.onEvent(Events.RISK_FREE_POOL_FETCHED, { data: this.riskFreePools })
  }
  private async fetchRiskyPools() {
    const {
      supportTokens,
      contracts: { UnderwriterPoolDao },
      web3Utils,
    } = this

    const pools: any = []
    const poolMap: any = {}
    const poolCount = await UnderwriterPoolDao.methods.next_pool_id().call()
    for (let poolId = 0; poolId < poolCount; poolId++) {
      const poolName = await UnderwriterPoolDao.methods.pool_id_to_name(poolId).call()
      const poolCurrency = await UnderwriterPoolDao.methods.pools__currency(poolName).call()
      const poolOperator = await UnderwriterPoolDao.methods.pools__operator(poolName).call()

      const poolAddress = await UnderwriterPoolDao.methods.pools__address_(poolName).call()
      const poolContract = web3Utils.createContract(supportTokens.UnderwriterPool.def, poolAddress)
      const poolInfo: any = {}
      poolInfo.totalContributions = await poolContract.methods.total_active_contributions().call()
      poolInfo.unusedContributions = await poolContract.methods.total_u_token_balance().call()
      poolInfo.outstandingPoolshare = await poolContract.methods.total_pool_share_token_supply().call()
      poolInfo.contributionsOpen = await poolContract.methods.accepts_public_contributions().call()
      poolInfo.myUnwithdrawn = await poolContract.methods.operator_unwithdrawn_earnings().call()
      poolInfo.depositeRate = await poolContract.methods.exchange_rate().call()
      poolInfo.withdrawalRate = 0

      poolInfo.feePercentI = await poolContract.methods.fee_percentage_per_i_token().call()
      poolInfo.feePercentS = await poolContract.methods.fee_percentage_per_s_token().call()
      poolInfo.expiryLimit = await poolContract.methods.mft_expiry_limit_days().call()

      poolMap[poolId] = {
        id: poolId,
        name: poolName,
        currency: this.getTokenByAddr(poolCurrency),
        operator: poolOperator,
        contract: poolContract,
        ...poolInfo,
      }
      pools.push(poolMap[poolId])
    }
    this.riskyPools = pools
    this.riskyPoolMap = poolMap

    this.onEvent(Events.RISKY_POOL_FETCHED, { data: this.riskyPools })
  }
  private async getMFTProperties(contract) {
    if (!contract) {
      return []
    }
    const { expiries } = this
    const nonce = await contract.methods.nonce().call()
    const ret: any = []
    for (let i = 1; i <= nonce; i++) {
      const token = await contract.methods.metadata__id(i).call()
      const expiry = await contract.methods.metadata__expiry(i).call()
      const underlying = await contract.methods.metadata__underlying(i).call()
      const strikePrice = await contract.methods.metadata__strike_price(i).call()
      if (expiries.match[expiry]) {
        ret.push([token, expiries.match[expiry], this.getTokenByAddr(underlying), strikePrice])
      }
    }
    return ret
  }
  private async initializeLSFUITokens() {
    const {
      contracts: { CurrencyDao },
      web3Utils,
      supportTokens: { ZERO_ADDRESS, ...supportTokens },
    } = this

    const lsfuiTokens: string[] = []
    const lsfuiTokenMap: any = {}
    for (const token of this.balanceTokens) {
      if (this.contracts[token]) {
        const lTokenAddress = await CurrencyDao.methods.token_addresses__l(this.contracts[token]._address).call()
        if (lTokenAddress && lTokenAddress !== ZERO_ADDRESS) {
          this.contracts[`L_${token}`] = web3Utils.createContract(supportTokens[token].def, lTokenAddress)
          const contractName = await this.contracts[`L_${token}`].methods.name().call()
          lsfuiTokens.push(`L_${token}`)
          lsfuiTokenMap[`L_${token}`] = contractName
        }
        const fTokenAddress = await CurrencyDao.methods.token_addresses__f(this.contracts[token]._address).call()
        if (fTokenAddress && fTokenAddress !== ZERO_ADDRESS) {
          const fTokenContract = web3Utils.createContract(supportTokens.MultiFungibleToken.def, fTokenAddress)
          const props: any = await this.getMFTProperties(fTokenContract)
          for (const [, expiry] of props) {
            this.contracts[`F_${token}_${expiry}`] = fTokenContract
            lsfuiTokens.push(`F_${token}_${expiry}`)
          }
        }
        const iTokenAddress = await CurrencyDao.methods.token_addresses__i(this.contracts[token]._address).call()
        if (iTokenAddress && iTokenAddress !== ZERO_ADDRESS) {
          const iTokenContract = web3Utils.createContract(supportTokens.MultiFungibleToken.def, iTokenAddress)
          const props: any = await this.getMFTProperties(iTokenContract)
          for (const [, expiry] of props) {
            this.contracts[`I_${token}_${expiry}`] = iTokenContract
            lsfuiTokens.push(`I_${token}_${expiry}`)
          }
        }
        const sTokenAddress = await CurrencyDao.methods.token_addresses__s(this.contracts[token]._address).call()
        if (sTokenAddress && sTokenAddress !== ZERO_ADDRESS) {
          const sTokenContract = web3Utils.createContract(supportTokens.MultiFungibleToken.def, sTokenAddress)
          const props = await this.getMFTProperties(sTokenContract)
          for (const [, expiry, underlying, strike] of props) {
            this.contracts[`S_${token}_${expiry}_${underlying}_${strike}`] = sTokenContract
            lsfuiTokens.push(`S_${token}_${expiry}_${underlying}_${strike}`)
          }
        }
        const uTokenAddress = await CurrencyDao.methods.token_addresses__u(this.contracts[token]._address).call()
        if (uTokenAddress && uTokenAddress !== ZERO_ADDRESS) {
          const uTokenContract = web3Utils.createContract(supportTokens.MultiFungibleToken.def, uTokenAddress)
          const props = await this.getMFTProperties(uTokenContract)
          for (const [, expiry, underlying, strike] of props) {
            this.contracts[`U_${token}_${expiry}_${underlying}_${strike}`] = uTokenContract
            lsfuiTokens.push(`U_${token}_${expiry}_${underlying}_${strike}`)
          }
        }
      }
    }
    this.lsfuiTokens = lsfuiTokens
    this.lsfuiTokenMap = lsfuiTokenMap
  }
  private async initializeProtocol() {
    const {
      contracts: { ProtocolDao },
      web3Utils,
    } = this
    const currencyDaoAddr = await ProtocolDao.methods.daos(1).call()
    const currencyDao = web3Utils.createContract(this.supportTokens.CurrencyDao.def, currencyDaoAddr)
    this.contracts.CurrencyDao = currencyDao
    const interestPoolDaoAddr = await ProtocolDao.methods.daos(2).call()
    const interestPoolDao = web3Utils.createContract(this.supportTokens.InterestPoolDao.def, interestPoolDaoAddr)
    this.contracts.InterestPoolDao = interestPoolDao
    const poolContractDaoAddr = await ProtocolDao.methods.daos(3).call()
    const poolContractDao = web3Utils.createContract(this.supportTokens.UnderwriterPoolDao.def, poolContractDaoAddr)
    this.contracts.UnderwriterPoolDao = poolContractDao
    const marketDaoAddr = await ProtocolDao.methods.daos(4).call()
    const marketDao = web3Utils.createContract(this.supportTokens.MarketDao.def, marketDaoAddr)
    this.contracts.MarketDao = marketDao
    const poolNameRegistryAddr = await ProtocolDao.methods.registries(1).call()
    const poolNameRegistry = web3Utils.createContract(this.supportTokens.PoolNameRegistry.def, poolNameRegistryAddr)
    this.contracts.PoolNameRegistry = poolNameRegistry
    this.fetchPoolNames()
    this.fetchRiskFreePools()
    this.fetchRiskyPools()
    await this.initializeLSFUITokens()
    this.fetchBalanceStart()
  }
}
