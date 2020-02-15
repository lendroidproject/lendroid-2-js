/**
 * Utilities for Web3
 */
export class Web3Utils {
  private web3: any
  /**
   * Exported property for wide-use
   */
  public eth: any

  constructor(web3) {
    this.web3 = web3
    this.eth = web3.eth

    this.toWei = this.toWei.bind(this)
    this.fromWei = this.fromWei.bind(this)
    this.toBN = this.toBN.bind(this)
    this.toDecimal = this.toDecimal.bind(this)
    this.substract = this.substract.bind(this)
    this.substractBN = this.substractBN.bind(this)

    this.createContract = this.createContract.bind(this)
    this.sendSignedTransaction = this.sendSignedTransaction.bind(this)
  }

  /**
   * Reference - web3.utils.toWei
   * @param value
   */
  public toWei(value) {
    return this.web3.utils.toWei(value.toString(), 'ether')
  }

  /**
   * Reference - web3.utils.fromWei
   * @param value
   */
  public fromWei(value) {
    return this.web3.utils.fromWei(value.toString(), 'ether')
  }

  /**
   * Reference - web3.utils.asciiToHex
   * @param value
   */
  public asciiToHex(value) {
    return this.web3.utils.asciiToHex(value.toString())
  }

  /**
   * Reference - web3.utils.hexToAscii
   * @param value
   */
  public hexToAscii(value) {
    return this.web3.utils.hexToAscii(value)
  }

  /**
   * Reference - web3.utils.toBN
   * @param value
   */
  public toBN(value) {
    return this.web3.utils.toBN(value)
  }

  /**
   * Reference - web3.utils.toDecimal
   * @param value
   */
  public toDecimal(value) {
    return this.web3.utils.toDecimal(value)
  }

  /**
   * Substract Numbers
   * @param value1
   * @param value2
   */
  public substract(value1, value2) {
    const bnValue1 = this.toBN(this.toWei(value1))
    const bnValue2 = this.toBN(this.toWei(value2))
    return parseFloat(this.fromWei(bnValue1.sub(bnValue2)).toString())
  }

  /**
   * Substract BigNumbers
   * @param value1
   * @param value2
   */
  public substractBN(value1, value2) {
    const bnValue1 = this.toBN(value1)
    const bnValue2 = this.toBN(value2)
    return parseFloat(this.fromWei(bnValue1.sub(bnValue2)).toString())
  }

  /**
   * Reference - web3.eth.Contract
   * @param abi
   * @param address
   */
  public createContract(abi: any, address = '') {
    return new this.eth.Contract(abi, address)
  }

  /**
   * Reference - web3.eth.sendSignedTransaction
   * @param signedTransactionData
   */
  public sendSignedTransaction(signedTransactionData) {
    return this.eth.sendSignedTransaction(signedTransactionData)
  }

  /**
   * Get lastest blocktimestamp
   */
  public async getBlockTimeStamp() {
    return new Promise((resolve, reject) => {
      this.eth.getBlock('latest', (err, block) => {
        if (err) {
          reject(err)
        } else {
          resolve(block.timestamp)
        }
      })
    })
  }
}
