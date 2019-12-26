import Axios from 'axios'
import { Events, SupportTokens } from '../constants'
// import * as Constants from '../constants'

import { Logger, LOGGER_CONTEXT } from './'

/**
 * Support Contracts
 */
export class Contracts {
  private contracts: any = {}
  private supportTokens: any
  private fetchTokens: any = []
  private balanceTokens: any = []
  private web3Utils: any
  private network: any
  private address: any
  private onEvent: any
  private balanceTimer: any
  private endOfYear: number
  /**
   * Exported property for wide-use
   */
  // public property: any

  constructor(params: any) {
    this.endOfYear = Math.round(new Date(`${new Date().getFullYear()}-12-31`).getTime() / 1000)
    this.init(params)

    this.fetchBalanceByToken = this.fetchBalanceByToken.bind(this)
    this.fetchContractByToken = this.fetchContractByToken.bind(this)
  }

  /**
   * Detect Network changes and Fetch contracts again
   */
  public onNextworkChange(network) {
    this.networkChanged(network)
  }

  /**
   * Array of Support Tokens with ERC20
   */
  public getTokens() {
    return this.fetchTokens
  }

  /**
   * Refresh Balances
   */
  public getBalances() {
    this.fetchBalances()
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
    console.log(wrapToken, CurrencyDao, amount)
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
    console.log(wrapToken, CurrencyDao, amount)
    return CurrencyDao.methods.unwrap(wrapToken._address, web3Utils.toWei(amount)).send({ from: address })
  }

  /**
   * Split Currency
   * @param amount
   */
  public onSplit(token, amount) {
    const {
      contracts: { [token]: splitToken, InterestPoolDao },
      address,
      web3Utils,
      endOfYear,
    } = this
    console.log(splitToken, InterestPoolDao, amount)
    return InterestPoolDao.methods
      .split(splitToken._address, endOfYear, web3Utils.toWei(amount))
      .send({ from: address })
  }

  /**
   * Fuse Currency
   * @param amount
   */
  public onFuse(token, amount) {
    const [, origin, endOfYear] = token.split('_')
    const {
      contracts: { [origin]: fuseToken, InterestPoolDao },
      address,
      web3Utils,
    } = this
    console.log(fuseToken, InterestPoolDao, amount)
    return InterestPoolDao.methods.fuse(fuseToken._address, endOfYear, web3Utils.toWei(amount)).send({ from: address })
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
  private networkChanged(network) {
    this.network = network
    this.onEvent(Events.NETWORK_CHANGED)
    this.fetchContracts()
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
    Promise.all(this.balanceTokens.map(token => this.fetchBalanceByToken(token)))
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
      endOfYear,
      supportTokens: { ZERO_ADDRESS },
    } = this
    if (token.includes('F_') || token.includes('I_')) {
      const origin = token.split('_')[1]
      return new Promise(resolve => {
        contractInstance.methods
          .id(contracts[origin]._address, endOfYear, ZERO_ADDRESS, 0)
          .call()
          .then(id => {
            if (id) {
              contractInstance.methods
                .balanceOf(address, id)
                .call()
                .then(res => {
                  const balance = web3Utils.fromWei(res)
                  resolve({ token: `${token}_${endOfYear}`, balance })
                })
                .catch(err => resolve({ token: `${token}_${endOfYear}`, balance: 0 }))
            } else {
              resolve({ token, balance: -1 })
            }
          })
          .catch(err => resolve({ token, balance: -1 }))
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
            resolve({ token, balance })
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
  private async initializeProtocol() {
    const {
      contracts: { ProtocolDao },
      web3Utils,
      supportTokens,
    } = this
    const currencyDaoAddr = await ProtocolDao.methods.daos(1).call()
    const currencyDao = web3Utils.createContract(this.supportTokens.CurrencyDao.def, currencyDaoAddr)
    this.contracts.CurrencyDao = currencyDao
    const interestPoolDaoAddr = await ProtocolDao.methods.daos(2).call()
    const interestPoolDao = web3Utils.createContract(this.supportTokens.InterestPoolDao.def, interestPoolDaoAddr)
    this.contracts.InterestPoolDao = interestPoolDao
    const lsfuiTokens: string[] = []
    for (const token of this.balanceTokens) {
      if (this.contracts[token]) {
        const lTokenAddress = await currencyDao.methods.token_addresses__l(this.contracts[token]._address).call()
        if (lTokenAddress) {
          this.contracts[`L_${token}`] = web3Utils.createContract(supportTokens[token].def, lTokenAddress)
          lsfuiTokens.push(`L_${token}`)
        }
        // const sTokenAddress = await currencyDao.methods.token_addresses__s(this.contracts[token]._address).call()
        // if (sTokenAddress) {
        //   this.contracts[`S_${token}`] = web3Utils.createContract(supportTokens[token].def, sTokenAddress)
        //   lsfuiTokens.push(`S_${token}`)
        // }
        const fTokenAddress = await currencyDao.methods.token_addresses__f(this.contracts[token]._address).call()
        if (fTokenAddress) {
          this.contracts[`F_${token}`] = web3Utils.createContract(supportTokens.MultiFungibleToken.def, fTokenAddress)
          lsfuiTokens.push(`F_${token}`)
        }
        // const uTokenAddress = await currencyDao.methods.token_addresses__u(this.contracts[token]._address).call()
        // if (uTokenAddress) {
        //   this.contracts[`U_${token}`] = web3Utils.createContract(supportTokens[token].def, uTokenAddress)
        //   lsfuiTokens.push(`U_${token}`)
        // }
        const iTokenAddress = await currencyDao.methods.token_addresses__i(this.contracts[token]._address).call()
        if (iTokenAddress) {
          this.contracts[`I_${token}`] = web3Utils.createContract(supportTokens.MultiFungibleToken.def, iTokenAddress)
          lsfuiTokens.push(`I_${token}`)
        }
      }
    }
    this.balanceTokens.push(...lsfuiTokens)
    this.fetchBalanceStart()
  }
}

// export const fetchBalanceByToken = (payload, callback) => {
//   const { address, web3Utils } = payload
//   const contractInstance = payload.contractInstance

//   if (!contractInstance.methods.balanceOf) {
//     return callback({ message: 'No balanceOf() in Contract Instance' })
//   }
//   contractInstance.methods
//     .balanceOf(address)
//     .call()
//     .then(res => {
//       const value = web3Utils.fromWei(res)
//       callback(null, { data: value })
//     })
//     .catch(err => {
//       console.log('Fetch balance failed', contractInstance._address)
//       callback(err)
//     })
// }

// export const fetchAllowanceByToken = (payload, callback) => {
//   const { address, contractInstance, protocolContract, web3Utils } = payload

//   if (!contractInstance.methods.allowance) {
//     return callback({ message: 'No allowance() in Contract Instance' })
//   }
//   contractInstance.methods
//     .allowance(address, protocolContract._address)
//     .call({ from: address })
//     .then(res => {
//       const value = web3Utils.fromWei(res)
//       callback(null, { data: value })
//     })
//     .catch(err => {
//       console.log('Fetch allowance failed', contractInstance._address)
//       callback(err)
//     })
// }

// const fillZero = (len = 40) => {
//   return `0x${new Array(len).fill(0).join('')}`
// }

// export const fetchPositions = async (payload, callback) => {
//   const { address, Protocol, web3Utils, wranglers } = payload
//   const lendCount = await Protocol.methods.lend_positions_count(address).call()
//   const borrowCount = await Protocol.methods.borrow_positions_count(address).call()

//   const positions: any[] = []
//   const positionExists = {}
//   for (let i = 1; i <= lendCount; i++) {
//     const positionHash = await Protocol.methods.lend_positions(address, i).call()
//     if (positionHash === fillZero(64)) {
//       continue
//     }
//     const positionData = await Protocol.methods.position(positionHash).call()
//     const wrangler = wranglers.find(w => w.address.toLowerCase() === positionData[5].toLowerCase())
//     const health = await Axios.get(`${wrangler.apiLoanRequests}/loan_health/${positionData[0]}`)

//     if (!positionExists[positionHash]) {
//       positionExists[positionHash] = true
//       positions.push({
//         type: 'lent',
//         positionData,
//         health: health.data.data,
//         address: positionHash,
//       })
//     }
//   }
//   for (let i = 1; i <= borrowCount; i++) {
//     const positionHash = await Protocol.methods.borrow_positions(address, i).call()
//     if (positionHash === fillZero(64)) {
//       continue
//     }
//     const positionData = await Protocol.methods.position(positionHash).call()
//     const wrangler = wranglers.find(w => w.address.toLowerCase() === positionData[5].toLowerCase())
//     const health = await Axios.get(`${wrangler.apiLoanRequests}/loan_health/${positionData[0]}`)

//     if (!positionExists[positionHash]) {
//       positionExists[positionHash] = true
//       positions.push({
//         type: 'borrowed',
//         positionData,
//         health: health.data.data,
//         address: positionHash,
//       })
//     }
//   }

//   positions.forEach(position => {
//     const { positionData, health } = position

//     const positionInfo = {
//       index: parseInt(positionData[0], 10),
//       kernel_creator: positionData[1],
//       lender: positionData[2],
//       borrower: positionData[3],
//       relayer: positionData[4],
//       wrangler: positionData[5],
//       created_at: parseInt(positionData[6], 10) * 1000,
//       updated_at: parseInt(positionData[7], 10) * 1000,
//       expires_at: parseInt(positionData[8], 10) * 1000,
//       borrow_currency_address: positionData[9],
//       lend_currency_address: positionData[10],
//       borrow_currency_value: web3Utils.fromWei(positionData[11]),
//       borrow_currency_current_value: web3Utils.fromWei(positionData[12]),
//       lend_currency_filled_value: web3Utils.fromWei(positionData[13]),
//       lend_currency_owed_value: web3Utils.fromWei(positionData[14]),
//       status: parseInt(positionData[15], 10),
//       nonce: parseInt(positionData[16], 10),
//       relayer_fee: web3Utils.fromWei(positionData[17]),
//       monitoring_fee: web3Utils.fromWei(positionData[18]),
//       rollover_fee: web3Utils.fromWei(positionData[19]),
//       closure_fee: web3Utils.fromWei(positionData[20]),
//       hash: positionData[21],
//     }

//     const {
//       index,
//       kernel_creator,
//       lender,
//       borrower,
//       relayer,
//       wrangler,
//       created_at,
//       updated_at,
//       expires_at,
//       borrow_currency_address,
//       lend_currency_address,
//       borrow_currency_value,
//       borrow_currency_current_value,
//       lend_currency_filled_value,
//       lend_currency_owed_value,
//       status,
//       nonce,
//       relayer_fee,
//       monitoring_fee,
//       rollover_fee,
//       closure_fee,
//       hash,
//     } = positionInfo

//     let statusLabel = 'Unknown'
//     switch (status) {
//       case Constants.LOAN_STATUS_OPEN:
//         statusLabel = 'Active'
//         break
//       case Constants.LOAN_STATUS_CLOSED:
//         statusLabel = 'Closed'
//         break
//       case Constants.LOAN_STATUS_LIQUIDATED:
//         statusLabel = 'Liquidated'
//         break
//       default:
//         statusLabel = 'Unknown'
//     }

//     position.loanNumber = index + 1
//     position.amount = lend_currency_filled_value
//     position.totalInterest = Math.max(web3Utils.substract(lend_currency_owed_value, lend_currency_filled_value), 0)
//     position.term = (expires_at - Date.now()) / 1000
//     position.status = statusLabel

//     position.origin = {
//       loanAmountBorrowed: lend_currency_filled_value,
//       loanAmountOwed: lend_currency_owed_value,
//       collateralAmount: borrow_currency_current_value,
//       expiresAtTimestamp: expires_at,
//       createdAtTimestamp: created_at,
//       loanContract: Protocol,
//       borrower,
//       lender,
//       wrangler,
//       userAddress: address,
//       loanStatus: status,
//       kernel_creator,
//       collateralToken: hash,
//       loanToken: kernel_creator === lender ? lend_currency_address : lend_currency_address,
//     }

//     position.detail = {
//       index,
//       kernel_creator,
//       lender,
//       borrower,
//       relayer,
//       wrangler,
//       created_at,
//       updated_at,
//       expires_at,
//       borrow_currency_address,
//       lend_currency_address,
//       borrow_currency_value,
//       borrow_currency_current_value,
//       lend_currency_filled_value,
//       lend_currency_owed_value,
//       status,
//       nonce,
//       relayer_fee,
//       monitoring_fee,
//       rollover_fee,
//       closure_fee,
//       hash,
//       health,
//     }
//   })

//   const activePositions = positions.filter(position => position.origin.loanStatus !== Constants.LOAN_STATUS_CLOSED)

//   callback(null, {
//     positions: {
//       lent: activePositions
//         .filter(position => position.type === 'lent')
//         .sort((a, b) => b.origin.createdAtTimestamp - a.origin.createdAtTimestamp)
//         .slice(0, 10),
//       borrowed: activePositions
//         .filter(position => position.type === 'borrowed')
//         .sort((a, b) => b.origin.createdAtTimestamp - a.origin.createdAtTimestamp)
//         .slice(0, 10),
//     },
//     counts: [lendCount, borrowCount],
//   })
// }

// export const wrapETH = (payload, callback) => {
//   const { amount, isWrap, _WETHContractInstance, metamask, web3Utils } = payload

//   if (isWrap) {
//     _WETHContractInstance.methods
//       .deposit()
//       .send({ value: web3Utils.toWei(amount), from: metamask.address })
//       .then(hash => callback(null, hash.transactionHash))
//       .catch(err => callback(err))
//   } else {
//     _WETHContractInstance.methods
//       .withdraw(web3Utils.toWei(amount))
//       .send({ from: metamask.address })
//       .then(hash => callback(null, hash.transactionHash))
//       .catch(err => callback(err))
//   }
// }

// export const allowance = (payload, callback) => {
//   const { address, tokenContractInstance, tokenAllowance, protocolContract, web3Utils } = payload

//   if (
//     tokenAllowance === 0 ||
//     !tokenContractInstance.methods.increaseApproval ||
//     !tokenContractInstance.methods.decreaseApproval
//   ) {
//     tokenContractInstance.methods
//       .approve(protocolContract._address, web3Utils.toWei('10000000000000000000'))
//       .send({ from: address })
//       .then(res => callback(null, res.transactionHash))
//       .catch(err => callback(err))
//   } else {
//     tokenContractInstance.methods
//       .increaseApproval(protocolContract._address, web3Utils.toWei('10000000000000000000'))
//       .send({ from: address })
//       .then(res => callback(null, res.transactionHash))
//       .catch(err => callback(err))
//   }
// }

// export const fillLoan = (payload, callback) => {
//   const { approval, web3Utils } = payload

//   web3Utils
//     .sendSignedTransaction(approval._signed_transaction)
//     .then(hash => callback(null, hash.transactionHash))
//     .catch(err => callback(err))
// }

// export const closePosition = (payload, callback) => {
//   const { data } = payload

//   data.origin.loanContract.methods
//     .close_position(data.origin.collateralToken)
//     .send({ from: data.origin.borrower })
//     .then(hash => {
//       setTimeout(callback, 5000, null, hash.transactionHash)
//     })
//     .catch(err => callback(err))
// }

// export const topUpPosition = (payload, callback) => {
//   const { data, topUpCollateralAmount } = payload

//   data.loanContract.methods
//     .topup_position(data.collateralToken, topUpCollateralAmount)
//     .send({ from: data.userAddress })
//     .then(hash => {
//       setTimeout(callback, 5000, null, hash.transactionHash)
//     })
//     .catch(err => callback(err))
// }

// export const liquidatePosition = (payload, callback) => {
//   const { data } = payload

//   data.origin.loanContract.methods
//     .liquidate_position(data.origin.collateralToken)
//     .send({ from: data.origin.userAddress })
//     .then(hash => {
//       setTimeout(callback, 5000, null, hash.transactionHash)
//     })
//     .catch(err => callback(err))
// }

// export const cancelOrder = async (payload, callback) => {
//   const { data, protocolContractInstance, metamask, web3Utils } = payload

//   // 1. an array of addresses[6] in this order: lender, borrower, relayer, wrangler, collateralToken, loanToken
//   const addresses = [data.lender, data.borrower, data.relayer, data.wrangler, data.collateralToken, data.loanToken]

//   // 2. an array of uints[9] in this order: loanAmountOffered, interestRatePerDay, loanDuration, offerExpiryTimestamp, relayerFeeLST, monitoringFeeLST, rolloverFeeLST, closureFeeLST, creatorSalt
//   const values = [
//     data.loanAmountOffered,
//     // data.interestRatePerDay,
//     // data.loanDuration,
//     // data.offerExpiry,
//     data.relayerFeeLST,
//     data.monitoringFeeLST,
//     data.rolloverFeeLST,
//     data.closureFeeLST,
//     // data.creatorSalt
//   ]

//   const orderHash = await protocolContractInstance.methods
//     .kernel_hash(
//       addresses,
//       values,
//       parseInt(data.offerExpiry, 10),
//       data.creatorSalt,
//       web3Utils.toWei(data.interestRatePerDay),
//       // parseInt(data.interestRatePerDay, 10),
//       parseInt(data.loanDuration, 10)
//     )
//     .call()
//   const filledOrCancelledLoanAmount = await protocolContractInstance.methods
//     .filled_or_cancelled_loan_amount(orderHash)
//     .call()
//   const cancelledCollateralTokenAmount = web3Utils.substractBN(data.loanAmountOffered, filledOrCancelledLoanAmount)

//   protocolContractInstance.methods
//     .cancel_kernel(
//       addresses,
//       values,
//       parseInt(data.offerExpiry, 10),
//       data.creatorSalt,
//       web3Utils.toWei(data.interestRatePerDay),
//       // parseInt(data.interestRatePerDay, 10),
//       parseInt(data.loanDuration, 10),
//       data.ecSignatureCreator,
//       web3Utils.toWei(cancelledCollateralTokenAmount)
//     )
//     .send({ from: metamask.address })
//     .then(result => callback(null, result.transactionHash))
//     .catch(err => callback(err))
// }
